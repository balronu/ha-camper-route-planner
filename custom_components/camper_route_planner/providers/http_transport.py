"""Secretsafe asynchronous transport for explicitly invoked Nakordoni calls.

The transport is deliberately dependency-injected. Home Assistant callers pass
the shared aiohttp session; tests use a small fake session and never leave the
process. It does not retry, refresh credentials, or initiate a request by
itself.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import time
from typing import Any

try:
    from aiohttp import ClientTimeout
except ImportError:  # pragma: no cover - HA supplies aiohttp; offline tests do not.
    @dataclass(frozen=True, slots=True)
    class ClientTimeout:  # type: ignore[no-redef]
        total: float
        connect: float

from .nakordoni_motorhome import ROUTE_ENDPOINT, USAGE_ENDPOINT


SAFE_QUOTA_HEADERS = frozenset(
    {"x-devapi-limit", "x-devapi-remaining", "x-devapi-reset", "retry-after", "x-route-source"}
)

_ROUTE_LOCK = asyncio.Lock()
_LAST_ROUTE_START = 0.0


@dataclass(slots=True)
class NakordoniHttpTransport:
    """One bounded GET request using an already-owned Home Assistant session."""

    session: Any
    api_key: str
    timeout_s: float = 60.0
    connect_timeout_s: float = 10.0
    endpoint: str = ROUTE_ENDPOINT
    min_interval_s: float = 1.0
    max_busy_retries: int = 2

    async def __call__(self, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("Nakordoni API key is required")
        headers = {"Authorization": f"Bearer {self.api_key}"}
        global _LAST_ROUTE_START
        attempts = 0
        started = time.monotonic()
        async with _ROUTE_LOCK:
            while True:
                wait_s = self.min_interval_s - (time.monotonic() - _LAST_ROUTE_START)
                if wait_s > 0:
                    await asyncio.sleep(wait_s)
                _LAST_ROUTE_START = time.monotonic()
                attempts += 1
                try:
                    async with self.session.get(
                        self.endpoint,
                        params=parameters,
                        headers=headers,
                        timeout=ClientTimeout(total=self.timeout_s, connect=self.connect_timeout_s),
                        allow_redirects=False,
                    ) as response:
                        try:
                            payload = await response.json(content_type=None)
                        except (TypeError, ValueError) as exc:
                            raise ValueError("Nakordoni returned invalid JSON") from exc
                        if not isinstance(payload, dict):
                            raise ValueError("Nakordoni returned an invalid response")
                        result = dict(payload)
                        result.setdefault("status", int(response.status))
                        result["headers"] = {
                            key: str(value)
                            for key, value in response.headers.items()
                            if key.lower() in SAFE_QUOTA_HEADERS
                        }
                        result["transport"] = {
                            "attempts": attempts,
                            "elapsed_s": round(time.monotonic() - started, 3),
                            "status": int(response.status),
                            "route_source": result["headers"].get("X-Route-Source") or result["headers"].get("x-route-source"),
                        }
                        if response.status >= 400 and result.get("ok") is True:
                            result["ok"] = False
                        error = result.get("error") if isinstance(result.get("error"), dict) else {}
                        busy = response.status == 503 and error.get("code") == "busy"
                        if not busy or attempts > self.max_busy_retries:
                            return result
                        raw_retry = error.get("retry_after") or result["headers"].get("Retry-After") or result["headers"].get("retry-after")
                        try:
                            retry_after = max(0.0, min(float(raw_retry), 120.0))
                        except (TypeError, ValueError):
                            retry_after = 1.0
                        await asyncio.sleep(retry_after)
                except asyncio.TimeoutError:
                    raise
                except OSError:
                    raise
@dataclass(slots=True)
class NakordoniUsageTransport:
    """One explicit, non-routed account request using HA's session."""

    session: Any
    api_key: str
    timeout_s: float = 15.0
    connect_timeout_s: float = 5.0
    endpoint: str = USAGE_ENDPOINT

    async def __call__(self) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("Nakordoni API key is required")
        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with self.session.get(
            self.endpoint,
            headers=headers,
            timeout=ClientTimeout(total=self.timeout_s, connect=self.connect_timeout_s),
            allow_redirects=False,
        ) as response:
            try:
                payload = await response.json(content_type=None)
            except (TypeError, ValueError) as exc:
                raise ValueError("Nakordoni usage returned invalid JSON") from exc
            if not isinstance(payload, dict):
                raise ValueError("Nakordoni usage returned an invalid response")
            result = dict(payload)
            result.setdefault("status", int(response.status))
            result["headers"] = {
                key: str(value)
                for key, value in response.headers.items()
                if key.lower() in SAFE_QUOTA_HEADERS
            }
            if response.status >= 400 and result.get("ok") is True:
                result["ok"] = False
            return result
