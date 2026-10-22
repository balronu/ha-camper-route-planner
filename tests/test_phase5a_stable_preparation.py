"""Phase 5A regressions for provider labels and non-destructive options."""

import asyncio
import unittest

from custom_components.camper_route_planner.config_flow_support import validate_user_input
from custom_components.camper_route_planner.const import (
    CONF_PROVIDER,
    CONF_VEHICLE_ACTION,
    PROVIDER_MOCK,
    PROVIDER_NAKORDONI,
    PROVIDER_NAKORDONI_MOTORHOME,
    VEHICLE_ACTION_NONE,
)
from custom_components.camper_route_planner.models import VehicleProfile
from custom_components.camper_route_planner.providers.nakordoni import NakordoniRoutingProvider
from custom_components.camper_route_planner.providers.nakordoni_motorhome import NakordoniMotorhomeProvider
from custom_components.camper_route_planner.runtime import build_routing_provider
from custom_components.camper_route_planner.storage import MemoryStore, ProfileRouteStore


class Phase5AStablePreparationTests(unittest.TestCase):
    def test_visible_nakordoni_value_uses_motorhome_adapter(self):
        provider = build_routing_provider({CONF_PROVIDER: PROVIDER_NAKORDONI_MOTORHOME, "api_key": "K" * 24})
        self.assertIsInstance(provider, NakordoniMotorhomeProvider)

    def test_legacy_nakordoni_value_is_not_remapped(self):
        provider = build_routing_provider({CONF_PROVIDER: PROVIDER_NAKORDONI, "api_key": "K" * 24})
        self.assertIsInstance(provider, NakordoniRoutingProvider)
        self.assertNotIsInstance(provider, NakordoniMotorhomeProvider)

    def test_new_visible_provider_set_is_mock_and_motorhome_only(self):
        self.assertEqual(
            validate_user_input({"provider": PROVIDER_MOCK}),
            {},
        )
        self.assertEqual(
            validate_user_input({"provider": PROVIDER_NAKORDONI_MOTORHOME, "api_key": "K" * 24}),
            {},
        )

    def test_no_vehicle_change_does_not_write_or_reset_profiles(self):
        profile = VehicleProfile("zoe", "Zoe", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=2, tracker_entity_id="device_tracker.zoe")
        backend = MemoryStore({"version": 2, "profiles": {"zoe": profile.as_dict()}, "routes": {}})
        store = ProfileRouteStore(backend)
        asyncio.run(store.async_load())
        before = store.data.copy()
        self.assertEqual(VEHICLE_ACTION_NONE, "none")
        self.assertEqual(store.profiles()[0], profile)
        self.assertEqual(store.data, before)
        self.assertEqual(backend.save_count, 1)

    def test_existing_profile_id_and_tracker_are_preserved_by_round_trip(self):
        profile = VehicleProfile("zoe", "Zoe", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=2, tracker_entity_id="device_tracker.zoe")
        backend = MemoryStore()
        store = ProfileRouteStore(backend)
        asyncio.run(store.async_load())
        asyncio.run(store.async_save_profile(profile))
        restored = store.profiles()[0]
        self.assertEqual(restored.profile_id, "zoe")
        self.assertEqual(restored.tracker_entity_id, "device_tracker.zoe")


if __name__ == "__main__":
    unittest.main()
