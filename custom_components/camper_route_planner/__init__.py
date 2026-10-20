"""Camper Route Planner integration entry point.

Phase 2A deliberately contains no polling, listeners, GPS hooks, or automatic
route calculation. The service is registered only as an explicit action.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .const import DOMAIN, SERVICE_CALCULATE_ROUTE

FRONTEND_URL = f"/{DOMAIN}/camper-route-planner-card.js"
FRONTEND_FILE = Path(__file__).parent / "frontend" / "camper-route-planner-card.js"

try:
    from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
    from homeassistant.helpers import config_validation as cv
    import voluptuous as vol

    SERVICE_SCHEMA = vol.Schema({
        vol.Required("entry_id"): cv.string,
        vol.Required("profile_id"): cv.string,
        vol.Required("origin"): dict,
        vol.Required("destination"): dict,
        vol.Optional("via", default=[]): list,
        vol.Optional("route_name", default="manual route"): cv.string,
    })

    async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
        """Set up the domain and expose one explicit response service."""
        del config
        domain_data = hass.data.setdefault(DOMAIN, {})
        if not domain_data.get("_frontend_registered"):
            from homeassistant.components.frontend import add_extra_js_url
            from homeassistant.components.http import StaticPathConfig

            await hass.http.async_register_static_paths(
                [StaticPathConfig(FRONTEND_URL, str(FRONTEND_FILE), True)]
            )
            add_extra_js_url(hass, f"{FRONTEND_URL}?v=0.1.0-alpha.1")
            domain_data["_frontend_registered"] = True
        if not domain_data.get("_websocket_registered"):
            from .websocket_api import async_register as async_register_websocket
            async_register_websocket(hass)
            domain_data["_websocket_registered"] = True

        async def handle_service(call: ServiceCall) -> dict[str, Any]:
            entry_id = call.data["entry_id"]
            runtime = hass.data[DOMAIN].get(entry_id)
            if runtime is None:
                raise ValueError("Camper Route Planner entry is not loaded")
            return await runtime.async_calculate_service(call.data)

        hass.services.async_register(
            DOMAIN,
            SERVICE_CALCULATE_ROUTE,
            handle_service,
            schema=SERVICE_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        return True

    async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
        """Load one config entry without starting a refresh loop."""
        from .runtime import RuntimeData

        runtime = RuntimeData.from_config_entry(hass, entry)
        await runtime.async_load()
        hass.data.setdefault(DOMAIN, {})[entry.entry_id] = runtime
        return True

    async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
        hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
        if not hass.config_entries.async_loaded_entries(DOMAIN):
            from homeassistant.components.frontend import remove_extra_js_url

            remove_extra_js_url(hass, f"{FRONTEND_URL}?v=0.1.0-alpha.1")
            hass.data.get(DOMAIN, {})["_frontend_registered"] = False
        return True

except ImportError:  # pragma: no cover - HA-only wrapper.
    HomeAssistant = Any  # type: ignore[misc,assignment]

    async def async_setup(hass: Any, config: dict[str, Any]) -> bool:
        del hass, config
        return True

    async def async_setup_entry(hass: Any, entry: Any) -> bool:
        del hass, entry
        return True

    async def async_unload_entry(hass: Any, entry: Any) -> bool:
        del hass, entry
        return True
