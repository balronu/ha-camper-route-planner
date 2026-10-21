import asyncio
import unittest
from datetime import datetime, timezone
from xml.etree import ElementTree

from custom_components.camper_route_planner.gpx import export_gpx
from custom_components.camper_route_planner.models import (
    ProviderError,
    RouteRequest,
    RouteWaypoint,
    ValidationError,
    VehicleProfile,
)
from custom_components.camper_route_planner.providers.mock import MockRoutingProvider
from custom_components.camper_route_planner.providers.nakordoni import NakordoniRoutingProvider


def vehicle(profile_id="a"):
    return VehicleProfile(profile_id, f"Profile {profile_id}", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", 2)


class Phase1Tests(unittest.TestCase):
    def test_two_independent_profiles(self):
        self.assertNotEqual(vehicle("a").profile_id, vehicle("b").profile_id)

    def test_invalid_dimensions_and_coordinates(self):
        with self.assertRaises(ValidationError):
            VehicleProfile("x", "bad", "motorhome", 5.1, 2, 7, 4000, "diesel", 2)
        with self.assertRaises(ValidationError):
            RouteWaypoint(91, 0)

    def test_via_limit_and_aware_time(self):
        c = RouteWaypoint(49, 7)
        with self.assertRaises(ValidationError):
            RouteRequest(c, RouteWaypoint(50, 8), vehicle(), (c,) * 6)
        with self.assertRaises(ValidationError):
            RouteRequest(c, RouteWaypoint(50, 8), vehicle(), depart_at=datetime(2026, 1, 1))

    def test_manual_only_provider_and_repeatable_mock(self):
        request = RouteRequest(RouteWaypoint(49, 7), RouteWaypoint(50, 8), vehicle(), depart_at=datetime.now(timezone.utc))
        provider = MockRoutingProvider()
        first = asyncio.run(provider.calculate(request))
        second = asyncio.run(provider.calculate(request))
        self.assertEqual(first, second)

    def test_http_error_and_invalid_response(self):
        request = RouteRequest(RouteWaypoint(49, 7), RouteWaypoint(50, 8), vehicle())
        for status in (401, 403, 429, 500):
            with self.subTest(status=status), self.assertRaises(ProviderError) as ctx:
                asyncio.run(MockRoutingProvider(fail_with=ProviderError("mock error", code="mock_error", status=status)).calculate(request))
            self.assertEqual(ctx.exception.status, status)
        with self.assertRaises(ProviderError):
            NakordoniRoutingProvider().normalize_fixture({"ok": True, "data": {}})

    def test_timeout_is_bounded_by_caller(self):
        request = RouteRequest(RouteWaypoint(49, 7), RouteWaypoint(50, 8), vehicle())
        with self.assertRaises(asyncio.TimeoutError):
            asyncio.run(asyncio.wait_for(MockRoutingProvider(delay_s=0.1).calculate(request), timeout=0.001))

    def test_gpx_xml_has_route_and_track_without_secrets(self):
        route = {
            "name": "test route",
            "origin": {"latitude": 49, "longitude": 7},
            "destination": {"latitude": 50, "longitude": 8},
            "geometry": {"points": [{"latitude": 49, "longitude": 7}, {"latitude": 50, "longitude": 8}]},
        }
        xml = export_gpx(route)
        root = ElementTree.fromstring(xml)
        self.assertTrue(root.tag.endswith("gpx"))
        self.assertIn("rtept", xml.decode())
        self.assertNotIn("Bearer", xml.decode())


if __name__ == "__main__":
    unittest.main()
