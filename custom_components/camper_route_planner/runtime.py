"""Runtime assembly kept separate from the HA service wrapper."""

from __future__ import annotations

from typing import Any

from .const import CONF_PROVIDER, PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME
from .coordinator import RouteCoordinator
from .models import RouteRequest, RouteWaypoint
from .map_provider import build_map_config
from .providers.mock import MockRoutingProvider
from .providers.nakordoni import NakordoniRoutingProvider
from .providers.nakordoni_motorhome import NakordoniMotorhomeProvider
from .storage import ProfileRouteStore


class RuntimeData:
    """One config-entry runtime; no background refresh is created."""

    def __init__(self, coordinator: RouteCoordinator, store: ProfileRouteStore, config_values: dict[str, Any] | None = None) -> None:
        self.coordinator = coordinator
        self.store = store
        self.config_values = config_values or {}

    @classmethod
    def from_config_entry(cls, hass: Any, entry: Any) -> "RuntimeData":
        try:
            from homeassistant.helpers.storage import Store
            store_backend = Store(hass, 2, f"camper_route_planner.{entry.entry_id}")
        except (ImportError, AttributeError):
            from .storage import MemoryStore
            store_backend = MemoryStore()
        store = ProfileRouteStore(store_backend)
        provider_name = entry.data.get(CONF_PROVIDER, PROVIDER_MOCK)
        if provider_name == PROVIDER_NAKORDONI_MOTORHOME:
            provider = NakordoniMotorhomeProvider(api_key=entry.data.get("api_key"), live_enabled=False)
        elif provider_name == PROVIDER_NAKORDONI:
            provider = NakordoniRoutingProvider(api_key=entry.data.get("api_key"), live_enabled=False)
        else:
            provider = MockRoutingProvider()
        return cls(RouteCoordinator(provider, store), store, {**entry.data, **getattr(entry, "options", {})})

    def map_config(self) -> dict[str, Any]:
        return build_map_config(self.config_values).as_dict()

    async def async_load(self) -> None:
        await self.store.async_load()

    async def async_calculate_service(self, data: dict[str, Any]) -> dict[str, Any]:
        profiles = {profile.profile_id: profile for profile in self.store.profiles()}
        profile = profiles.get(data["profile_id"])
        if profile is None:
            raise ValueError("unknown vehicle profile")
        request = RouteRequest(RouteWaypoint.from_dict(data["origin"]), RouteWaypoint.from_dict(data["destination"]), profile, tuple(RouteWaypoint.from_dict(item) for item in data.get("via", [])))
        result = await self.coordinator.async_calculate_manual(request)
        return {
            "provider": result.provider, "synthetic": result.synthetic, "distance_m": result.distance_m,
            "duration_s": result.duration_s, "warnings": [warning.message for warning in result.warnings],
            "geometry": result.geometry.as_dict(), "metadata": result.metadata,
            "beta": result.metadata.get("beta", False), "attribution_url": result.metadata.get("attribution_url"),
        }
