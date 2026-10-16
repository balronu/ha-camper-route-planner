"""Explicit-only route coordinator; it has no refresh loop or timer."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

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
    """Manual action boundary with in-flight deduplication."""

    def __init__(self, provider: RoutingProvider, store: ProfileRouteStore | None = None, quota: QuotaGuard | None = None) -> None:
        self.provider = provider
        self.store = store
        self.quota = quota or QuotaGuard()
        self._inflight: dict[str, asyncio.Task[RouteResult]] = {}

    async def async_calculate_manual(self, request: RouteRequest) -> RouteResult:
        """Calculate only because a caller explicitly invoked this method."""
        key = request.cache_key()
        existing = self._inflight.get(key)
        if existing:
            return await existing
        self.quota.check()
        task = asyncio.create_task(self.provider.calculate(request))
        self._inflight[key] = task
        try:
            result = await task
            self.quota.consume()
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
