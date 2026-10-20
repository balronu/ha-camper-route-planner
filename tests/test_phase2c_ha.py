"""Targeted HA 2026.10.1 fixture checks for the local candidate integration."""

from __future__ import annotations

import sys

try:
    import pytest
    from homeassistant.core import HomeAssistant
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    try:
        from homeassistant.const import CONF_NAME
    except ImportError:  # HA 2026.10 keeps the flow field name as a literal.
        CONF_NAME = "name"
    from custom_components.camper_route_planner.const import DOMAIN, PROVIDER_MOCK
    from custom_components.camper_route_planner.models import VehicleProfile
    HA_AVAILABLE = True
except ImportError as err:  # unittest discovery remains usable without pytest.
    print(f"HA fixture imports unavailable: {err!r}", file=sys.stderr)
    HA_AVAILABLE = False
    class _Mark:
        def __getattr__(self, _name):
            return lambda function: function

    class _Pytest:
        mark = _Mark()

    pytest = _Pytest()
    CONF_NAME = DOMAIN = PROVIDER_MOCK = "unavailable"
    HomeAssistant = MockConfigEntry = VehicleProfile = object


@pytest.mark.asyncio
async def test_config_flow_options_and_response_service(hass: HomeAssistant, enable_custom_integrations) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] == "form"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        user_input={CONF_NAME: "Fixture Planner", "provider": PROVIDER_MOCK, "map_provider": "none"},
    )
    assert result["type"] == "create_entry"

    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Fixture Planner",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    runtime = hass.data[DOMAIN][entry.entry_id]
    await runtime.store.async_save_profile(
        VehicleProfile("fixture", "Fixture", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel")
    )
    response = await hass.services.async_call(
        DOMAIN,
        "calculate_route",
        {
            "entry_id": entry.entry_id,
            "profile_id": "fixture",
            "origin": {"latitude": 49, "longitude": 7},
            "destination": {"latitude": 50, "longitude": 8},
        },
        blocking=True,
        return_response=True,
    )
    assert response["provider"] == "mock"
    assert response["synthetic"] is True


@pytest.mark.asyncio
async def test_websocket_map_config_is_editor_safe(hass: HomeAssistant, hass_ws_client, enable_custom_integrations) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Fixture Planner",
        data={"provider": PROVIDER_MOCK, "map_provider": "carto", "carto_api_key": "browser-safe-fixture"},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client()
    await client.send_json({"id": 1, "type": "camper_route_planner/map_config", "entry_id": entry.entry_id})
    response = await client.receive_json()
    assert response["success"] is True
    assert response["result"]["status"] == "configured"
    assert "browser-safe-fixture" in response["result"]["tile_url"]


@pytest.mark.asyncio
async def test_websocket_gpx_export_is_explicit_and_provider_free(hass: HomeAssistant, hass_ws_client, enable_custom_integrations) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Fixture Planner",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client()
    route = {
        "name": "Fixture & Route",
        "origin": {"latitude": 49, "longitude": 7, "label": "Start"},
        "waypoints": [{"latitude": 49.5, "longitude": 7.5, "label": "Via"}],
        "destination": {"latitude": 50, "longitude": 8, "label": "Ziel"},
        "geometry": {"points": [{"latitude": 49, "longitude": 7}, {"latitude": 50, "longitude": 8}]},
    }
    await client.send_json({"id": 1, "type": "camper_route_planner/export_gpx", "entry_id": entry.entry_id, "mode": "combined", "route": route})
    response = await client.receive_json()
    assert response["success"] is True
    assert response["result"]["filename"] == "Fixture _ Route.gpx"
    assert "<rtept" in response["result"]["content"]
    assert "<trkpt" in response["result"]["content"]
    assert "api_key" not in response["result"]["content"]

    await client.send_json({"id": 2, "type": "camper_route_planner/export_gpx", "entry_id": entry.entry_id, "mode": "track", "route": {**route, "geometry": None}})
    error = await client.receive_json()
    assert error["success"] is False
    assert error["error"]["code"] == "invalid_route"


@pytest.mark.asyncio
async def test_config_entry_unload_cleans_only_own_runtime(hass: HomeAssistant, enable_custom_integrations) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Lifecycle Planner",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.entry_id in hass.data[DOMAIN]
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert entry.entry_id not in hass.data[DOMAIN]
