"""Editor-safe WebSocket commands for the Lovelace card."""

from __future__ import annotations

from typing import Any

try:
    import voluptuous as vol
    from homeassistant.components import websocket_api
    from .const import DOMAIN
    from .gpx import GpxExportError, export_gpx, filename_for_route

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/list_entries"})
    @websocket_api.async_response
    async def ws_list_entries(hass, connection, msg) -> None:
        """Expose only safe config-entry metadata for card discovery."""
        connection.send_result(msg["id"], {"entries": [
            {"entry_id": entry.entry_id, "title": entry.title, "state": entry.state.value}
            for entry in hass.config_entries.async_entries(DOMAIN)
        ]})

    @websocket_api.websocket_command({vol.Required("type"): "camper_route_planner/list_profiles", vol.Required("entry_id"): str})
    @websocket_api.async_response
    async def ws_list_profiles(hass, connection, msg) -> None:
        runtime = hass.data.get("camper_route_planner", {}).get(msg["entry_id"])
        connection.send_result(msg["id"], {"profiles": [profile.as_dict() for profile in runtime.store.profiles()] if runtime else []})

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
        for command in (ws_list_entries, ws_list_profiles, ws_list_routes, ws_map_config, ws_export_gpx, ws_load_route, ws_delete_route, ws_save_route):
            websocket_api.async_register_command(hass, command)

except ImportError:  # pragma: no cover - HA-only wrapper.
    def async_register(hass: Any) -> None:
        del hass
