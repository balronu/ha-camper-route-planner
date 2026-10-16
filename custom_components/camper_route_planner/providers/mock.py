"""Deterministic, clearly synthetic routing provider."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from ..models import (
    ProviderCapabilities,
    ProviderError,
    RouteGeometry,
    RouteRequest,
    RouteResult,
    RouteWarning,
    RouteWaypoint,
)


@dataclass(slots=True)
class MockRoutingProvider:
    name: str = "mock"
    delay_s: float = 0.0
    fail_with: ProviderError | None = None

    @property
    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities("mock", False, True, True, True, "disabled")

    async def calculate(self, request: RouteRequest) -> RouteResult:
        if self.delay_s:
            await asyncio.sleep(self.delay_s)
        if self.fail_with:
            raise self.fail_with
        points = (request.origin, *request.waypoints, request.destination)
        distance_m = float((len(points) - 1) * 10000 + request.vehicle.gross_weight_kg)
        duration_s = (len(points) - 1) * 900 + request.vehicle.gross_weight_kg // 100
        return RouteResult(
            provider=self.name,
            distance_m=distance_m,
            duration_s=duration_s,
            geometry=RouteGeometry(tuple(RouteWaypoint(p.latitude, p.longitude, p.label) for p in points), request.geometry_format),
            warnings=(RouteWarning("synthetic_route", "Synthetic mock data; not a checked road route", "warning", False),),
            metadata={"synthetic": True, "profile_id": request.vehicle.profile_id},
            synthetic=True,
        )
