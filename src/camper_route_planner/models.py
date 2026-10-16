from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal


class ValidationError(ValueError):
    pass


@dataclass(frozen=True)
class Coordinate:
    latitude: float
    longitude: float

    def __post_init__(self) -> None:
        if not (-90 <= self.latitude <= 90):
            raise ValidationError("latitude must be between -90 and 90")
        if not (-180 <= self.longitude <= 180):
            raise ValidationError("longitude must be between -180 and 180")


@dataclass(frozen=True)
class VehicleProfile:
    profile_id: str
    name: str
    vehicle_kind: Literal["motorhome", "truck", "car"]
    height_m: float
    width_m: float
    length_m: float
    gross_weight_t: float
    axle_load_t: float
    axles: int = 2
    emission_class: str | None = None

    def __post_init__(self) -> None:
        if not self.profile_id or not self.name:
            raise ValidationError("profile_id and name are required")
        ranges = (("height_m", self.height_m, 1.0, 5.0), ("width_m", self.width_m, 1.0, 3.5),
                  ("length_m", self.length_m, 2.0, 30.0), ("gross_weight_t", self.gross_weight_t, 1.0, 60.0),
                  ("axle_load_t", self.axle_load_t, 1.0, 20.0))
        for label, value, low, high in ranges:
            if not low <= value <= high:
                raise ValidationError(f"{label} must be between {low} and {high}")
        if not 2 <= self.axles <= 12:
            raise ValidationError("axles must be between 2 and 12")


@dataclass(frozen=True)
class RouteRequest:
    origin: Coordinate
    destination: Coordinate
    vehicle: VehicleProfile
    via: tuple[Coordinate, ...] = ()
    alternatives: int = 0
    geometry: Literal["polyline5", "polyline6", "geojson"] = "geojson"
    traffic: Literal["forecast", "live", "off"] = "off"
    depart_at: datetime | None = None

    def __post_init__(self) -> None:
        if len(self.via) > 5:
            raise ValidationError("at most five via points are supported")
        if not 0 <= self.alternatives <= 2:
            raise ValidationError("alternatives must be between 0 and 2")
        if self.depart_at is not None and self.depart_at.tzinfo is None:
            raise ValidationError("depart_at must be timezone-aware")


@dataclass(frozen=True)
class RouteResult:
    provider: str
    distance_m: float
    duration_s: int
    geometry: list[Coordinate]
    warnings: tuple[str, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.distance_m <= 0 or self.duration_s <= 0 or len(self.geometry) < 2:
            raise ValidationError("route result must contain positive distance/duration and geometry")
