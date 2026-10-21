"""Runtime assembly kept separate from the HA service wrapper."""

from __future__ import annotations

from typing import Any

from .const import CONF_API_KEY, CONF_PROVIDER, PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME
from .coordinator import RouteCoordinator
from .models import ProviderError, RouteRequest, RouteWaypoint
from .map_provider import build_map_config
from .providers.mock import MockRoutingProvider
from .providers.nakordoni import NakordoniRoutingProvider
from .providers.nakordoni_motorhome import NakordoniMotorhomeProvider
from .storage import ProfileRouteStore
from .geocoding import GeoapifyGeocoder


def build_routing_provider(values: dict[str, Any], *, transport: Any = None):
    """Build exactly the provider explicitly selected in entry data/options."""
    provider_name = values.get(CONF_PROVIDER)
    if provider_name == PROVIDER_NAKORDONI_MOTORHOME:
        return NakordoniMotorhomeProvider(api_key=values.get(CONF_API_KEY), live_enabled=False, transport=transport)
    if provider_name == PROVIDER_NAKORDONI:
        return NakordoniRoutingProvider(api_key=values.get("api_key"), live_enabled=False)
    if provider_name == PROVIDER_MOCK:
        return MockRoutingProvider()
    if provider_name is None:
        raise ProviderError(
            "No routing provider is configured; select Mock or Nakordoni.",
            code="provider_not_configured",
        )
    raise ProviderError(
        f"Unsupported routing provider: {provider_name}",
        code="provider_not_supported",
    )


class RuntimeData:
    """One config-entry runtime; no background refresh is created."""

    def __init__(self, coordinator: RouteCoordinator, store: ProfileRouteStore, config_values: dict[str, Any] | None = None, geocoder: GeoapifyGeocoder | None = None) -> None:
        self.coordinator = coordinator
        self.store = store
        self.config_values = config_values or {}
        self.geocoder = geocoder

    @classmethod
    def from_config_entry(cls, hass: Any, entry: Any) -> "RuntimeData":
        try:
            from homeassistant.helpers.storage import Store
            store_backend = Store(hass, 2, f"camper_route_planner.{entry.entry_id}")
        except (ImportError, AttributeError):
            from .storage import MemoryStore
            store_backend = MemoryStore()
        store = ProfileRouteStore(store_backend)
        # Options Flow values override the original entry data.  Provider
        # selection must use the same merged snapshot as the secret status in
        # the flow; otherwise an options change can leave a stale provider
        # instance running while the new value appears saved in HA.
        values = {**entry.data, **getattr(entry, "options", {})}
        transport = None
        if values.get(CONF_API_KEY):
            # The session is owned by Home Assistant. The provider remains
            # explicitly disabled until Nakordoni publishes and approves the
            # motorhome contract; constructing this transport performs no IO.
            from homeassistant.helpers.aiohttp_client import async_get_clientsession
            from .providers.http_transport import NakordoniHttpTransport

            transport = NakordoniHttpTransport(async_get_clientsession(hass), str(values[CONF_API_KEY]))
        provider = build_routing_provider(values, transport=transport)
        geocoder = None
        if values.get("geocoding_api_key"):
            from homeassistant.helpers.aiohttp_client import async_get_clientsession
            geocoder = GeoapifyGeocoder(str(values["geocoding_api_key"]), session=async_get_clientsession(hass))
        return cls(RouteCoordinator(provider, store), store, values, geocoder)

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
