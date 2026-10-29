"""Offline-only NaKordoni Truck Route API v3 adapter.

This module is explicitly selected by the beta provider option. It has its own
request and response contract so changing v3 cannot silently change v2.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse

from ..models import (
    ProviderCapabilities,
    ProviderError,
    RouteGeometry,
    RouteRequest,
    RouteResult,
    RouteWarning,
    RouteWaypoint,
    ValidationError,
)
from .nakordoni_motorhome import (
    NakordoniMotorhomeProvider,
    _fallback_border_data,
    build_motorhome_parameters as build_v2_motorhome_parameters,
)

PROVIDER_NAME = "nakordoni_motorhome"
V3_ROUTE_ENDPOINT = "https://nakordoni.eu/api/v3/data/truck-route"
V3_API_VERSION = "v3"

Transport = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


def _positive(value: Any, label: str) -> float:
    if value is None or isinstance(value, bool):
        raise ValidationError(f"{label} is required")
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{label} must be numeric") from exc
    if not math.isfinite(result) or result <= 0:
        raise ValidationError(f"{label} must be positive")
    return result


def build_v3_motorhome_parameters(request: RouteRequest) -> dict[str, Any]:
    """Build only the documented v3 motorhome fields.

    Truck driver/rest fields are intentionally absent.  No defaults are
    invented for safety-critical vehicle values.
    """
    profile = request.vehicle
    if profile.vehicle_kind != "motorhome":
        raise ValidationError("NaKordoni v3 requires a motorhome profile")
    parameters: dict[str, Any] = {
        "from": f"{request.origin.latitude},{request.origin.longitude}",
        "to": f"{request.destination.latitude},{request.destination.longitude}",
        "vehicle_type": "motorhome",
        "length": _positive(profile.length_m, "length_m"),
        "width": _positive(profile.width_m, "width_m"),
        "height": _positive(profile.height_m, "height_m"),
        "weight": _positive(profile.gross_weight_kg, "gross_weight_kg") / 1000,
        "axles": int(profile.axles),
        "traffic": request.traffic,
        "alternatives": request.alternatives,
        "geometry": request.geometry_format,
    }
    if not 2 <= int(profile.axles) <= 12:
        raise ValidationError("axles must be between 2 and 12 for NaKordoni v3 motorhome routing")
    if profile.axle_load_kg is not None:
        axle_load = _positive(profile.axle_load_kg, "axle_load_kg") / 1000
        if axle_load > 20:
            raise ValidationError("axle_load_kg must be no greater than 20000 for NaKordoni v3")
        parameters["axle_load"] = axle_load
    if request.waypoints:
        parameters["via"] = "|".join(f"{p.latitude},{p.longitude}" for p in request.waypoints)
    if request.avoid:
        parameters["avoid"] = ",".join(request.avoid)
    if request.route_type != "fastest":
        parameters["route_type"] = request.route_type
    if request.depart_at is not None:
        parameters["depart_at"] = request.depart_at.isoformat()
    if request.arrive_at is not None:
        parameters["arrive_at"] = request.arrive_at.isoformat()
    if profile.emission_class:
        parameters["emission_class"] = profile.emission_class
    return parameters


def _safe_link(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname not in {"nakordoni.eu", "www.nakordoni.eu", "api.nakordoni.dev"}:
        return None
    return value


def _decode_polyline(value: str, precision: int) -> tuple[RouteWaypoint, ...]:
    if precision not in (5, 6):
        raise ValueError("unsupported polyline precision")
    factor = 10**precision
    index = latitude = longitude = 0
    points: list[RouteWaypoint] = []
    while index < len(value):
        deltas: list[int] = []
        for _ in range(2):
            result = shift = 0
            while True:
                if index >= len(value):
                    raise ValueError("truncated polyline")
                byte = ord(value[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
                if shift > 35:
                    raise ValueError("invalid polyline")
            deltas.append(-(result >> 1) if result & 1 else result >> 1)
        latitude += deltas[0]
        longitude += deltas[1]
        points.append(RouteWaypoint(latitude / factor, longitude / factor))
    return tuple(points)


def _geometry(route: dict[str, Any], requested_format: str) -> RouteGeometry:
    raw = route.get("geometry")
    geometry_format = str(route.get("geometry_format") or requested_format)
    if isinstance(raw, str):
        precision = 6 if geometry_format == "polyline6" else 5
        return RouteGeometry(_decode_polyline(raw, precision), geometry_format)  # type: ignore[arg-type]
    if isinstance(raw, dict) and raw.get("type") == "LineString":
        points = tuple(RouteWaypoint(float(point[1]), float(point[0])) for point in raw.get("coordinates", []))
        return RouteGeometry(points, "geojson")
    if isinstance(raw, list):
        points = tuple(RouteWaypoint(float(point[0]), float(point[1])) for point in raw)
        return RouteGeometry(points, geometry_format)  # type: ignore[arg-type]
    raise ValueError("v3 response has no supported geometry")


def _number(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value)) else None


def _warnings(data: dict[str, Any], route: dict[str, Any]) -> tuple[RouteWarning, ...]:
    items: list[Any] = []
    items.extend(route.get("warnings", []) if isinstance(route.get("warnings", []), list) else [])
    items.extend(data.get("rest_warnings", []) if isinstance(data.get("rest_warnings", []), list) else [])
    result: list[RouteWarning] = []
    for item in items:
        if isinstance(item, dict):
            result.append(RouteWarning(str(item.get("code", "provider_warning")), str(item.get("message", "Provider warning"))))
    existing = {item.code for item in result}
    if data.get("echerha_registration") and "echerha_registration" not in existing:
        result.append(RouteWarning("echerha_registration", "Electronic border registration is required."))
    if data.get("echerha_wait_unverified") and "echerha_wait_unverified" not in existing:
        result.append(RouteWarning("echerha_wait_unverified", "The electronic border wait is unverified."))
    return tuple(result)


def _border_crossings(raw: Any) -> list[dict[str, Any]]:
    """Keep documented crossing fields and sanitize provider links."""
    if not isinstance(raw, list):
        return []
    fields = (
        "name", "ppid", "from_country", "to_country", "status", "wait_min", "wait_at",
        "wait_sides", "wait_notes", "wait_capped", "registration_required",
        "registration_wait_minutes", "registration_wait_source", "registration_wait_at",
        "registration_note",
    )
    result: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        crossing = {field: item.get(field) for field in fields if field in item}
        crossing["source_url"] = _safe_link(item.get("source_url"))
        crossing["registration_url"] = _safe_link(item.get("registration_url"))
        result.append(crossing)
    return result


def _toll_summary(raw: Any) -> dict[str, Any] | None:
    """Normalize the v3 toll envelope to the card's stable display shape."""
    if not isinstance(raw, dict):
        return None
    result: dict[str, Any] = {
        "priced": raw.get("priced") if isinstance(raw.get("priced"), bool) else None,
        "complete": raw.get("complete") if isinstance(raw.get("complete"), bool) else None,
        "estimate": raw.get("estimate") if isinstance(raw.get("estimate"), bool) else None,
        "coverage_note": str(raw["coverage_note"]) if raw.get("coverage_note") is not None else None,
        "currency": str(raw["currency"]) if raw.get("currency") else None,
        "vat": str(raw["vat"]) if raw.get("vat") else None,
    }
    total = raw.get("total_eur", raw.get("total"))
    result["total"] = float(total) if isinstance(total, (int, float)) and not isinstance(total, bool) else None
    countries = raw.get("countries", raw.get("by_country", []))
    if isinstance(countries, dict):
        countries = [{"country": country, **value} for country, value in countries.items() if isinstance(value, dict)]
    result["countries"] = [item for item in countries if isinstance(item, dict)] if isinstance(countries, list) else []
    for country in result["countries"]:
        if "amount" in country and "total" not in country:
            country["total"] = country["amount"]
    objects = raw.get("objects", [])
    result["objects"] = [item for item in objects if isinstance(item, dict)] if isinstance(objects, list) else []
    return result


def _require_motorhome_confirmation(version: Any, data: dict[str, Any], route: dict[str, Any], request: RouteRequest) -> dict[str, Any]:
    if version != V3_API_VERSION:
        raise ProviderError("NaKordoni v3 response lacks explicit v3 confirmation", code="safety_unconfirmed")
    vehicle = data.get("vehicle")
    if not isinstance(vehicle, dict) or vehicle.get("type") != "motorhome":
        raise ProviderError("NaKordoni response is not confirmed as a motorhome route", code="vehicle_type_mismatch")
    expected = {
        "height_m": request.vehicle.height_m,
        "width_m": request.vehicle.width_m,
        "length_m": request.vehicle.length_m,
        "weight_t": request.vehicle.gross_weight_kg / 1000,
        "axles": request.vehicle.axles,
    }
    for field, wanted in expected.items():
        actual = _number(vehicle.get(field))
        if actual is None or not math.isclose(actual, float(wanted), rel_tol=0, abs_tol=0.001):
            raise ProviderError(f"NaKordoni response vehicle field {field} is missing or differs", code="vehicle_confirmation_mismatch")
    legal = route.get("legal")
    hits = route.get("restriction_hits")
    if not isinstance(legal, bool) or not isinstance(hits, list):
        raise ProviderError("NaKordoni response lacks complete restriction confirmation", code="safety_unconfirmed")
    if legal is False or hits:
        raise ProviderError("NaKordoni route contains unresolved vehicle restrictions", code="route_restrictions_unresolved")
    return vehicle


def _eta_metadata(data: dict[str, Any], route: dict[str, Any]) -> dict[str, Any]:
    eta = data.get("eta")
    result: dict[str, Any] = {
        "pure_driving_time_s": _number(route.get("duration_s")),
        "total_eta_s": None,
        "eta": eta if isinstance(eta, dict) else None,
        "border_wait_s": None,
        "registration_wait_s": None,
    }
    if isinstance(eta, dict) and _number(eta.get("total_time_min")) is not None:
        result["total_eta_s"] = _number(eta["total_time_min"]) * 60
    waits = data.get("waits", [])
    if isinstance(waits, list):
        border = 0.0
        registration = 0.0
        for item in waits:
            if not isinstance(item, dict):
                continue
            minutes = _number(item.get("duration_min", item.get("minutes")))
            if minutes is None:
                continue
            if item.get("type") == "border_wait":
                border += minutes * 60
            if item.get("type") == "registration_wait":
                registration += minutes * 60
        result["border_wait_s"] = border
        result["registration_wait_s"] = registration
    return result


@dataclass(slots=True)
class NakordoniRouteAdapterV2:
    """Compatibility facade documenting the unchanged v2 contract."""

    endpoint: str = "https://nakordoni.eu/api/v2/data/truck-route"

    def build_parameters(self, request: RouteRequest) -> dict[str, Any]:
        return build_v2_motorhome_parameters(request)

    def normalize_fixture(self, payload: dict[str, Any]) -> RouteResult:
        return NakordoniMotorhomeProvider().normalize_fixture(payload)


@dataclass(slots=True)
class NakordoniRouteAdapterV3:
    """Strict v3 adapter selected only by the explicit beta provider option."""

    api_key: str | None = None
    transport: Transport | None = None
    endpoint: str = V3_ROUTE_ENDPOINT

    @property
    def name(self) -> str:
        return PROVIDER_NAME

    @property
    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(PROVIDER_NAME, True, True, True, True, "unverified")

    async def calculate(self, request: RouteRequest) -> RouteResult:
        parameters = build_v3_motorhome_parameters(request)
        if not self.api_key:
            raise ProviderError("Nakordoni API key is missing", code="missing_api_key", status=401)
        if self.transport is None:
            raise ProviderError("NaKordoni v3 transport is not configured", code="live_routing_disabled", status=403)
        payload = await self.transport(parameters)
        return self.normalize_response(payload, request=request, synthetic=False)

    def normalize_response(self, payload: dict[str, Any], *, request: RouteRequest, synthetic: bool = True) -> RouteResult:
        if payload.get("ok") is not True:
            error = payload.get("error") if isinstance(payload.get("error"), dict) else {}
            code = str(error.get("code", "provider_error"))
            status = payload.get("status") if isinstance(payload.get("status"), int) else None
            raise ProviderError(str(error.get("message", "NaKordoni v3 request failed")), code=code, status=status, retryable=status in {500, 502, 503, 504})
        try:
            data = payload["data"]
            route = data["route"]
            if not isinstance(data, dict) or not isinstance(route, dict):
                raise ValueError("missing data.route")
            vehicle = _require_motorhome_confirmation(payload.get("api_version", data.get("api_version")), data, route, request)
            geometry = _geometry(route, request.geometry_format)
            distance = _number(route.get("distance_m"))
            duration = _number(route.get("duration_s"))
            if distance is None or duration is None or distance <= 0 or duration <= 0:
                raise ValueError("missing route distance/duration")
            warnings = list(_warnings(data, route))
            if vehicle.get("beta") is True:
                warnings.append(RouteWarning("motorhome_beta", str(vehicle.get("beta_note", "Motorhome routing is in beta."))))
            rest_plan = data.get("rest_plan")
            if rest_plan:
                warnings.append(RouteWarning("motorhome_rest_ignored", "Truck rest-plan data is not applied to a private motorhome."))
            concrete_crossings = _border_crossings(route.get("border_crossings", []))
            if concrete_crossings:
                border_crossings, border_state = concrete_crossings, "confirmed"
            else:
                border_crossings, border_state = _fallback_border_data(route)
            metadata = {
                "api_version": payload.get("api_version", data.get("api_version")),
                "provider_mode": PROVIDER_NAME,
                "fixture": synthetic,
                "beta": bool(vehicle.get("beta")),
                "vehicle": dict(vehicle),
                "legal": route["legal"],
                "restriction_hits": list(route["restriction_hits"]),
                "countries": route.get("countries", []),
                "country_split": route.get("country_split", []),
                "tolls": _toll_summary(route.get("tolls", data.get("tolls"))),
                "traffic": data.get("traffic_forecast", route.get("traffic")),
                "alternatives": data.get("alternatives", []),
                "border_crossings": border_crossings,
                "border_state": border_state,
                "border_data_source": "route.border_crossings" if border_state == "confirmed" else border_state,
                "waits": data.get("waits", []),
                "rest_plan": None,
                "provider_rest_plan_ignored": rest_plan,
                "rest_warnings": data.get("rest_warnings", []),
                "request_options": {
                    "traffic": request.traffic,
                    "avoid": list(request.avoid),
                    "route_type": request.route_type,
                    "alternatives": request.alternatives,
                    "depart_at": request.depart_at.isoformat() if request.depart_at else None,
                    "arrive_at": request.arrive_at.isoformat() if request.arrive_at else None,
                },
                **_eta_metadata(data, route),
                "routing_source": (payload.get("headers") or {}).get("X-Route-Source") or (payload.get("headers") or {}).get("x-route-source"),
                "transport": payload.get("transport", {}),
            }
            return RouteResult(PROVIDER_NAME, distance, int(duration), geometry, tuple(warnings), metadata, synthetic)
        except ProviderError:
            raise
        except (KeyError, TypeError, ValueError, IndexError, ValidationError) as exc:
            raise ProviderError("Invalid or incomplete NaKordoni v3 response", code="invalid_response") from exc
