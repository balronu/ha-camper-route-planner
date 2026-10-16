import unittest

from custom_components.camper_route_planner.config_flow_support import validate_user_input
from custom_components.camper_route_planner.map_provider import build_map_config


class MapProviderTests(unittest.TestCase):
    def test_none_provider_has_no_browser_url(self):
        config = build_map_config({"map_provider": "none"})
        self.assertEqual(config.status, "not_configured")
        self.assertIsNone(config.tile_url)

    def test_carto_url_is_encoded_and_marked_browser_safe(self):
        config = build_map_config({"map_provider": "carto", "carto_api_key": "public/key"})
        self.assertEqual(config.status, "configured")
        self.assertIn("public%2Fkey", config.tile_url)
        self.assertTrue(config.browser_safe)

    def test_missing_or_invalid_key_never_produces_tile_url(self):
        self.assertEqual(build_map_config({"map_provider": "carto"}).error_code, "carto_key_required")
        invalid = build_map_config({"map_provider": "carto", "carto_api_key": "bad key"})
        self.assertEqual(invalid.error_code, "carto_key_invalid")
        self.assertIsNone(invalid.tile_url)

    def test_options_validation_requires_carto_key(self):
        self.assertEqual(validate_user_input({"provider": "mock", "map_provider": "carto"}), {"carto_api_key": "carto_key_required"})
        self.assertEqual(validate_user_input({"provider": "mock", "map_provider": "carto", "carto_api_key": "public"}), {})


if __name__ == "__main__":
    unittest.main()
