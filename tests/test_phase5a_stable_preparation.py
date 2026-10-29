"""Phase 5A regressions for provider labels and non-destructive options."""

import asyncio
import json
from pathlib import Path
import unittest

from custom_components.camper_route_planner.config_flow_support import validate_user_input
from custom_components.camper_route_planner.const import (
    CONF_PROVIDER,
    CONF_VEHICLE_ACTION,
    PROVIDER_MOCK,
    PROVIDER_NAKORDONI,
    PROVIDER_NAKORDONI_MOTORHOME,
    PROVIDER_NAKORDONI_MOTORHOME_V3,
    VEHICLE_ACTION_NONE,
)
from custom_components.camper_route_planner.models import VehicleProfile
from custom_components.camper_route_planner.providers.nakordoni import NakordoniRoutingProvider
from custom_components.camper_route_planner.providers.nakordoni_motorhome import NakordoniMotorhomeProvider
from custom_components.camper_route_planner.runtime import build_routing_provider
from custom_components.camper_route_planner.storage import MemoryStore, ProfileRouteStore


class Phase5AStablePreparationTests(unittest.TestCase):
    def test_profile_numbers_use_visible_ha_selectors(self):
        source = Path("custom_components/camper_route_planner/config_flow.py").read_text(encoding="utf-8")
        self.assertIn("def _number_selector", source)
        self.assertIn("consumption_l_per_100km", source)
        self.assertIn("_number_selector(0.1, 100, 0.1)", source)
        self.assertNotIn('vol.Any("", vol.Coerce(float))', source)

    def test_provider_translations_expose_mock_v2_and_explicit_beta_v3(self):
        translation_paths = [
            Path(__file__).parents[1] / "custom_components" / "camper_route_planner" / "strings.json",
            *(Path(__file__).parents[1] / "custom_components" / "camper_route_planner" / "translations" / f"{language}.json" for language in ("de", "en")),
        ]
        for path in translation_paths:
            payload = json.loads(
                path.read_text(encoding="utf-8")
            )
            options = payload["selector"]["provider"]["options"]
            self.assertEqual(set(options), {PROVIDER_MOCK, PROVIDER_NAKORDONI_MOTORHOME, PROVIDER_NAKORDONI_MOTORHOME_V3})
            self.assertEqual(options[PROVIDER_MOCK], "Mock (offline)")
            self.assertIn("Nakordoni v2", options[PROVIDER_NAKORDONI_MOTORHOME])
            self.assertIn("Nakordoni v3", options[PROVIDER_NAKORDONI_MOTORHOME_V3])

    def test_visible_nakordoni_value_uses_motorhome_adapter(self):
        provider = build_routing_provider({CONF_PROVIDER: PROVIDER_NAKORDONI_MOTORHOME, "api_key": "K" * 24})
        self.assertIsInstance(provider, NakordoniMotorhomeProvider)

    def test_explicit_v3_value_uses_isolated_adapter(self):
        from custom_components.camper_route_planner.providers.nakordoni_v3 import NakordoniRouteAdapterV3

        provider = build_routing_provider({CONF_PROVIDER: PROVIDER_NAKORDONI_MOTORHOME_V3, "api_key": "K" * 24})
        self.assertIsInstance(provider, NakordoniRouteAdapterV3)

    def test_legacy_nakordoni_value_is_not_remapped(self):
        provider = build_routing_provider({CONF_PROVIDER: PROVIDER_NAKORDONI, "api_key": "K" * 24})
        self.assertIsInstance(provider, NakordoniRoutingProvider)
        self.assertNotIsInstance(provider, NakordoniMotorhomeProvider)

    def test_new_visible_provider_set_requires_key_for_v2_and_v3(self):
        self.assertEqual(
            validate_user_input({"provider": PROVIDER_MOCK}),
            {},
        )
        self.assertEqual(
            validate_user_input({"provider": PROVIDER_NAKORDONI_MOTORHOME, "api_key": "K" * 24}),
            {},
        )
        self.assertEqual(
            validate_user_input({"provider": PROVIDER_NAKORDONI_MOTORHOME_V3, "api_key": "K" * 24}),
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
