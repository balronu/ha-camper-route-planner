"""Bounded, provider-neutral normalization for optional route POIs."""

from __future__ import annotations

import hashlib
import math
from typing import Any

MAX_POIS_PER_CATEGORY = 50
MAX_TEXT_LENGTH = 160


def build_poi_parameters(*, parking: bool = False, fuel: bool = False, fuel_type: str = "diesel") -> dict[str, str]:
    """Return only explicitly requested, documented POI query parameters."""
    include = [category for category, enabled in (("parking", parking), ("fuel", fuel)) if enabled]
    if not include:
        return {}
    if fuel and fuel_type != "diesel":
        raise ValueError("only diesel POIs are currently supported")
    result = {"include": ",".join(include)}
    if fuel:
        result["fuel"] = "diesel"
    return result


def _number(value: Any, *, minimum: float = 0.0, maximum: float = 1_000_000.0) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and minimum <= number <= maximum else None


def _text(value: Any, *, maximum: int = MAX_TEXT_LENGTH) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:maximum] if value else None


def _coordinates(item: dict[str, Any]) -> tuple[float, float] | None:
    lat = _number(item.get("lat", item.get("latitude")), minimum=-90, maximum=90)
    lon = _number(item.get("lon", item.get("lng", item.get("longitude"))), minimum=-180, maximum=180)
    if lat is None or lon is None or (lat == 0 and lon == 0):
        return None
    return lat, lon


def _stable_id(category: str, item: dict[str, Any], lat: float, lon: float) -> str:
    source = "|".join((category, _text(item.get("id")) or "", _text(item.get("name")) or "", f"{lat:.5f}", f"{lon:.5f}"))
    return f"{category}-{hashlib.sha256(source.encode()).hexdigest()[:16]}"


def _prices(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    result: list[dict[str, Any]] = []
    for item in raw[:8]:
        if not isinstance(item, dict):
            continue
        price = _number(item.get("price"), minimum=0, maximum=20)
        fuel_type = _text(item.get("fuel_type"), maximum=32)
        currency = _text(item.get("currency"), maximum=8)
        if price is None or not fuel_type or not currency:
            continue
        row: dict[str, Any] = {"fuel_type": fuel_type, "price": price, "currency": currency}
        if isinstance(item.get("stale"), bool):
            row["stale"] = item["stale"]
        result.append(row)
    return result


def normalize_pois(data: dict[str, Any], *, requested: tuple[str, ...] = (), route_distance_m: float | None = None) -> dict[str, Any]:
    """Normalize documented parking/fuel arrays without inventing metadata."""
    # Route distance is already validated by the route adapter and can exceed
    # the per-POI numeric bound used elsewhere in this module.  Keep the
    # conversion safe for long routes and for an absent/invalid optional value.
    normalized_route_distance = _number(route_distance_m, minimum=0, maximum=float("inf"))
    route_km = normalized_route_distance / 1000 if normalized_route_distance is not None else None

    def records(category: str, source: Any) -> list[dict[str, Any]]:
        if not isinstance(source, list):
            return []
        output: list[dict[str, Any]] = []
        for raw in source[:MAX_POIS_PER_CATEGORY]:
            if not isinstance(raw, dict):
                continue
            coordinates = _coordinates(raw)
            km = _number(raw.get("km_from_start"), minimum=0, maximum=1_000_000)
            if coordinates is None or km is None or (route_km is not None and km > route_km + 100):
                continue
            lat, lon = coordinates
            item: dict[str, Any] = {
                "id": _stable_id(category, raw, lat, lon),
                "category": category,
                "name": _text(raw.get("name")) or ("Parking" if category == "parking" else "Fuel station"),
                "latitude": lat,
                "longitude": lon,
                "km_from_start": km,
            }
            for key in ("country", "type", "brand"):
                value = _text(raw.get(key), maximum=64)
                if value:
                    item[key] = value
            for key in ("distance_from_route_km", "detour_km"):
                value = _number(raw.get(key), minimum=0, maximum=1000)
                if value is not None:
                    item[key] = value
            if category == "parking":
                capacity = _number(raw.get("capacity"), minimum=0, maximum=100_000)
                if capacity is not None:
                    item["capacity"] = capacity
                if isinstance(raw.get("secure"), bool):
                    item["secure"] = raw["secure"]
                amenities = raw.get("amenities")
                if isinstance(amenities, list):
                    item["amenities"] = [value for value in (_text(entry, maximum=64) for entry in amenities[:12]) if value]
                opening_hours = _text(raw.get("opening_hours"), maximum=256)
                if opening_hours:
                    item["opening_hours"] = opening_hours
            else:
                prices = _prices(raw.get("prices"))
                if prices:
                    item["prices"] = prices
                updated = _text(raw.get("price_updated_at"), maximum=64)
                if updated:
                    item["price_updated_at"] = updated
            output.append(item)
        return sorted(output, key=lambda entry: (entry["km_from_start"], entry["id"]))

    return {
        "requested": list(requested),
        "parking": records("parking", data.get("parkings")),
        "fuel": records("fuel", data.get("fuel_stations")),
    }
