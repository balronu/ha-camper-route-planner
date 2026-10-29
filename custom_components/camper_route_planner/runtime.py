"""Runtime assembly kept separate from the HA service wrapper."""

from __future__ import annotations

from datetime import datetime
import secrets
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
        self._diagnostic_counts = {"v2": 0, "v3": 0}
        self._request_diagnostic_token: str | None = None

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

    def diagnostics(self) -> dict[str, Any]:
        """Return only aggregate data; request diagnostics never enter HA diagnostics."""
        calls = sum(self._diagnostic_counts.values())
        return {
            "configured_provider": self.config_values.get(CONF_PROVIDER),
            "route_calls": dict(self._diagnostic_counts),
            "last_operation": None,
            "status": "available" if calls else "no_route_calculation",
        }

    def arm_request_diagnostics(self) -> str:
        """Arm one volatile, token-bound snapshot for the next route call."""
        token = secrets.token_urlsafe(32)
        self._request_diagnostic_token = token
        return token

    def _consume_request_diagnostics(self, token: Any) -> bool:
        """Consume the arm before any await so parallel calls cannot reuse it."""
        if not isinstance(token, str) or not secrets.compare_digest(token, self._request_diagnostic_token or ""):
            return False
        self._request_diagnostic_token = None
        return True

    def _request_snapshot(self, request: RouteRequest) -> dict[str, Any]:
        """Return the provider-bound request without credentials or headers."""
        provider = self.coordinator.provider
        parameters: dict[str, Any] = {}
        endpoint = None
        api_version = "v2"
        if isinstance(provider, NakordoniRouteAdapterV3):
            from .providers.nakordoni_v3 import build_v3_motorhome_parameters
            parameters = build_v3_motorhome_parameters(request)
            endpoint = provider.endpoint
            api_version = "v3"
        return {
            "api_version": api_version,
            "endpoint": endpoint,
            "parameters": parameters,
            "coordinates": {
                "origin": request.origin.as_dict(),
                "destination": request.destination.as_dict(),
                "waypoints": [point.as_dict() for point in request.waypoints],
            },
            "vehicle": {
                "profile_id": request.vehicle.profile_id,
                "vehicle_kind": request.vehicle.vehicle_kind,
                "height_m": request.vehicle.height_m,
                "width_m": request.vehicle.width_m,
                "length_m": request.vehicle.length_m,
                "gross_weight_kg": request.vehicle.gross_weight_kg,
                "axles": request.vehicle.axles,
                "axle_load_kg": request.vehicle.axle_load_kg,
                "emission_class": request.vehicle.emission_class,
            },
            "units": {"coordinates": "decimal_degrees", "distance": "m", "duration": "s", "vehicle_dimensions": "m", "vehicle_weight": "kg"},
            "routing_options": {
                "traffic": request.traffic,
                "alternatives": request.alternatives,
                "geometry": request.geometry_format,
                "avoid": list(request.avoid),
                "route_type": request.route_type,
                "depart_at": request.depart_at.isoformat() if request.depart_at else None,
                "arrive_at": request.arrive_at.isoformat() if request.arrive_at else None,
            },
        }

    @staticmethod
    def _request_diagnostic(snapshot: dict[str, Any], result: Any) -> dict[str, Any]:
        transport = result.metadata.get("transport") if isinstance(result.metadata.get("transport"), dict) else {}
        return {
            "request": snapshot,
            "response": {
                "http_status": transport.get("status"),
                "routing_source": transport.get("route_source") or result.metadata.get("routing_source"),
                "cache_hit": bool(result.metadata.get("cache_hit", False)),
                "retry_count": max(int(transport.get("attempts", 1)) - 1, 0),
                "distance_m": result.distance_m,
                "duration_s": result.duration_s,
                "response_fields": {"distance": "distance_m", "duration": "duration_s"},
            },
        }

    def _record_diagnostic(
        self,
        *,
        api_version: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        transport = metadata.get("transport") if isinstance(metadata, dict) and isinstance(metadata.get("transport"), dict) else {}
        attempts = transport.get("attempts")
        attempts = int(attempts) if isinstance(attempts, (int, float)) and attempts >= 1 else 1
        self._diagnostic_counts[api_version] = self._diagnostic_counts.get(api_version, 0) + attempts

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
        diagnostic_snapshot = self._request_snapshot(request) if self._consume_request_diagnostics(data.get("diagnostic_token")) else None
        try:
            result = await self.coordinator.async_calculate_manual(
                request, force_refresh=bool(data.get("force_refresh", False))
            )
        except ProviderError as exc:
            api_version = "v3" if self.config_values.get(CONF_PROVIDER) == PROVIDER_NAKORDONI_MOTORHOME_V3 else "v2"
            self._record_diagnostic(api_version=api_version)
            raise
        api_version = str(result.metadata.get("api_version") or ("v3" if self.config_values.get(CONF_PROVIDER) == PROVIDER_NAKORDONI_MOTORHOME_V3 else "v2"))
        self._record_diagnostic(api_version=api_version, metadata=result.metadata)
        return {
            "provider": result.provider, "synthetic": result.synthetic, "distance_m": result.distance_m,
            "duration_s": result.duration_s, "warnings": [warning.message for warning in result.warnings],
            "geometry": result.geometry.as_dict(), "metadata": result.metadata,
            "origin": request.origin.as_dict(), "destination": request.destination.as_dict(),
            "waypoints": [point.as_dict() for point in request.waypoints],
            "route_options": result.metadata.get("request_options", {}),
            "beta": result.metadata.get("beta", False), "attribution_url": result.metadata.get("attribution_url"),
            "created_at": result.created_at.isoformat() if result.created_at else None,
            **({"request_diagnostic": self._request_diagnostic(diagnostic_snapshot, result)} if diagnostic_snapshot else {}),
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
        try:
            estimate = await NakordoniMotorhomeProvider(
                api_key=configured.api_key, live_enabled=True, transport=v2_transport
            ).calculate(request)
        except ProviderError as exc:
            self._record_diagnostic(api_version="v2")
            raise
        v2_tolls = estimate.metadata.get("tolls")
        if not isinstance(v2_tolls, dict):
            raise ValueError("v2 returned no toll data")
        self._record_diagnostic(api_version="v2", metadata=estimate.metadata)
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
