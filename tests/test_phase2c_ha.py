"""Targeted HA 2026.10.1 fixture checks for the local candidate integration."""

from __future__ import annotations

import sys

try:
    import pytest
    from homeassistant.core import HomeAssistant
    from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    try:
        from homeassistant.const import CONF_NAME
    except ImportError:  # HA 2026.10 keeps the flow field name as a literal.
        CONF_NAME = "name"
    from custom_components.camper_route_planner.const import DOMAIN, PROVIDER_MOCK
    from custom_components.camper_route_planner import FRONTEND_RESOURCE_URL, FRONTEND_URL
    from custom_components.camper_route_planner.models import VehicleProfile
    HA_AVAILABLE = True
except ImportError as err:  # unittest discovery remains usable without pytest.
    print(f"HA fixture imports unavailable: {err!r}", file=sys.stderr)
    if __import__("os").environ.get("HA_FIXTURE_CI") == "1":
        raise
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
async def test_frontend_static_path_resource_and_reload_cleanup(
    hass: HomeAssistant, hass_client, enable_custom_integrations
) -> None:
    """Exercise the installable bundle through HA's real HTTP/static path."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Frontend Planner",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    response = await client.get(FRONTEND_URL)
    assert response.status == 200
    body = await response.text()
    assert f"Camper Route Planner Card v0.1.0-beta.5" in body
    assert 'customElements.define("camper-route-planner-card"' in body
    assert "custom:camper-route-planner-card" in body
    assert FRONTEND_RESOURCE_URL in hass.data[DATA_EXTRA_MODULE_URL].urls

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert FRONTEND_RESOURCE_URL not in hass.data[DATA_EXTRA_MODULE_URL].urls

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert FRONTEND_RESOURCE_URL in hass.data[DATA_EXTRA_MODULE_URL].urls
    response = await client.get(FRONTEND_URL)
    assert response.status == 200
    assert "Camper Route Planner Card v0.1.0-beta.5" in await response.text()


@pytest.mark.asyncio
async def test_websocket_lists_safe_config_entry_metadata(hass: HomeAssistant, hass_ws_client, enable_custom_integrations) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Discovery Planner",
        data={"provider": PROVIDER_MOCK, "api_key": "must-not-leave-backend", "map_provider": "none"},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client()
    await client.send_json({"id": 1, "type": "camper_route_planner/list_entries"})
    response = await client.receive_json()
    assert response["success"] is True
    assert response["result"]["entries"] == [{"entry_id": entry.entry_id, "title": "Discovery Planner", "state": "loaded"}]
    assert "api_key" not in response["result"]
    assert "options" not in response["result"]


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


@pytest.mark.asyncio
async def test_options_flow_manager_form_save_reopen_and_invalid_input(
    hass: HomeAssistant, enable_custom_integrations
) -> None:
    """Exercise the real HA Options flow manager, including read-only ownership."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Options Planner",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
        options={"provider": PROVIDER_MOCK, "map_provider": "carto", "carto_api_key": "fixture-carto-key", "preserved_option": "keep-me"},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] == "form"
    assert result["step_id"] == "init"
    schema_defaults = {getattr(key, "schema", None): getattr(key, "default", None)() for key in result["data_schema"].schema if callable(getattr(key, "default", None))}
    assert schema_defaults["provider"] == PROVIDER_MOCK
    assert schema_defaults["map_provider"] == "carto"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    assert result["type"] == "form"
    assert result["step_id"] == "profile"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input={
            "profile_id": "fixture-profile",
            "name": "Fixture Motorhome",
            "vehicle_kind": "motorhome",
            "height_m": 3.2,
            "width_m": 2.34,
            "length_m": 7.65,
            "gross_weight_kg": 4800,
            "fuel_type": "diesel",
            "axles": 2,
        },
    )
    assert result["type"] == "create_entry"
    await hass.async_block_till_done()
    assert entry.options["provider"] == PROVIDER_MOCK
    assert entry.options["preserved_option"] == "keep-me"
    assert entry.options["carto_api_key"] == "fixture-carto-key"

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] == "form"
    assert result["step_id"] == "init"
    schema_defaults = {getattr(key, "schema", None): getattr(key, "default", None)() for key in result["data_schema"].schema if callable(getattr(key, "default", None))}
    assert schema_defaults["map_provider"] == "none"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input={"provider": PROVIDER_MOCK, "map_provider": "carto", "carto_api_key": "", "remove_carto_api_key": True},
    )
    assert result["type"] == "form"
    assert result["step_id"] == "init"
    assert result["errors"]["carto_api_key"] == "carto_key_required"
    assert entry.options["provider"] == PROVIDER_MOCK
    assert entry.options["preserved_option"] == "keep-me"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"], user_input={"provider": PROVIDER_MOCK, "map_provider": "none", "remove_carto_api_key": True}
    )
    assert result["type"] == "form"
    assert result["step_id"] == "profile"
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input={
            "profile_id": "fixture-profile-remove",
            "name": "Fixture Motorhome",
            "vehicle_kind": "motorhome",
            "height_m": 3.2,
            "width_m": 2.34,
            "length_m": 7.65,
            "gross_weight_kg": 4800,
            "fuel_type": "diesel",
            "axles": 2,
        },
    )
    assert result["type"] == "create_entry"
    assert entry.options["carto_api_key"] == ""
