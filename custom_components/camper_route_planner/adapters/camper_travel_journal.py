"""Optional route-link adapter contract; no database coupling."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class PlannedRouteLink:
    route_id: str
    trip_id: str | None
    vehicle_profile_id: str
    actual_track_id: str | None = None
    linked_at: datetime | None = None


class TravelJournalRouteLinker:
    """Disabled-by-default, explicit and reversible link contract."""

    enabled = False
