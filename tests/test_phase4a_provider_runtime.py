import asyncio
import unittest

from custom_components.camper_route_planner.const import CONF_PROVIDER, PROVIDER_MOCK, PROVIDER_NAKORDONI_MOTORHOME
from custom_components.camper_route_planner.models import ProviderError, RouteRequest, RouteWaypoint, VehicleProfile
from custom_components.camper_route_planner.providers.mock import MockRoutingProvider
from custom_components.camper_route_planner.providers.nakordoni_motorhome import NakordoniMotorhomeProvider
from custom_components.camper_route_planner.runtime import build_routing_provider


def route_request(*, waypoints=()):
    profile = VehicleProfile("zoe", "Zoe", "motorhome", 3.20, 2.34, 7.65, 4800, "diesel", axles=2)
    return RouteRequest(
        RouteWaypoint(48.137, 11.575),
        RouteWaypoint(45.438, 10.992),
        profile,
        tuple(waypoints),
    )


class Phase4AProviderRuntimeTests(unittest.TestCase):
    def test_mock_is_selected_only_when_explicit(self):
        provider = build_routing_provider({CONF_PROVIDER: PROVIDER_MOCK})
        self.assertIsInstance(provider, MockRoutingProvider)
        result = asyncio.run(provider.calculate(route_request()))
        self.assertEqual(result.provider, PROVIDER_MOCK)
        self.assertTrue(result.synthetic)

    def test_options_provider_selects_motorhome_adapter_not_mock(self):
        provider = build_routing_provider({CONF_PROVIDER: PROVIDER_MOCK, "api_key": "K" * 24} | {CONF_PROVIDER: PROVIDER_NAKORDONI_MOTORHOME})
        self.assertIsInstance(provider, NakordoniMotorhomeProvider)
        self.assertNotIsInstance(provider, MockRoutingProvider)

    def test_provider_change_and_immediate_route_use_new_adapter(self):
        old = build_routing_provider({CONF_PROVIDER: PROVIDER_MOCK})
        new = build_routing_provider({CONF_PROVIDER: PROVIDER_NAKORDONI_MOTORHOME, "api_key": "K" * 24})
        self.assertIsInstance(old, MockRoutingProvider)
        self.assertIsInstance(new, NakordoniMotorhomeProvider)
        self.assertTrue(new.live_enabled)
        self.assertIsNone(new.transport)

    def test_runtime_motorhome_provider_uses_injected_transport(self):
        async def transport(_parameters):
            return {"ok": True, "data": {"route": {
                "distance_m": 123, "duration_s": 45, "geometry": [[48.137, 11.575], [45.438, 10.992]],
            }}}

        provider = build_routing_provider(
            {CONF_PROVIDER: PROVIDER_NAKORDONI_MOTORHOME, "api_key": "K" * 24},
            transport=transport,
        )
        result = asyncio.run(provider.calculate(route_request()))
        self.assertFalse(result.synthetic)
        self.assertEqual(result.provider, PROVIDER_NAKORDONI_MOTORHOME)

    def test_controlled_transport_receives_motorhome_dimensions_and_waypoints(self):
        captured = {}

        async def transport(parameters):
            captured.update(parameters)
            return {"ok": True, "data": {"route": {
                "distance_m": 12345, "duration_s": 678, "geometry": [[48.137, 11.575], [47.0, 11.0], [45.438, 10.992]],
            }}}

        via = (RouteWaypoint(47.0, 11.0, "Brenner"),)
        provider = NakordoniMotorhomeProvider(api_key="K" * 24, live_enabled=True, transport=transport)
        result = asyncio.run(provider.calculate(route_request(waypoints=via)))
        self.assertEqual(result.provider, PROVIDER_NAKORDONI_MOTORHOME)
        self.assertFalse(result.synthetic)
        self.assertEqual(captured["vehicle_type"], "motorhome")
        self.assertEqual(captured["length"], 7.65)
        self.assertEqual(captured["width"], 2.34)
        self.assertEqual(captured["height"], 3.2)
        self.assertEqual(captured["weight"], 4.8)
        self.assertEqual(captured["axles"], 2)
        self.assertEqual(captured["via"], "47.0,11.0")

    def test_controlled_api_errors_never_fallback_to_mock(self):
        async def transport(_parameters):
            return {"ok": False, "status": 503, "error": {"code": "provider_down"}}

        provider = NakordoniMotorhomeProvider(api_key="K" * 24, live_enabled=True, transport=transport)
        with self.assertRaises(ProviderError) as ctx:
            asyncio.run(provider.calculate(route_request()))
        self.assertEqual(ctx.exception.code, "provider_down")
        self.assertNotEqual(ctx.exception.code, "mock")

    def test_timeout_and_invalid_response_are_explicit(self):
        async def timeout(_parameters):
            raise TimeoutError

        async def invalid(_parameters):
            return {"ok": True, "data": {"route": {"distance_m": 1, "duration_s": 1, "geometry": []}}}

        for transport, code in ((timeout, "timeout"), (invalid, "invalid_response")):
            provider = NakordoniMotorhomeProvider(api_key="K" * 24, live_enabled=True, transport=transport)
            with self.assertRaises(ProviderError) as ctx:
                asyncio.run(provider.calculate(route_request()))
            self.assertEqual(ctx.exception.code, code)

    def test_missing_provider_is_not_silently_mocked(self):
        with self.assertRaises(ProviderError) as ctx:
            build_routing_provider({})
        self.assertEqual(ctx.exception.code, "provider_not_configured")


if __name__ == "__main__":
    unittest.main()
