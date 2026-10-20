import asyncio
import json
import unittest
from pathlib import Path

from custom_components.camper_route_planner.config_flow_support import validate_user_input
from custom_components.camper_route_planner.coordinator import QuotaGuard, RouteCoordinator
from custom_components.camper_route_planner.models import (
    ProviderError,
    RouteRequest,
    RouteWaypoint,
    VehicleProfile,
)
from custom_components.camper_route_planner.providers.mock import MockRoutingProvider
from custom_components.camper_route_planner.providers.nakordoni import NakordoniRoutingProvider
from custom_components.camper_route_planner.storage import MemoryStore, ProfileRouteStore, migrate_data


def carthago_fixture() -> VehicleProfile:
    """Test-only fixture; never imported by integration setup code."""
    return VehicleProfile("fixture-carthago", "Carthago chic e-line I 50 Yachting", "motorhome", 3.20, 2.34, 7.65, 4800, "diesel")


class CountingProvider(MockRoutingProvider):
    calls = 0

    async def calculate(self, request):
        self.calls += 1
        return await super().calculate(request)


class Phase2ATests(unittest.TestCase):
    def test_carthago_fixture_and_independent_profiles(self):
        carthago = carthago_fixture()
        second = VehicleProfile("second", "Second vehicle", "car", 1.8, 1.8, 4.2, 1800, "petrol")
        self.assertEqual(carthago.gross_weight_kg, 4800)
        self.assertNotEqual(carthago.profile_id, second.profile_id)

    def test_profile_validation_boundaries(self):
        with self.assertRaises(ValueError):
            VehicleProfile("bad", "Bad", "motorhome", 5.1, 2.0, 7.0, 4800, "diesel")
        with self.assertRaises(ValueError):
            VehicleProfile("bad", "Bad", "motorhome", 3.2, 2.3, 7.0, 4800, "diesel", actual_weight_kg=5000)

    def test_mock_is_deterministic_and_supports_waypoints(self):
        profile = carthago_fixture()
        request = RouteRequest(RouteWaypoint(49, 7, "start"), RouteWaypoint(50, 8, "end"), profile, (RouteWaypoint(49.5, 7.5, "via"),))
        provider = MockRoutingProvider()
        first = asyncio.run(provider.calculate(request))
        second = asyncio.run(provider.calculate(request))
        self.assertEqual(first, second)
        self.assertEqual(len(first.geometry.points), 3)
        self.assertTrue(first.synthetic)
        self.assertIn("Synthetic", first.warnings[0].message)

    def test_manual_coordinator_deduplicates_without_refresh_loop(self):
        provider = CountingProvider()
        coordinator = RouteCoordinator(provider)
        request = RouteRequest(RouteWaypoint(49, 7), RouteWaypoint(50, 8), carthago_fixture())

        async def run():
            return await asyncio.gather(coordinator.async_calculate_manual(request), coordinator.async_calculate_manual(request))

        first, second = asyncio.run(run())
        self.assertEqual(first, second)
        self.assertEqual(provider.calls, 1)

    def test_quota_guard_blocks_second_call(self):
        provider = CountingProvider()
        coordinator = RouteCoordinator(provider, quota=QuotaGuard(daily_limit=1))
        request = RouteRequest(RouteWaypoint(49, 7), RouteWaypoint(50, 8), carthago_fixture())
        asyncio.run(coordinator.async_calculate_manual(request))
        with self.assertRaises(ProviderError) as context:
            asyncio.run(coordinator.async_calculate_manual(request))
        self.assertEqual(context.exception.code, "quota_exhausted")

    def test_nakordoni_is_disabled_and_fixture_only(self):
        provider = NakordoniRoutingProvider(api_key=None, live_enabled=False)
        request = RouteRequest(RouteWaypoint(49, 7), RouteWaypoint(50, 8), carthago_fixture())
        with self.assertRaises(ProviderError) as context:
            asyncio.run(provider.calculate(request))
        self.assertEqual(context.exception.code, "live_routing_disabled")
        result = provider.normalize_fixture({"ok": True, "data": {"route": {"distance_m": 1234, "duration_s": 321, "geometry": [[49, 7], [50, 8]]}}})
        self.assertFalse(result.synthetic)
        self.assertEqual(provider.build_parameters(request)["weight"], 4.8)

    def test_storage_migration_profiles_routes_and_restart(self):
        migrated = migrate_data({"version": 1})
        self.assertEqual(migrated["version"], 2)
        backend = MemoryStore({"version": 1})
        repository = ProfileRouteStore(backend)

        async def save_and_reload():
            await repository.async_load()
            await repository.async_save_profile(carthago_fixture())
            restored = ProfileRouteStore(backend)
            await restored.async_load()
            return restored

        restored = asyncio.run(save_and_reload())
        self.assertEqual(restored.profiles()[0].name, "Carthago chic e-line I 50 Yachting")
        self.assertGreaterEqual(backend.save_count, 2)

    def test_storage_rejects_credential_shaped_browser_route_fields(self):
        store = ProfileRouteStore(MemoryStore())
        asyncio.run(store.async_load())
        record = {
            "route_id": "route-secret",
            "geometry": {"points": [{"latitude": 49, "longitude": 7}, {"latitude": 50, "longitude": 8}]},
            "metadata": {"provider": "mock", "authorization": "Bearer should-never-persist"},
        }
        with self.assertRaisesRegex(ValueError, "forbidden credential"):
            asyncio.run(store.async_save_route_record(record))

    def test_config_flow_validation_and_optional_contracts(self):
        self.assertEqual(validate_user_input({"provider": "mock"}), {})
        self.assertEqual(validate_user_input({"provider": "nakordoni"}), {"api_key": "invalid_api_key"})
        self.assertEqual(validate_user_input({"provider": "nakordoni", "api_key": "x", "live_enabled": True}), {"base": "live_routing_requires_separate_phase"})

    def test_no_fixture_is_written_to_integration_source(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in Path("custom_components/camper_route_planner").rglob("*.py"))
        self.assertNotIn("Carthago chic", source)

    def test_manifest_and_services_are_valid_json_or_present(self):
        manifest = json.loads(Path("custom_components/camper_route_planner/manifest.json").read_text())
        self.assertEqual(manifest["domain"], "camper_route_planner")
        self.assertTrue(Path("custom_components/camper_route_planner/services.yaml").exists())


if __name__ == "__main__":
    unittest.main()
