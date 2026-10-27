"""Offline-first Nakordoni Motorhome beta provider.

This module deliberately contains no default HTTP client.  A transport can be
injected by a future, explicitly enabled integration after the dedicated OAuth
client has been registered.  The normal Phase 2G runtime remains disabled.
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

PROVIDER_NAME = "nakordoni_motorhome"
# Nakordoni documents routing on the public API host, while OAuth and usage
# are intentionally served from api.nakordoni.dev.
ROUTE_ENDPOINT = "https://nakordoni.eu/api/v2/data/truck-route"
USAGE_ENDPOINT = "https://api.nakordoni.dev/api/v2/account/usage"
AUTHORIZE_ENDPOINT = "https://api.nakordoni.dev/oauth/authorize"
TOKEN_ENDPOINT = "https://api.nakordoni.dev/oauth/token"
REDIRECT_URI = "https://my.home-assistant.io/redirect/oauth"
ATTRIBUTION_URL = "https://nakordoni.eu"

FORBIDDEN_TRUCK_TIME_FIELDS = frozenset(
    {"crew", "last_weekly_rest_end", "reduced_weekly_rest", "extended_daily_rest"}
)

Transport = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


def _number(value: Any, label: str) -> float:
    if value is None or isinstance(value, bool):
        raise ValidationError(f"{label} is required")
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{label} must be numeric") from exc
    if not math.isfinite(result) or result <= 0:
        raise ValidationError(f"{label} must be positive")
    return result


def validate_motorhome_profile(profile: Any) -> None:
    """Validate fields that are safety-critical for motorhome routing."""
    if getattr(profile, "vehicle_kind", None) != "motorhome":
        raise ValidationError("Nakordoni Motorhome requires a motorhome profile")
    for field in ("length_m", "width_m", "height_m", "gross_weight_kg"):
        _number(getattr(profile, field, None), field)
    axles = getattr(profile, "axles", None)
    if axles is None or isinstance(axles, bool) or not 2 <= int(axles) <= 12:
        raise ValidationError("axles must be an integer between 2 and 12 for Nakordoni")


def build_motorhome_parameters(request: RouteRequest) -> dict[str, Any]:
    """Build only the documented motorhome request fields."""
    validate_motorhome_profile(request.vehicle)
    parameters: dict[str, Any] = {
        "from": f"{request.origin.latitude},{request.origin.longitude}",
        "to": f"{request.destination.latitude},{request.destination.longitude}",
        "vehicle_type": "motorhome",
        "length": _number(request.vehicle.length_m, "length_m"),
        "width": _number(request.vehicle.width_m, "width_m"),
        "height": _number(request.vehicle.height_m, "height_m"),
        "weight": _number(request.vehicle.gross_weight_kg, "gross_weight_kg") / 1000,
        "axles": int(request.vehicle.axles),
        "traffic": request.traffic,
        "alternatives": request.alternatives,
        "geometry": request.geometry_format,
    }
    if request.waypoints:
        # The documented Truck Route contract uses one pipe-separated via
        # parameter, not repeated query parameters.
        parameters["via"] = "|".join(f"{p.latitude},{p.longitude}" for p in request.waypoints)
    emission_class = getattr(request.vehicle, "emission_class", None)
    if emission_class:
        parameters["emission_class"] = emission_class
    # Nakordoni documents emission_class and axles for motorhome routing, but
    # not CO2 class, first registration, or consumption. Keep those profile
    # fields available for local display/PDF without inventing API parameters.
    if FORBIDDEN_TRUCK_TIME_FIELDS.intersection(parameters):
        raise ValidationError("truck driver-time parameters are not valid for motorhomes")
    return parameters


def safe_provider_link(value: Any) -> str | None:
    """Allow only Nakordoni HTTPS links from provider-supplied actions."""
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname not in {"nakordoni.eu", "www.nakordoni.eu", "api.nakordoni.dev"}:
        return None
    return value


def _toll_summary(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    result: dict[str, Any] = {
        "priced": raw.get("priced") if isinstance(raw.get("priced"), bool) else None,
        "status": str(raw["status"]) if raw.get("status") is not None else "unknown",
        "complete": raw.get("complete") if isinstance(raw.get("complete"), bool) else None,
        "estimate": raw.get("estimate") if isinstance(raw.get("estimate"), bool) else None,
        "coverage_note": str(raw["coverage_note"]) if raw.get("coverage_note") is not None else None,
        "currency": str(raw["currency"]) if raw.get("currency") else None,
        "vat": str(raw["vat"]) if raw.get("vat") else None,
    }
    amount = raw.get("total_eur", raw.get("total"))
    if isinstance(amount, (int, float)) and not isinstance(amount, bool):
        result["total"] = float(amount)
    else:
        result["total"] = None
    countries = raw.get("countries", raw.get("by_country", []))
    if isinstance(countries, dict):
        countries = [{"country": country, **value} for country, value in countries.items() if isinstance(value, dict)]
    if isinstance(countries, list):
        result["countries"] = [item for item in countries if isinstance(item, dict)]
        for country in result["countries"]:
            if "amount" in country and "total" not in country:
                country["total"] = country["amount"]
    objects = raw.get("objects", [])
    result["objects"] = [item for item in objects if isinstance(item, dict)] if isinstance(objects, list) else []
    return result


def _border_records(raw: Any) -> list[dict[str, Any]]:
    """Accept the documented list and harmless response wrappers."""
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if isinstance(raw, dict):
        for key in ("border_crossings", "crossings", "items", "data"):
            if key in raw:
                records = _border_records(raw[key])
                if records:
                    return records
    return []


def _border_crossings(raw: Any) -> list[dict[str, Any]]:
    """Keep only documented, display-safe crossing fields from the route."""
    crossings: list[dict[str, Any]] = []
    for item in _border_records(raw):
        crossing: dict[str, Any] = {
            "name": str(item["name"]) if item.get("name") is not None else None,
            "ppid": str(item["ppid"]) if item.get("ppid") is not None else None,
            "from_country": str(item["from_country"]) if item.get("from_country") is not None else None,
            "to_country": str(item["to_country"]) if item.get("to_country") is not None else None,
            "status": str(item["status"]) if item.get("status") is not None else None,
            "wait_min": item.get("wait_min") if isinstance(item.get("wait_min"), (int, float)) and not isinstance(item.get("wait_min"), bool) else None,
            "wait_at": str(item["wait_at"]) if item.get("wait_at") is not None else None,
            "wait_sides": [side for side in item.get("wait_sides", []) if isinstance(side, dict)] if isinstance(item.get("wait_sides", []), list) else [],
            "wait_notes": [str(note) for note in item.get("wait_notes", [])] if isinstance(item.get("wait_notes", []), list) else [],
            "source_url": safe_provider_link(item.get("source_url")),
            "wait_capped": bool(item.get("wait_capped", False)),
            "registration_required": bool(item.get("registration_required", False)),
            "registration_wait_minutes": item.get("registration_wait_minutes") if isinstance(item.get("registration_wait_minutes"), (int, float)) and not isinstance(item.get("registration_wait_minutes"), bool) else None,
            "registration_wait_source": str(item["registration_wait_source"]) if item.get("registration_wait_source") is not None else None,
            "registration_url": safe_provider_link(item.get("registration_url")),
        }
        for field, aliases in (("lat", ("lat", "latitude")), ("lon", ("lon", "lng", "longitude")), ("km_from_start", ("km_from_start", "distance_km"))):
            value = next((item.get(alias) for alias in aliases if item.get(alias) is not None), None)
            crossing[field] = float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None
        crossings.append(crossing)
    return crossings


def _ordered_countries(raw: Any) -> list[str] | None:
    """Return a route order only when the response explicitly provides one."""
    if isinstance(raw, list):
        result: list[str] = []
        for item in raw:
            value = item.get("country") if isinstance(item, dict) else item
            if isinstance(value, str) and value.strip():
                result.append(value.strip().upper())
        return result or None
    if isinstance(raw, dict):
        # Country maps are intentionally not treated as ordered data.
        return None
    return None


def _country_set(raw: Any) -> list[str]:
    """Return countries without claiming an order for map-shaped data."""
    if isinstance(raw, dict):
        return [str(key).strip().upper() for key in raw if str(key).strip()]
    if isinstance(raw, list):
        result = []
        for item in raw:
            value = item.get("country") if isinstance(item, dict) else item
            if isinstance(value, str) and value.strip():
                result.append(value.strip().upper())
        return list(dict.fromkeys(result))
    return []


def _fallback_border_data(route: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    """Infer only country-to-country transitions from explicit route order."""
    countries = _ordered_countries(route.get("countries"))
    if countries is None:
        countries = _ordered_countries(route.get("country_split"))
    if countries is not None and len(countries) > 1:
        return ([{
            "name": None, "ppid": None, "from_country": source, "to_country": target,
            "status": "country_sequence", "wait_min": None, "wait_at": None,
            "wait_sides": [], "wait_notes": [], "source_url": None, "wait_capped": False,
            "registration_required": False, "registration_wait_minutes": None,
            "registration_wait_source": None, "registration_url": None,
            "lat": None, "lon": None, "km_from_start": None,
            "inferred": True,
        } for source, target in zip(countries, countries[1:])], "ordered_country_sequence")
    if len(_country_set(route.get("countries"))) > 1 or len(_country_set(route.get("country_split"))) > 1:
        return [], "unordered_international"
    return [], "national_or_unknown"


def _route_points(raw: Any) -> tuple[RouteWaypoint, ...]:
    geojson = False
    if isinstance(raw, dict) and raw.get("type") == "LineString":
        raw = raw.get("coordinates")
        geojson = True
    if not isinstance(raw, list):
        raise ValueError("geometry is not a coordinate list")
    points = []
    for point in raw:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            raise ValueError("invalid geometry point")
        # Fixture arrays use latitude/longitude pairs. A marked GeoJSON
        # LineString follows RFC 7946 and therefore uses longitude/latitude.
        latitude, longitude = (point[1], point[0]) if geojson else (point[0], point[1])
        points.append(RouteWaypoint(float(latitude), float(longitude)))
    return tuple(points)


@dataclass(slots=True)
class NakordoniMotorhomeProvider:
    api_key: str | None = None
    live_enabled: bool = False
    timeout_s: float = 60.0
    connect_timeout_s: float = 10.0
    transport: Transport | None = None
    name: str = PROVIDER_NAME

    @property
    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(PROVIDER_NAME, False, True, True, True, "disabled" if not self.live_enabled else "unverified")

    async def calculate(self, request: RouteRequest) -> RouteResult:
        parameters = build_motorhome_parameters(request)
        if not self.api_key:
            raise ProviderError(
                "Nakordoni API key is missing; configure it in the integration options.",
                code="missing_api_key",
                status=401,
            )
        if not self.live_enabled or self.transport is None:
            raise ProviderError("Nakordoni Motorhome live routing is not configured", code="live_routing_disabled", status=403)
        try:
            payload = await self.transport(parameters)
        except TimeoutError as exc:
            raise ProviderError(
                f"Nakordoni request timed out after {self.timeout_s:.0f}s "
                f"(connect limit {self.connect_timeout_s:.0f}s); no automatic retry was made.",
                code="timeout",
            ) from exc
        except OSError as exc:
            raise ProviderError("Nakordoni network request failed", code="network_error", retryable=True) from exc
        except ValueError as exc:
            raise ProviderError("Nakordoni returned invalid JSON", code="invalid_response") from exc
        return self.normalize_fixture(payload, synthetic=False, request=request)

    def build_parameters(self, request: RouteRequest) -> dict[str, Any]:
        return build_motorhome_parameters(request)

    def normalize_fixture(self, payload: dict[str, Any], *, synthetic: bool = True, request: RouteRequest | None = None) -> RouteResult:
        if payload.get("ok") is not True:
            raise provider_error_from_payload(payload)
        try:
            data = payload["data"]
            route = data["route"]
            points = _route_points(route["geometry"])
            warning_items = list(route.get("warnings", []))
            vehicle = data.get("vehicle", {}) if isinstance(data.get("vehicle", {}), dict) else {}
            if vehicle.get("beta") and not any(item.get("code") == "motorhome_beta" for item in warning_items if isinstance(item, dict)):
                warning_items.append({"code": "motorhome_beta", "message": str(vehicle.get("beta_note", "Motorhome routing is in beta."))})
            warnings = tuple(
                RouteWarning(str(item.get("code", "provider_warning")), str(item.get("message", "Provider warning")))
                for item in warning_items if isinstance(item, dict)
            )
            concrete_crossings = _border_crossings(route.get("border_crossings", []))
            if concrete_crossings:
                border_crossings, border_state = concrete_crossings, "confirmed"
            else:
                border_crossings, border_state = _fallback_border_data(route)
            metadata = {
                "fixture": synthetic,
                "beta": True,
                "provider_mode": PROVIDER_NAME,
                "attribution_url": ATTRIBUTION_URL,
                "tolls": _toll_summary(route.get("tolls", data.get("tolls"))),
                "countries": route.get("countries", []),
                "country_split": route.get("country_split", []),
                "restriction_hits": route.get("restriction_hits", []),
                "border_crossings": border_crossings,
                "border_state": border_state,
                "border_data_source": "route.border_crossings" if border_state == "confirmed" else border_state,
                "vehicle": vehicle,
                "emission_class_requested": getattr(getattr(request, "vehicle", None), "emission_class", None),
                "emission_class_returned": vehicle.get("emission_class"),
                "tariff_basis_uncertain": not bool(vehicle.get("emission_class")),
                "attribution": data.get("attribution", ["Data by nakordoni.eu"]),
            }
            return RouteResult(PROVIDER_NAME, float(route["distance_m"]), int(route["duration_s"]), RouteGeometry(points), warnings, metadata, synthetic)
        except (KeyError, TypeError, ValueError, IndexError) as exc:
            raise ProviderError("Invalid Nakordoni Motorhome response", code="invalid_response") from exc


def provider_error_from_payload(payload: dict[str, Any]) -> ProviderError:
    error = payload.get("error") if isinstance(payload.get("error"), dict) else {}
    code = str(error.get("code", payload.get("code", "provider_error")))
    status = payload.get("status")
    status = int(status) if isinstance(status, int) else None
    messages = {
        "quota_exceeded": "Das Nakordoni-Routingkontingent ist ausgeschöpft.",
        "market_not_allowed": "Der Zielmarkt ist für diesen Nakordoni-Zugang nicht freigeschaltet.",
        "integration_product_not_allowed": "Der Nakordoni-Tarif erlaubt dieses Routingprodukt nicht.",
        "invalid_api_key": "Der Nakordoni-API-Schlüssel ist ungültig.",
        "invalid_grant": "Die Nakordoni-Autorisierung ist abgelaufen oder wurde widerrufen.",
    }
    if status == 429:
        code = code if code != "provider_error" else "quota_exceeded"
    if status in {500, 502, 503, 504}:
        retryable = True
    else:
        retryable = False
    reset_at = error.get("reset_at") or payload.get("headers", {}).get("X-Devapi-Reset") if isinstance(payload.get("headers"), dict) else error.get("reset_at")
    suffix = f" Reset: {reset_at}." if reset_at else ""
    return ProviderError(messages.get(code, str(error.get("message", "Nakordoni request failed"))) + suffix, code=code, status=status, retryable=retryable)
