"""Targeted HA 2026.10.1 fixture checks for the local candidate integration."""

from __future__ import annotations

import sys

try:
    import pytest
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers import selector
    from homeassistant.components.lovelace import LOVELACE_DATA
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    try:
        from homeassistant.const import CONF_NAME
    except ImportError:  # HA 2026.10 keeps the flow field name as a literal.
        CONF_NAME = "name"
    from custom_components.camper_route_planner.const import CONF_API_KEY, DOMAIN, PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME
    from custom_components.camper_route_planner import FRONTEND_RESOURCE_URL, FRONTEND_URL
    from custom_components.camper_route_planner.models import VehicleProfile
    from custom_components.camper_route_planner.providers.nakordoni_motorhome import NakordoniMotorhomeProvider
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
async def test_provider_options_override_entry_data_and_reload_before_next_route(
    hass: HomeAssistant, enable_custom_integrations
) -> None:
    """An Options Flow provider change replaces the live runtime instance."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Provider switch planner",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
        options={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data[DOMAIN][entry.entry_id]
    await runtime.store.async_save_profile(
        VehicleProfile("zoe", "Zoe", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=2)
    )

    hass.config_entries.async_update_entry(
        entry,
        options={"provider": PROVIDER_NAKORDONI_MOTORHOME, "api_key": "K" * 24, "map_provider": "none"},
    )
    await hass.async_block_till_done()

    runtime = hass.data[DOMAIN][entry.entry_id]
    assert isinstance(runtime.coordinator.provider, NakordoniMotorhomeProvider)

    async def transport(_parameters):
        return {"ok": True, "data": {"route": {
            "distance_m": 12345,
            "duration_s": 678,
            "geometry": [[49, 7], [49.5, 7.5], [50, 8]],
        }}}

    runtime.coordinator.provider.transport = transport
    result = await runtime.async_calculate_service({
        "profile_id": "zoe",
        "origin": {"latitude": 49, "longitude": 7},
        "destination": {"latitude": 50, "longitude": 8},
        "via": [{"latitude": 49.5, "longitude": 7.5}],
    })
    assert result["provider"] == PROVIDER_NAKORDONI_MOTORHOME
    assert result["synthetic"] is False


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
    assert "Camper Route Planner Card v0.1.6-beta.1" in body
    assert 'customElements.define("camper-route-planner-card"' in body
    assert 'return { entry_id: "" }' in body
    assert 'card.type === "camper-route-planner-card"' in body
    assert 'card.type === "custom:camper-route-planner-card"' not in body
    resources = hass.data[LOVELACE_DATA].resources
    assert any(
        item["url"] == FRONTEND_RESOURCE_URL and item["type"] == "module"
        for item in resources.async_items()
    )

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert any(
        item["url"] == FRONTEND_RESOURCE_URL and item["type"] == "module"
        for item in resources.async_items()
    )

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert sum(item["url"] == FRONTEND_RESOURCE_URL for item in resources.async_items()) == 1
    response = await client.get(FRONTEND_URL)
    assert response.status == 200
    assert "Camper Route Planner Card v0.1.6-beta.1" in await response.text()


@pytest.mark.asyncio
async def test_frontend_resource_preserves_existing_entries_and_updates_old_version(
    hass: HomeAssistant, enable_custom_integrations
) -> None:
    """Only the integration's own resource is normalized, never the collection."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Resource Planner",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    resources = hass.data[LOVELACE_DATA].resources
    await resources.async_create_item({"res_type": "module", "url": "/local/unrelated-card.js?v=1"})
    own = next(item for item in resources.async_items() if item["url"] == FRONTEND_RESOURCE_URL)
    await resources.async_update_item(own["id"], {"url": f"{FRONTEND_URL}?v=old"})
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    items = resources.async_items()
    assert any(item["url"] == "/local/unrelated-card.js?v=1" for item in items)
    assert sum(item["url"] == FRONTEND_RESOURCE_URL for item in items) == 1
    assert not any(item["url"] == f"{FRONTEND_URL}?v=old" for item in items)


@pytest.mark.asyncio
async def test_frontend_resource_is_shared_by_multiple_entries(
    hass: HomeAssistant, enable_custom_integrations
) -> None:
    """Multiple entries must not create duplicate resource records."""
    entries = [
        MockConfigEntry(
            domain=DOMAIN,
            title=f"Planner {index}",
            data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
        )
        for index in (1, 2)
    ]
    for entry in entries:
        entry.add_to_hass(hass)
        assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    resources = hass.data[LOVELACE_DATA].resources
    assert sum(item["url"] == FRONTEND_RESOURCE_URL for item in resources.async_items()) == 1


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
    await client.send_json({"id": 2, "type": "camper_route_planner/list_profiles", "entry_id": entry.entry_id})
    profiles = await client.receive_json()
    assert profiles["success"] is True
    assert profiles["result"]["provider"] == PROVIDER_MOCK
    assert "api_key" not in profiles["result"]


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
        user_input={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": "", "vehicle_action": "add"},
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
    profile = next(profile for profile in hass.data[DOMAIN][entry.entry_id].store.profiles() if profile.profile_id == "fixture-profile")
    assert profile.consumption_l_per_100km is None

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] == "form"
    assert result["step_id"] == "init"
    schema_defaults = {getattr(key, "schema", None): getattr(key, "default", None)() for key in result["data_schema"].schema if callable(getattr(key, "default", None))}
    assert schema_defaults["map_provider"] == "none"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input={"provider": PROVIDER_MOCK, "map_provider": "carto", "carto_api_key": "", "remove_carto_api_key": True, "vehicle_action": "add"},
    )
    assert result["type"] == "form"
    assert result["step_id"] == "init"
    assert result["errors"]["carto_api_key"] == "carto_key_required"
    assert entry.options["provider"] == PROVIDER_MOCK
    assert entry.options["preserved_option"] == "keep-me"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"], user_input={"provider": PROVIDER_MOCK, "map_provider": "none", "remove_carto_api_key": True, "vehicle_action": "add"}
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


@pytest.mark.asyncio
async def test_options_flow_vehicle_action_uses_user_facing_labels(
    hass: HomeAssistant, enable_custom_integrations
) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Vehicle labels",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    result = await hass.config_entries.options.async_init(entry.entry_id)
    vehicle_key = next(key for key in result["data_schema"].schema if getattr(key, "schema", None) == "vehicle_action")
    vehicle_validator = result["data_schema"].schema[vehicle_key]
    assert vehicle_validator.container == {"none": "No vehicle changes", "add": "Add new vehicle", "delete": "Delete a vehicle"}
    assert vehicle_key.default() == "none"

    hass.config_entries.options.async_abort(result["flow_id"])
    hass.config.language = "de"
    result = await hass.config_entries.options.async_init(entry.entry_id)
    vehicle_key = next(key for key in result["data_schema"].schema if getattr(key, "schema", None) == "vehicle_action")
    vehicle_validator = result["data_schema"].schema[vehicle_key]
    assert vehicle_validator.container == {"none": "Keine Änderungen an Fahrzeugen", "add": "Neues Fahrzeug hinzufügen", "delete": "Fahrzeug löschen"}


@pytest.mark.asyncio
async def test_options_flow_edits_existing_vehicle_without_changing_id_or_routes(
    hass: HomeAssistant, enable_custom_integrations
) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Vehicle options",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": "", "geocoding_api_key": "old-geo-key"},
        options={"geocoding_api_key": "old-geo-key"},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data[DOMAIN][entry.entry_id]
    await runtime.store.async_save_profile(VehicleProfile("zoe", "Zoe", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", tracker_entity_id="device_tracker.wohnmobil_zoe"))
    await runtime.store.async_save_route_record({
        "route_id": "zoe-route", "name": "Keep reference", "provider": "mock", "distance_m": 100,
        "duration_s": 100, "geometry": {"points": [{"latitude": 49, "longitude": 7}, {"latitude": 50, "longitude": 8}]},
        "profile_id": "zoe",
    })

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["step_id"] == "init"
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "provider": PROVIDER_MOCK, "map_provider": "none", "geocoding_api_key": "new-geo-key", "vehicle_action": "zoe",
    })
    assert result["step_id"] == "profile"
    consumption_key = next(key for key in result["data_schema"].schema if getattr(key, "schema", None) == "consumption_l_per_100km")
    assert isinstance(result["data_schema"].schema[consumption_key], selector.NumberSelector)
    defaults = {getattr(key, "schema", None): getattr(key, "default", None)() for key in result["data_schema"].schema if callable(getattr(key, "default", None))}
    assert defaults["profile_id"] == "zoe"
    assert defaults["tracker_entity_id"] == "device_tracker.wohnmobil_zoe"
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "profile_id": "must-not-change-id", "name": "Zoe Wohnmobil", "vehicle_kind": "motorhome",
        "height_m": 3.25, "width_m": 2.34, "length_m": 7.65, "gross_weight_kg": 4900,
        "fuel_type": "diesel", "axles": 2, "emission_class": "euro5", "co2_class": "c",
        "first_registration": "2020-04-15", "consumption_l_per_100km": 11.2,
        "tracker_entity_id": "device_tracker.wohnmobil_zoe",
    })
    assert result["type"] == "create_entry"
    assert entry.options["geocoding_api_key"] == "new-geo-key"
    profile = next(item for item in runtime.store.profiles() if item.profile_id == "zoe")
    assert profile.name == "Zoe Wohnmobil"
    assert profile.tracker_entity_id == "device_tracker.wohnmobil_zoe"
    assert profile.emission_class == "euro5"
    assert profile.co2_class == "c"
    assert profile.first_registration == "2020-04-15"
    assert profile.consumption_l_per_100km == 11.2
    assert runtime.store.route("zoe-route")["profile_id"] == "zoe"


@pytest.mark.asyncio
async def test_options_flow_empty_geoapify_field_keeps_key_and_remove_clears_it(
    hass: HomeAssistant, enable_custom_integrations
) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN, title="Geo options",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "geocoding_api_key": "stored-geo-key"},
        options={"geocoding_api_key": "stored-geo-key"},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={"provider": PROVIDER_MOCK, "map_provider": "none", "geocoding_api_key": "", "vehicle_action": "none"})
    assert result["type"] == "create_entry"
    assert entry.options["geocoding_api_key"] == "stored-geo-key"
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={"provider": PROVIDER_MOCK, "map_provider": "none", "remove_geocoding_api_key": True, "vehicle_action": "none"})
    assert result["type"] == "create_entry"
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={"provider": PROVIDER_MOCK, "map_provider": "none", "vehicle_action": "add"})
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "profile_id": "geo-profile", "name": "Geo vehicle", "vehicle_kind": "motorhome", "height_m": 3.2,
        "width_m": 2.34, "length_m": 7.65, "gross_weight_kg": 4800, "fuel_type": "diesel", "axles": 2,
    })
    assert entry.options["geocoding_api_key"] == ""


@pytest.mark.asyncio
async def test_options_flow_nakordoni_key_lifecycle_and_provider_switch(
    hass: HomeAssistant, enable_custom_integrations
) -> None:
    """A key is kept in options until the explicit remove control is used."""
    entry = MockConfigEntry(
        domain=DOMAIN, title="Nakordoni options",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    key = "K" * 24

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "provider": PROVIDER_NAKORDONI_MOTORHOME, "api_key": key, "map_provider": "none", "vehicle_action": "add",
    })
    assert result["step_id"] == "profile"
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "profile_id": "key-profile", "name": "Key vehicle", "vehicle_kind": "motorhome",
        "height_m": 3.2, "width_m": 2.34, "length_m": 7.65, "gross_weight_kg": 4800,
        "fuel_type": "diesel", "axles": 2,
    })
    assert result["type"] == "create_entry"
    assert entry.options[CONF_API_KEY] == key

    # Switching away from Nakordoni and submitting an empty field must not clear it.
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["description_placeholders"]["nakordoni_status"] == "stored"
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "provider": PROVIDER_MOCK, "api_key": "", "map_provider": "none", "vehicle_action": "add",
    })
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "profile_id": "key-profile-2", "name": "Second key vehicle", "vehicle_kind": "car",
        "height_m": 1.6, "width_m": 1.8, "length_m": 4.2, "gross_weight_kg": 1800,
        "fuel_type": "electric", "axles": 2,
    })
    assert result["type"] == "create_entry"
    assert entry.options[CONF_API_KEY] == key

    # Reloading the integration leaves the options-backed secret available.
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["description_placeholders"]["nakordoni_status"] == "stored"
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "provider": PROVIDER_NAKORDONI_MOTORHOME, "api_key": "", "map_provider": "none", "vehicle_action": "add",
    })
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "profile_id": "key-profile-3", "name": "Third key vehicle", "vehicle_kind": "truck",
        "height_m": 3.8, "width_m": 2.5, "length_m": 10.0, "gross_weight_kg": 7500,
        "fuel_type": "diesel", "axles": 3,
    })
    assert result["type"] == "create_entry"
    assert entry.options[CONF_API_KEY] == key

    # Only the explicit checkbox removes the secret.
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "provider": PROVIDER_MOCK, "api_key": "", "remove_api_key": True, "map_provider": "none", "vehicle_action": "add",
    })
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "profile_id": "key-profile-4", "name": "Fourth key vehicle", "vehicle_kind": "car",
        "height_m": 1.6, "width_m": 1.8, "length_m": 4.2, "gross_weight_kg": 1800,
        "fuel_type": "electric", "axles": 2,
    })
    assert result["type"] == "create_entry"
    assert entry.options[CONF_API_KEY] == ""


@pytest.mark.asyncio
async def test_options_flow_deletes_selected_duplicate_name_only_with_route_consent(
    hass: HomeAssistant, enable_custom_integrations
) -> None:
    entry = MockConfigEntry(
        domain=DOMAIN, title="Delete options",
        data={"provider": PROVIDER_MOCK, "map_provider": "none", "carto_api_key": ""},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data[DOMAIN][entry.entry_id]
    await runtime.store.async_save_profile(VehicleProfile("keep", "Zoe", "car", 1.6, 1.8, 4.2, 1800, "electric"))
    await runtime.store.async_save_profile(VehicleProfile("remove", "Zoe", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel"))
    await runtime.store.async_save_route_record({
        "route_id": "remove-route", "name": "Referenced", "provider": "mock", "distance_m": 100,
        "duration_s": 100, "geometry": {"points": [{"latitude": 49, "longitude": 7}, {"latitude": 50, "longitude": 8}]},
        "profile_id": "remove",
    })

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={"provider": PROVIDER_MOCK, "map_provider": "none", "vehicle_action": "delete"})
    assert result["step_id"] == "vehicle_delete_select"
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={
        "profile_id": "remove",
    })
    assert result["step_id"] == "vehicle_delete"
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={"confirm_delete": True})
    assert result["step_id"] == "vehicle_delete"
    assert result["errors"]["base"] == "profile_has_routes"
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input={"confirm_delete": True, "delete_routes": True})
    assert result["type"] == "create_entry"
    assert {profile.profile_id for profile in runtime.store.profiles()} == {"keep"}
    assert runtime.store.route("remove-route") is None
