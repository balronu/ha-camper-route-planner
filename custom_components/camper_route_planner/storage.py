"""Versioned Home Assistant Store boundary with an offline test backend."""

from __future__ import annotations

import copy
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Protocol

from .const import STORAGE_VERSION
from .models import RouteResult, RouteWaypoint, VehicleProfile


_SECRET_FIELD_MARKERS = (
    "api_key",
    "apikey",
    "authorization",
    "client_secret",
    "password",
    "secret",
    "token",
)


def _contains_secret_field(value: Any) -> bool:
    """Reject credential-shaped fields before accepting browser route data."""
    if isinstance(value, dict):
        for key, nested in value.items():
            normalized = str(key).lower().replace("-", "_")
            if any(marker in normalized for marker in _SECRET_FIELD_MARKERS):
                return True
            if _contains_secret_field(nested):
                return True
    elif isinstance(value, (list, tuple)):
        return any(_contains_secret_field(item) for item in value)
    return False


class AsyncStore(Protocol):
    async def async_load(self) -> dict[str, Any] | None: ...
    async def async_save(self, data: dict[str, Any]) -> None: ...


def migrate_data(data: dict[str, Any] | None) -> dict[str, Any]:
    """Apply additive migrations without touching credentials."""
    current = copy.deepcopy(data or {})
    version = int(current.get("version", 1))
    if version == 1:
        current.setdefault("profiles", {})
        current.setdefault("routes", {})
        current["version"] = 2
    if current.get("version") != STORAGE_VERSION:
        raise ValueError(f"unsupported storage version: {current.get('version')}")
    current.setdefault("profiles", {})
    current.setdefault("routes", {})
    return current


class JsonFileStore:
    """Small atomic JSON store used only by offline tests/tools."""

    def __init__(self, path: Path) -> None:
        self.path = path

    async def async_load(self) -> dict[str, Any] | None:
        if not self.path.exists():
            return None
        return json.loads(self.path.read_text(encoding="utf-8"))

    async def async_save(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, sort_keys=True), encoding="utf-8")
        temporary.replace(self.path)


class MemoryStore:
    """Deterministic in-memory store for unit tests."""

    def __init__(self, initial: dict[str, Any] | None = None) -> None:
        self.data = copy.deepcopy(initial)
        self.save_count = 0

    async def async_load(self) -> dict[str, Any] | None:
        return copy.deepcopy(self.data)

    async def async_save(self, data: dict[str, Any]) -> None:
        self.data = copy.deepcopy(data)
        self.save_count += 1


class ProfileRouteStore:
    """Domain repository backed by an HA Store-compatible object."""

    def __init__(self, store: AsyncStore) -> None:
        self._store = store
        self._data: dict[str, Any] | None = None

    async def async_load(self) -> None:
        self._data = migrate_data(await self._store.async_load())
        await self._store.async_save(self._data)

    @property
    def data(self) -> dict[str, Any]:
        if self._data is None:
            raise RuntimeError("store has not been loaded")
        return self._data

    async def async_save_profile(self, profile: VehicleProfile) -> None:
        self.data["profiles"][profile.profile_id] = profile.as_dict()
        await self._store.async_save(self.data)

    def profiles(self) -> tuple[VehicleProfile, ...]:
        return tuple(VehicleProfile.from_dict(item) for item in self.data["profiles"].values())

    def routes_for_profile(self, profile_id: str) -> tuple[dict[str, Any], ...]:
        """Return saved routes referencing a profile before a destructive action."""
        return tuple(
            copy.deepcopy(route)
            for route in self.data["routes"].values()
            if route.get("profile_id") == profile_id
        )

    async def async_delete_profile(self, profile_id: str, *, delete_routes: bool = False) -> tuple[str, ...]:
        """Delete one profile only after explicit route-reference consent."""
        if profile_id not in self.data["profiles"]:
            return ()
        route_ids = tuple(route["route_id"] for route in self.routes_for_profile(profile_id))
        if route_ids and not delete_routes:
            raise ValueError("profile_has_routes")
        del self.data["profiles"][profile_id]
        for route_id in route_ids:
            self.data["routes"].pop(route_id, None)
        await self._store.async_save(self.data)
        return route_ids

    async def async_save_route(self, route_id: str, request: Any, result: RouteResult, name: str = "manual route") -> None:
        self.data["routes"][route_id] = {
            "route_id": route_id,
            "name": name.strip() or "manual route",
            "provider": result.provider,
            "distance_m": result.distance_m,
            "duration_s": result.duration_s,
            "geometry": result.geometry.as_dict(),
            "synthetic": result.synthetic,
            "profile_id": request.vehicle.profile_id,
            "origin": request.origin.as_dict(),
            "destination": request.destination.as_dict(),
            "waypoints": [point.as_dict() for point in request.waypoints],
            "warnings": [asdict(warning) for warning in result.warnings],
            "metadata": copy.deepcopy(result.metadata),
        }
        await self._store.async_save(self.data)

    async def async_save_route_record(self, record: dict[str, Any]) -> str:
        """Persist an editor-safe route record without accepting credentials."""
        route_id = str(record.get("route_id") or "")
        if not route_id or not record.get("geometry"):
            raise ValueError("route_id and geometry are required")
        if _contains_secret_field(record):
            raise ValueError("route record contains a forbidden credential field")
        allowed = {"route_id", "name", "provider", "distance_m", "duration_s", "geometry", "synthetic", "profile_id", "origin", "destination", "waypoints", "warnings", "metadata", "created_at"}
        self.data["routes"][route_id] = {key: value for key, value in record.items() if key in allowed}
        await self._store.async_save(self.data)
        return route_id

    def routes(self) -> tuple[dict[str, Any], ...]:
        return tuple(copy.deepcopy(item) for item in self.data["routes"].values())

    def route(self, route_id: str) -> dict[str, Any] | None:
        item = self.data["routes"].get(route_id)
        return copy.deepcopy(item) if item else None

    async def async_delete_route(self, route_id: str) -> bool:
        if route_id not in self.data["routes"]:
            return False
        del self.data["routes"][route_id]
        await self._store.async_save(self.data)
        return True
