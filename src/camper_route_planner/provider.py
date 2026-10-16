from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Protocol

from .models import Coordinate, RouteRequest, RouteResult


class ProviderError(RuntimeError):
    def __init__(self, message: str, status: int | None = None, code: str | None = None):
        super().__init__(message)
        self.status, self.code = status, code


class RoutingProvider(Protocol):
    name: str

    async def calculate(self, request: RouteRequest) -> RouteResult: ...


@dataclass
class MockRoutingProvider:
    name: str = "mock"
    response: dict[str, Any] | None = None
    delay_s: float = 0

    async def calculate(self, request: RouteRequest) -> RouteResult:
        if self.delay_s:
            await asyncio.sleep(self.delay_s)
        payload = self.response or {
            "ok": True, "data": {"route": {"distance_m": 1000, "duration_s": 120,
            "geometry": [[request.origin.latitude, request.origin.longitude],
                         [request.destination.latitude, request.destination.longitude]]}}
        }
        if not payload.get("ok", False):
            error = payload.get("error", {})
            raise ProviderError("provider rejected request", payload.get("status"), error.get("code"))
        try:
            route = payload["data"]["route"]
            geometry = [Coordinate(float(p[0]), float(p[1])) for p in route["geometry"]]
            return RouteResult(self.name, float(route["distance_m"]), int(route["duration_s"]), geometry,
                               tuple(route.get("warnings", ())), {"mock": True})
        except (KeyError, TypeError, ValueError, IndexError) as exc:
            raise ProviderError("invalid or incomplete provider response", code="invalid_response") from exc
