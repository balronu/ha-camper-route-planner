"""Explicit-only route coordinator; it has no refresh loop or timer."""

from __future__ import annotations

import asyncio
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timezone
import time

from .models import ProviderError, RouteRequest, RouteResult
from .providers.base import RoutingProvider
from .storage import ProfileRouteStore


@dataclass(slots=True)
class QuotaGuard:
    daily_limit: int | None = None
    used: int = 0

    def check(self) -> None:
        if self.daily_limit is not None and self.used >= self.daily_limit:
            raise ProviderError("route quota exhausted", code="quota_exhausted", status=429)

    def consume(self) -> None:
        self.used += 1


class RouteCoordinator:
    """Manual action boundary with in-flight and bounded success caching."""

    def __init__(
        self,
        provider: RoutingProvider,
        store: ProfileRouteStore | None = None,
        quota: QuotaGuard | None = None,
        *,
        cache_ttl_s: float = 300.0,
        cache_size: int = 8,
    ) -> None:
        self.provider = provider
        self.store = store
        self.quota = quota or QuotaGuard()
        self._inflight: dict[str, asyncio.Task[RouteResult]] = {}
        self.cache_ttl_s = max(0.0, float(cache_ttl_s))
        self.cache_size = max(0, int(cache_size))
        self._success_cache: OrderedDict[str, tuple[float, RouteResult, datetime]] = OrderedDict()

    def _cache_key(self, request: RouteRequest) -> str:
        # A coordinator normally has one provider, but including its identity
        # makes the key safe if a caller reuses a coordinator around adapters.
        return f"{self.provider.name}:{request.cache_key()}"

    def _cached(self, key: str, now: float) -> RouteResult | None:
        entry = self._success_cache.get(key)
        if entry is None:
            return None
        stored_at, result, calculated_at = entry
        if now - stored_at >= self.cache_ttl_s:
            self._success_cache.pop(key, None)
            return None
        self._success_cache.move_to_end(key)
        metadata = dict(result.metadata)
        metadata.update({
            "cache_hit": True,
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "data_stale": True,
            "data_stale_note": "Route border waits and tolls may have changed since the original calculation.",
        })
        from dataclasses import replace
        return replace(result, metadata=metadata, created_at=calculated_at)

    async def async_calculate_manual(self, request: RouteRequest, *, force_refresh: bool = False) -> RouteResult:
        """Calculate only because a caller explicitly invoked this method."""
        key = self._cache_key(request)
        existing = self._inflight.get(key)
        if existing:
            await existing
            entry = self._success_cache.get(key)
            if entry is not None and time.monotonic() - entry[0] < self.cache_ttl_s:
                return entry[1]
            return await existing
        if not force_refresh:
            cached = self._cached(key, time.monotonic())
            if cached is not None:
                return cached
        self.quota.check()
        task = asyncio.create_task(self.provider.calculate(request))
        self._inflight[key] = task
        try:
            result = await task
            self.quota.consume()
            calculated_at = result.created_at or datetime.now(timezone.utc)
            from dataclasses import replace
            result = replace(result, created_at=calculated_at)
            if self.cache_size:
                metadata = dict(result.metadata)
                metadata.update({"cache_hit": False, "calculated_at": calculated_at.isoformat()})
                result = replace(result, metadata=metadata)
                self._success_cache[key] = (time.monotonic(), result, calculated_at)
                self._success_cache.move_to_end(key)
                while len(self._success_cache) > self.cache_size:
                    self._success_cache.popitem(last=False)
            return result
        finally:
            self._inflight.pop(key, None)

    async def async_save_result(self, request: RouteRequest, result: RouteResult, name: str = "manual route") -> str:
        """Persist a result only after an explicit save action."""
        if self.store is None:
            raise ProviderError("route storage unavailable", code="storage_unavailable")
        from uuid import uuid4

        route_id = str(uuid4())
        await self.store.async_save_route(route_id, request, result, name)
        return route_id
