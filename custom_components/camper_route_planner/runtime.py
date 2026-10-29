"""Runtime assembly kept separate from the HA service wrapper."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from .const import CONF_API_KEY, CONF_PROVIDER, PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME, PROVIDER_NAKORDONI_MOTORHOME_V3
from .coordinator import RouteCoordinator
from .models import ProviderError, RouteRequest, RouteWaypoint
from .map_provider import build_map_config
from .providers.mock import MockRoutingProvider
from .providers.nakordoni import NakordoniRoutingProvider
from .providers.nakordoni_motorhome import ROUTE_ENDPOINT, NakordoniMotorhomeProvider
from .providers.nakordoni_v3 import NakordoniRouteAdapterV3, V3_ROUTE_ENDPOINT
from .providers.usage import normalize_usage
from .storage import ProfileRouteStore
from .geocoding import GeoapifyGeocoder


def build_routing_provider(values: dict[str, Any], *, transport: Any = None):
    """Build exactly the provider explicitly selected in entry data/options."""
    provider_name = values.get(CONF_PROVIDER)
    if provider_name == PROVIDER_NAKORDONI_MOTORHOME:
        return NakordoniMotorhomeProvider(api_key=values.get(CONF_API_KEY), live_enabled=True, transport=transport)
    if provider_name == PROVIDER_NAKORDONI_MOTORHOME_V3:
        return NakordoniRouteAdapterV3(api_key=values.get(CONF_API_KEY), transport=transport)
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
        self.usage_transport = None

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
        usage_transport = None
        if values.get(CONF_API_KEY):
            # The session and credential remain inside Home Assistant.
            # Constructing either transport performs no IO; route use still
            # requires an explicit manual calculate action.
            from homeassistant.helpers.aiohttp_client import async_get_clientsession
            from .providers.http_transport import NakordoniHttpTransport, NakordoniUsageTransport

            transport_kwargs = {
                "session": async_get_clientsession(hass),
                "api_key": str(values[CONF_API_KEY]),
                "timeout_s": 60.0,
                "connect_timeout_s": 10.0,
            }
            if values.get(CONF_PROVIDER) == PROVIDER_NAKORDONI_MOTORHOME_V3:
                transport_kwargs["endpoint"] = V3_ROUTE_ENDPOINT
            transport = NakordoniHttpTransport(
                **transport_kwargs,
            )
            usage_transport = NakordoniUsageTransport(async_get_clientsession(hass), str(values[CONF_API_KEY]))
        provider = build_routing_provider(values, transport=transport)
        geocoder = None
        if values.get("geocoding_api_key"):
            from homeassistant.helpers.aiohttp_client import async_get_clientsession
            geocoder = GeoapifyGeocoder(str(values["geocoding_api_key"]), session=async_get_clientsession(hass))
        runtime = cls(RouteCoordinator(provider, store), store, values, geocoder)
        runtime.usage_transport = usage_transport
        return runtime

    def map_config(self) -> dict[str, Any]:
        return build_map_config(self.config_values).as_dict()

    async def async_load(self) -> None:
        await self.store.async_load()

    async def async_nakordoni_usage(self) -> dict[str, Any]:
        """Run one explicit, secret-free account check; never route or retry."""
        if self.usage_transport is None:
            raise ValueError("Nakordoni API key is not configured")
        payload = await self.usage_transport()
        if payload.get("ok") is not True:
            raise ValueError("Nakordoni account usage is unavailable")
        return normalize_usage(payload).as_public_dict(status=payload.get("status"))

    async def async_calculate_service(self, data: dict[str, Any]) -> dict[str, Any]:
        profiles = {profile.profile_id: profile for profile in self.store.profiles()}
        profile = profiles.get(data["profile_id"])
        if profile is None:
            raise ValueError("unknown vehicle profile")
        def _time(name: str):
            raw = data.get(name)
            if not raw:
                return None
            value = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            if value.tzinfo is None:
                raise ValueError(f"{name} must include a timezone")
            return value
        avoid = data.get("avoid", [])
        if isinstance(avoid, str):
            avoid = [item.strip() for item in avoid.split(",") if item.strip()]
        request = RouteRequest(
            RouteWaypoint.from_dict(data["origin"]), RouteWaypoint.from_dict(data["destination"]), profile,
            tuple(RouteWaypoint.from_dict(item) for item in data.get("via", [])),
            alternatives=int(data.get("alternatives", 0)), traffic=data.get("traffic", "off"),
            depart_at=_time("depart_at"), avoid=tuple(avoid), route_type=data.get("route_type", "fastest"),
            arrive_at=_time("arrive_at"),
        )
        result = await self.coordinator.async_calculate_manual(
            request, force_refresh=bool(data.get("force_refresh", False))
        )
        return {
            "provider": result.provider, "synthetic": result.synthetic, "distance_m": result.distance_m,
            "duration_s": result.duration_s, "warnings": [warning.message for warning in result.warnings],
            "geometry": result.geometry.as_dict(), "metadata": result.metadata,
            "origin": request.origin.as_dict(), "destination": request.destination.as_dict(),
            "waypoints": [point.as_dict() for point in request.waypoints],
            "route_options": result.metadata.get("request_options", {}),
            "beta": result.metadata.get("beta", False), "attribution_url": result.metadata.get("attribution_url"),
            "created_at": result.created_at.isoformat() if result.created_at else None,
        }

    async def async_estimate_tolls_v2(self, data: dict[str, Any]) -> dict[str, Any]:
        """Explicitly calculate a separate v2 toll estimate for a v3 result."""
        current = data.get("current_result") if isinstance(data.get("current_result"), dict) else {}
        metadata = current.get("metadata") if isinstance(current.get("metadata"), dict) else {}
        if self.config_values.get(CONF_PROVIDER) != PROVIDER_NAKORDONI_MOTORHOME_V3 or metadata.get("api_version") != "v3":
            raise ValueError("v2 toll estimates require an executed v3 route")
        tolls = metadata.get("tolls") if isinstance(metadata.get("tolls"), dict) else {}
        if tolls.get("complete") is not False:
            raise ValueError("a v2 estimate is only offered when v3 toll data is incomplete")
        profiles = {profile.profile_id: profile for profile in self.store.profiles()}
        profile = profiles.get(data.get("profile_id"))
        if profile is None:
            raise ValueError("unknown vehicle profile")

        def _time(name: str):
            raw = data.get(name)
            if not raw:
                return None
            value = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            if value.tzinfo is None:
                raise ValueError(f"{name} must include a timezone")
            return value

        avoid = data.get("avoid", [])
        if isinstance(avoid, str):
            avoid = [item.strip() for item in avoid.split(",") if item.strip()]
        request = RouteRequest(
            RouteWaypoint.from_dict(data["origin"]), RouteWaypoint.from_dict(data["destination"]), profile,
            tuple(RouteWaypoint.from_dict(item) for item in data.get("via", [])),
            alternatives=int(data.get("alternatives", 0)), traffic=data.get("traffic", "off"),
            depart_at=_time("depart_at"), avoid=tuple(avoid), route_type=data.get("route_type", "fastest"),
            arrive_at=_time("arrive_at"),
        )
        configured = self.coordinator.provider
        transport = getattr(configured, "transport", None)
        if transport is None or not getattr(configured, "api_key", None):
            raise ValueError("Nakordoni API key is not configured")
        from dataclasses import replace
        v2_transport = replace(transport, endpoint=ROUTE_ENDPOINT)
        estimate = await NakordoniMotorhomeProvider(
            api_key=configured.api_key, live_enabled=True, transport=v2_transport
        ).calculate(request)
        v2_tolls = estimate.metadata.get("tolls")
        if not isinstance(v2_tolls, dict):
            raise ValueError("v2 returned no toll data")
        distance = current.get("distance_m")
        duration = current.get("duration_s")
        comparable = (
            isinstance(distance, (int, float)) and isinstance(duration, (int, float))
            and abs(float(distance) - estimate.distance_m) <= max(1000.0, float(distance) * 0.01)
            and abs(float(duration) - estimate.duration_s) <= max(300.0, float(duration) * 0.05)
        )
        return {
            "api_version": "v2",
            "provider": estimate.provider,
            "source_api": "v2",
            "tolls": v2_tolls,
            "route_distance_m": estimate.distance_m,
            "route_duration_s": estimate.duration_s,
            "comparable_route": comparable,
            "note": "Separate v2 estimate; it is not merged into the v3 route result.",
            "routing_source": estimate.metadata.get("routing_source"),
            "transport": estimate.metadata.get("transport", {}),
        }
