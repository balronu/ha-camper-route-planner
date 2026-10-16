"""Optional route-to-fuel adapter contract; no database coupling."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ..models import RouteWaypoint


@dataclass(frozen=True, slots=True)
class FuelAlongRoute:
    station_id: str
    location: RouteWaypoint
    fuel_type: str
    price: float | None
    currency: str | None
    price_updated_at: datetime | None
    distance_to_route_m: float | None
    detour_m: float | None
    stale: bool


class FuelAlongRouteProvider:
    """Disabled-by-default contract for a future optional adapter."""

    enabled = False

    async def find_along_route(self, route_points: tuple[RouteWaypoint, ...], fuel_type: str) -> tuple[FuelAlongRoute, ...]:
        del route_points, fuel_type
        return ()
