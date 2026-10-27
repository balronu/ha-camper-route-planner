"""Provider-neutral domain models for route planning."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from datetime import datetime
from typing import Any, Literal


class ValidationError(ValueError):
    """Raised for invalid route-domain input."""


VehicleKind = Literal["motorhome", "truck", "car"]
FuelType = Literal["diesel", "petrol", "electric", "hybrid", "other"]
TrafficMode = Literal["forecast", "live", "off"]
AvoidOption = Literal["tolls", "motorways", "ferries", "tunnels"]
RouteType = Literal["fastest", "eco"]


@dataclass(frozen=True, slots=True)
class RouteWaypoint:
    latitude: float
    longitude: float
    label: str | None = None

    def __post_init__(self) -> None:
        if not -90 <= self.latitude <= 90:
            raise ValidationError("latitude must be between -90 and 90")
        if not -180 <= self.longitude <= 180:
            raise ValidationError("longitude must be between -180 and 180")
        if self.label is not None and not self.label.strip():
            raise ValidationError("waypoint label must not be empty")

    def as_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {"latitude": self.latitude, "longitude": self.longitude}
        if self.label:
            value["label"] = self.label
        return value

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "RouteWaypoint":
        return cls(float(value["latitude"]), float(value["longitude"]), value.get("label"))


@dataclass(frozen=True, slots=True)
class VehicleProfile:
    profile_id: str
    name: str
    vehicle_kind: VehicleKind
    height_m: float
    width_m: float
    length_m: float
    gross_weight_kg: int
    fuel_type: FuelType
    axles: int = 2
    actual_weight_kg: int | None = None
    axle_load_kg: int | None = None
    trailer: bool = False
    trailer_length_m: float | None = None
    preferences: dict[str, Any] = field(default_factory=dict)
    tracker_entity_id: str | None = None
    emission_class: str | None = None
    co2_class: str | None = None
    first_registration: str | None = None
    consumption_l_per_100km: float | None = None
    tank_capacity_l: float | None = None
    fuel_level_l: float | None = None
    fuel_level_pct: float | None = None
    reserve_l: float | None = None
    diesel_price_per_l: float | None = None
    schema_version: int = 1

    def __post_init__(self) -> None:
        if not self.profile_id.strip() or not self.name.strip():
            raise ValidationError("profile_id and name are required")
        if self.vehicle_kind not in ("motorhome", "truck", "car"):
            raise ValidationError("unsupported vehicle kind")
        for label, value, low, high in (
            ("height_m", self.height_m, 1.0, 5.0),
            ("width_m", self.width_m, 1.0, 3.5),
            ("length_m", self.length_m, 2.0, 30.0),
        ):
            if not low <= value <= high:
                raise ValidationError(f"{label} must be between {low} and {high}")
        if not 500 <= self.gross_weight_kg <= 60000:
            raise ValidationError("gross_weight_kg must be between 500 and 60000")
        if not 1 <= self.axles <= 16:
            raise ValidationError("axles must be between 1 and 16")
        if self.actual_weight_kg is not None and not 1 <= self.actual_weight_kg <= self.gross_weight_kg:
            raise ValidationError("actual_weight_kg must be positive and no greater than gross weight")
        if self.axle_load_kg is not None and not 1 <= self.axle_load_kg <= self.gross_weight_kg:
            raise ValidationError("axle_load_kg must be positive and no greater than gross weight")
        if self.trailer_length_m is not None and not 2 <= self.trailer_length_m <= 30:
            raise ValidationError("trailer_length_m must be between 2 and 30")
        if not self.trailer and self.trailer_length_m is not None:
            raise ValidationError("trailer_length_m requires trailer=true")
        if self.tracker_entity_id is not None and (not self.tracker_entity_id.startswith("device_tracker.") or len(self.tracker_entity_id) > 255):
            raise ValidationError("tracker_entity_id must be a device_tracker entity")
        if self.emission_class is not None and self.emission_class not in {f"euro{index}" for index in range(7)}:
            raise ValidationError("emission_class must be euro0 through euro6")
        if self.co2_class is not None and self.co2_class not in {letter for letter in "abcdefg"}:
            raise ValidationError("co2_class must be a through g")
        if self.first_registration is not None:
            try:
                date.fromisoformat(self.first_registration)
            except (TypeError, ValueError) as exc:
                raise ValidationError("first_registration must be an ISO date") from exc
        if self.consumption_l_per_100km is not None and not 0.1 <= self.consumption_l_per_100km <= 100:
            raise ValidationError("consumption_l_per_100km must be between 0.1 and 100")
        for label, value, low, high in (("tank_capacity_l", self.tank_capacity_l, 1, 5000), ("fuel_level_l", self.fuel_level_l, 0, 5000), ("fuel_level_pct", self.fuel_level_pct, 0, 100), ("reserve_l", self.reserve_l, 0, 5000), ("diesel_price_per_l", self.diesel_price_per_l, 0, 20)):
            if value is not None and not low <= value <= high:
                raise ValidationError(f"{label} must be between {low} and {high}")
        if self.fuel_level_l is not None and self.tank_capacity_l is not None and self.fuel_level_l > self.tank_capacity_l:
            raise ValidationError("fuel_level_l cannot exceed tank_capacity_l")
        if self.fuel_level_pct is not None and self.fuel_level_l is not None:
            raise ValidationError("provide either fuel_level_l or fuel_level_pct")
        if self.reserve_l is not None and self.tank_capacity_l is not None and self.reserve_l > self.tank_capacity_l:
            raise ValidationError("reserve_l cannot exceed tank_capacity_l")
        if self.schema_version != 1:
            raise ValidationError("unsupported vehicle profile schema")

    def as_dict(self) -> dict[str, Any]:
        return {
            "profile_id": self.profile_id,
            "name": self.name,
            "vehicle_kind": self.vehicle_kind,
            "height_m": self.height_m,
            "width_m": self.width_m,
            "length_m": self.length_m,
            "gross_weight_kg": self.gross_weight_kg,
            "fuel_type": self.fuel_type,
            "axles": self.axles,
            "actual_weight_kg": self.actual_weight_kg,
            "axle_load_kg": self.axle_load_kg,
            "trailer": self.trailer,
            "trailer_length_m": self.trailer_length_m,
            "preferences": dict(self.preferences),
            "tracker_entity_id": self.tracker_entity_id,
            "schema_version": self.schema_version,
            "emission_class": self.emission_class,
            "co2_class": self.co2_class,
            "first_registration": self.first_registration,
            "consumption_l_per_100km": self.consumption_l_per_100km,
            "tank_capacity_l": self.tank_capacity_l, "fuel_level_l": self.fuel_level_l,
            "fuel_level_pct": self.fuel_level_pct, "reserve_l": self.reserve_l,
            "diesel_price_per_l": self.diesel_price_per_l,
        }

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "VehicleProfile":
        return cls(**value)


@dataclass(frozen=True, slots=True)
class RouteGeometry:
    points: tuple[RouteWaypoint, ...]
    format: Literal["geojson", "polyline5", "polyline6"] = "geojson"

    def __post_init__(self) -> None:
        if len(self.points) < 2:
            raise ValidationError("route geometry requires at least two points")

    def as_dict(self) -> dict[str, Any]:
        return {"format": self.format, "points": [point.as_dict() for point in self.points]}


@dataclass(frozen=True, slots=True)
class RouteWarning:
    code: str
    message: str
    severity: Literal["info", "warning", "error"] = "warning"
    verified: bool = False


@dataclass(frozen=True, slots=True)
class ProviderCapabilities:
    provider: str
    supports_live: bool
    supports_alternatives: bool
    supports_vehicle_dimensions: bool
    supports_waypoints: bool
    live_status: Literal["disabled", "unverified", "available"] = "disabled"


@dataclass(frozen=True, slots=True)
class RouteRequest:
    origin: RouteWaypoint
    destination: RouteWaypoint
    vehicle: VehicleProfile
    waypoints: tuple[RouteWaypoint, ...] = ()
    alternatives: int = 0
    traffic: TrafficMode = "off"
    geometry_format: Literal["geojson", "polyline5", "polyline6"] = "geojson"
    depart_at: datetime | None = None
    avoid: tuple[AvoidOption, ...] = ()
    route_type: RouteType = "fastest"
    arrive_at: datetime | None = None

    def __post_init__(self) -> None:
        if len(self.waypoints) > 5:
            raise ValidationError("at most five waypoints are supported")
        if not 0 <= self.alternatives <= 2:
            raise ValidationError("alternatives must be between 0 and 2")
        if self.depart_at is not None and self.depart_at.tzinfo is None:
            raise ValidationError("depart_at must be timezone-aware")
        if self.arrive_at is not None and self.arrive_at.tzinfo is None:
            raise ValidationError("arrive_at must be timezone-aware")
        if self.depart_at is not None and self.arrive_at is not None:
            raise ValidationError("depart_at and arrive_at are mutually exclusive")
        if self.alternatives and self.waypoints:
            raise ValidationError("alternatives are not supported with waypoints")
        if self.route_type not in ("fastest", "eco") or any(item not in {"tolls", "motorways", "ferries", "tunnels"} for item in self.avoid):
            raise ValidationError("unsupported route option")

    def cache_key(self) -> str:
        return repr((self.origin, self.destination, self.vehicle.as_dict(), self.waypoints, self.alternatives, self.traffic, self.geometry_format, self.depart_at, self.arrive_at, self.avoid, self.route_type))


@dataclass(frozen=True, slots=True)
class RouteResult:
    provider: str
    distance_m: float
    duration_s: int
    geometry: RouteGeometry
    warnings: tuple[RouteWarning, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)
    synthetic: bool = False
    created_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.distance_m <= 0 or self.duration_s <= 0:
            raise ValidationError("route result must contain positive distance and duration")


class ProviderError(RuntimeError):
    """Normalized provider error; it never contains credentials."""

    def __init__(self, message: str, *, code: str, status: int | None = None, retryable: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.retryable = retryable
