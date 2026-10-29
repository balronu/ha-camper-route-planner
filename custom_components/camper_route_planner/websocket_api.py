"""Editor-safe WebSocket commands for the Lovelace card."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

try:
    import voluptuous as vol
    from homeassistant.components import websocket_api
    from .const import DEFAULT_ZOE_TRACKER, DOMAIN
    from .gpx import GpxExportError, export_gpx, filename_for_route
    from .geocoding import GeocodingError
    from .models import ProviderError

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/list_entries"})
    @websocket_api.async_response
    async def ws_list_entries(hass, connection, msg) -> None:
        """Expose only safe config-entry metadata for card discovery."""
        connection.send_result(msg["id"], {"entries": [
            {"entry_id": entry.entry_id, "title": entry.title, "state": entry.state.value}
            for entry in hass.config_entries.async_entries(DOMAIN)
        ]})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/nakordoni_usage", vol.Required("entry_id"): str})
    @websocket_api.async_response
    async def ws_nakordoni_usage(hass, connection, msg) -> None:
        """Run one admin-only, integration-owned, secret-free usage check."""
        user = getattr(connection, "user", None)
        if user is None or not bool(getattr(user, "is_admin", False)):
            connection.send_error(msg["id"], "admin_required", "Administrator privileges are required")
            return
        runtime = hass.data.get(DOMAIN, {}).get(msg["entry_id"])
        if runtime is None:
            connection.send_error(msg["id"], "not_found", "Config entry is not loaded")
            return
        try:
            result = await runtime.async_nakordoni_usage()
        except (OSError, TimeoutError, ValueError):
            connection.send_error(msg["id"], "usage_unavailable", "Nakordoni account usage is unavailable")
            return
        connection.send_result(msg["id"], result)

    @websocket_api.websocket_command({
        vol.Required("type"): "camper_route_planner/estimate_tolls_v2",
        vol.Required("entry_id"): str,
        vol.Required("profile_id"): str,
        vol.Required("origin"): dict,
        vol.Required("destination"): dict,
        vol.Required("current_result"): dict,
        vol.Optional("via", default=[]): list,
        vol.Optional("traffic", default="off"): vol.In({"off", "live", "forecast"}),
        vol.Optional("alternatives", default=0): vol.All(vol.Coerce(int), vol.Range(min=0, max=2)),
        vol.Optional("avoid", default=[]): list,
        vol.Optional("route_type", default="fastest"): vol.In({"fastest", "eco"}),
        vol.Optional("depart_at"): str,
        vol.Optional("arrive_at"): str,
    })
    @websocket_api.async_response
    async def ws_estimate_tolls_v2(hass, connection, msg) -> None:
        runtime = hass.data.get(DOMAIN, {}).get(msg["entry_id"])
        if runtime is None:
            connection.send_error(msg["id"], "not_found", "Config entry is not loaded")
            return
        try:
            result = await runtime.async_estimate_tolls_v2(msg)
        except (ValueError, ProviderError) as exc:
            connection.send_error(msg["id"], "estimate_unavailable", str(exc))
            return
        connection.send_result(msg["id"], result)

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/list_profiles", vol.Required("entry_id"): str})
    @websocket_api.async_response
    async def ws_list_profiles(hass, connection, msg) -> None:
        runtime = hass.data.get("camper_route_planner", {}).get(msg["entry_id"])
        provider = ""
        if runtime:
            provider = str(runtime.config_values.get("provider", ""))
        connection.send_result(msg["id"], {"profiles": [profile.as_dict() for profile in runtime.store.profiles()] if runtime else [], "provider": provider})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/list_routes", vol.Required("entry_id"): str})
    @websocket_api.async_response
    async def ws_list_routes(hass, connection, msg) -> None:
        runtime = hass.data.get("camper_route_planner", {}).get(msg["entry_id"])
        connection.send_result(msg["id"], {"routes": list(runtime.store.routes()) if runtime else []})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/map_config", vol.Required("entry_id"): str})
    @websocket_api.async_response
    async def ws_map_config(hass, connection, msg) -> None:
        runtime = hass.data.get("camper_route_planner", {}).get(msg["entry_id"])
        connection.send_result(msg["id"], runtime.map_config() if runtime else {"provider": "none", "status": "not_configured"})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/geocode", vol.Required("entry_id"): str, vol.Required("text"): str, vol.Optional("limit", default=5): vol.All(vol.Coerce(int), vol.Range(min=1, max=10))})
    @websocket_api.async_response
    async def ws_geocode(hass, connection, msg) -> None:
        runtime = hass.data.get(DOMAIN, {}).get(msg["entry_id"])
        if runtime is None or runtime.geocoder is None:
            connection.send_result(msg["id"], {"configured": False, "results": []})
            return
        try:
            results = await runtime.geocoder.async_search(msg["text"], limit=msg.get("limit", 5))
        except GeocodingError as exc:
            connection.send_error(msg["id"], str(exc), "Address search unavailable")
            return
        connection.send_result(msg["id"], {"configured": True, "results": results})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/reverse_geocode", vol.Required("entry_id"): str, vol.Required("latitude"): vol.Coerce(float), vol.Required("longitude"): vol.Coerce(float)})
    @websocket_api.async_response
    async def ws_reverse_geocode(hass, connection, msg) -> None:
        runtime = hass.data.get(DOMAIN, {}).get(msg["entry_id"])
        if runtime is None or runtime.geocoder is None:
            connection.send_result(msg["id"], {"configured": False, "address": None})
            return
        try:
            address = await runtime.geocoder.async_reverse(msg["latitude"], msg["longitude"])
        except GeocodingError as exc:
            if str(exc) == "invalid_coordinates":
                connection.send_error(msg["id"], str(exc), "Invalid coordinates")
            else:
                connection.send_error(msg["id"], str(exc), "Address lookup unavailable")
            return
        connection.send_result(msg["id"], {"configured": True, "address": address})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/tracker_position", vol.Required("entry_id"): str, vol.Required("profile_id"): str})
    @websocket_api.async_response
    async def ws_tracker_position(hass, connection, msg) -> None:
        runtime = hass.data.get(DOMAIN, {}).get(msg["entry_id"])
        profile = next((item for item in runtime.store.profiles() if item.profile_id == msg["profile_id"]), None) if runtime else None
        entity_id = profile.tracker_entity_id if profile and profile.tracker_entity_id else (DEFAULT_ZOE_TRACKER if profile and profile.name.strip().casefold() == "zoe" else None)
        state = hass.states.get(entity_id) if entity_id else None
        age_s = 0.0
        try:
            point = {"latitude": float(state.attributes["latitude"]), "longitude": float(state.attributes["longitude"]), "label": entity_id}
            age_s = (datetime.now(timezone.utc) - state.last_updated).total_seconds() if state and state.last_updated else 0
            available = state is not None and state.state not in {"unknown", "unavailable"} and age_s <= 86400 and -90 <= point["latitude"] <= 90 and -180 <= point["longitude"] <= 180 and not (point["latitude"] == 0 and point["longitude"] == 0)
        except (AttributeError, KeyError, TypeError, ValueError):
            available, point = False, None
        connection.send_result(msg["id"], {"available": available, "entity_id": entity_id, "point": point if available else None, "reason": None if available else ("stale" if age_s > 86400 else "unavailable")})

    @websocket_api.websocket_command({
        vol.Required("type"): "camper_route_planner/export_gpx",
        vol.Required("entry_id"): str,
        vol.Required("mode"): vol.In(["route", "track", "combined"]),
        vol.Optional("route"): dict,
        vol.Optional("route_id"): str,
    })
    @websocket_api.async_response
    async def ws_export_gpx(hass, connection, msg) -> None:
        runtime = hass.data.get("camper_route_planner", {}).get(msg["entry_id"])
        route = msg.get("route")
        if route is None and runtime is not None and msg.get("route_id"):
            route = runtime.store.route(msg["route_id"])
        if route is None:
            connection.send_error(msg["id"], "not_found", "Route data not found")
            return
        try:
            content = export_gpx(route, msg["mode"]).decode("utf-8")
        except (GpxExportError, UnicodeError) as exc:
            connection.send_error(msg["id"], "invalid_route", str(exc))
            return
        connection.send_result(msg["id"], {"filename": filename_for_route(route), "mime_type": "application/gpx+xml", "mode": msg["mode"], "content": content})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/load_route", vol.Required("entry_id"): str, vol.Required("route_id"): str})
    @websocket_api.async_response
    async def ws_load_route(hass, connection, msg) -> None:
        runtime = hass.data.get("camper_route_planner", {}).get(msg["entry_id"])
        route = runtime.store.route(msg["route_id"]) if runtime else None
        if route is None:
            connection.send_error(msg["id"], "not_found", "Saved route not found")
            return
        connection.send_result(msg["id"], {"route": route})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/delete_route", vol.Required("entry_id"): str, vol.Required("route_id"): str})
    @websocket_api.async_response
    async def ws_delete_route(hass, connection, msg) -> None:
        runtime = hass.data.get("camper_route_planner", {}).get(msg["entry_id"])
        deleted = await runtime.store.async_delete_route(msg["route_id"]) if runtime else False
        connection.send_result(msg["id"], {"deleted": deleted})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/save_route", vol.Required("entry_id"): str, vol.Required("route"): dict})
    @websocket_api.async_response
    async def ws_save_route(hass, connection, msg) -> None:
        runtime = hass.data.get("camper_route_planner", {}).get(msg["entry_id"])
        if runtime is None:
            connection.send_error(msg["id"], "not_found", "Config entry not loaded")
            return
        try:
            route_id = await runtime.store.async_save_route_record(msg["route"])
        except (TypeError, ValueError) as exc:
            connection.send_error(msg["id"], "invalid_route", str(exc))
            return
        connection.send_result(msg["id"], {"route_id": route_id})

    def async_register(hass) -> None:
        for command in (ws_list_entries, ws_nakordoni_usage, ws_estimate_tolls_v2, ws_list_profiles, ws_list_routes, ws_map_config, ws_geocode, ws_reverse_geocode, ws_tracker_position, ws_export_gpx, ws_load_route, ws_delete_route, ws_save_route):
            websocket_api.async_register_command(hass, command)

except ImportError:  # pragma: no cover - HA-only wrapper.
    def async_register(hass: Any) -> None:
        del hass
