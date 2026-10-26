import asyncio
import unittest

from custom_components.camper_route_planner.models import RouteRequest, RouteWaypoint, ValidationError, VehicleProfile, ProviderError
from custom_components.camper_route_planner.providers.nakordoni_motorhome import (
    FORBIDDEN_TRUCK_TIME_FIELDS, NakordoniMotorhomeProvider, build_motorhome_parameters,
    provider_error_from_payload, safe_provider_link,
)
from custom_components.camper_route_planner.config_flow_support import normalize_api_key, validate_user_input


def request(**changes):
    profile = VehicleProfile("c", "Carthago", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=2)
    profile = changes.pop("vehicle", profile)
    return RouteRequest(RouteWaypoint(48.137, 11.575), RouteWaypoint(45.438, 10.992), profile, **changes)


class Phase2GMotorhomeTests(unittest.TestCase):
    def test_request_is_explicit_and_uses_tonnes(self):
        params = build_motorhome_parameters(request())
        self.assertEqual(params["vehicle_type"], "motorhome")
        self.assertEqual(params["weight"], 4.8)
        self.assertEqual(params["axles"], 2)
        self.assertFalse(FORBIDDEN_TRUCK_TIME_FIELDS.intersection(params))

    def test_missing_required_dimension_is_rejected(self):
        profile = VehicleProfile("c", "Carthago", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=2)
        object.__setattr__(profile, "height_m", None)
        with self.assertRaises(ValidationError):
            build_motorhome_parameters(request(vehicle=profile))

    def test_invalid_axles_is_rejected(self):
        with self.assertRaises(ValidationError):
            VehicleProfile("c", "Carthago", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=0)

    def test_mock_route_is_not_replaced(self):
        from custom_components.camper_route_planner.providers.mock import MockRoutingProvider
        result = asyncio.run(MockRoutingProvider().calculate(request()))
        self.assertEqual(result.provider, "mock")
        self.assertTrue(result.synthetic)

    def test_missing_key_is_reported_before_live_gate(self):
        with self.assertRaises(ProviderError) as ctx:
            asyncio.run(NakordoniMotorhomeProvider().calculate(request()))
        self.assertEqual(ctx.exception.code, "missing_api_key")

    def test_live_is_disabled_without_network_when_key_exists(self):
        with self.assertRaises(ProviderError) as ctx:
            asyncio.run(NakordoniMotorhomeProvider(api_key="K" * 24).calculate(request()))
        self.assertEqual(ctx.exception.code, "live_routing_disabled")

    def test_fixture_preserves_beta_and_toll_state(self):
        result = NakordoniMotorhomeProvider().normalize_fixture({"ok": True, "data": {"vehicle": {"type": "motorhome", "beta": True, "beta_note": "Synthetic beta warning"}, "route": {
            "distance_m": 1000, "duration_s": 100, "geometry": [[48, 11], [45, 10]],
            "tolls": {"priced": True, "complete": False, "estimate": True, "currency": "EUR"},
        }}})
        self.assertTrue(result.synthetic)
        self.assertTrue(result.metadata["beta"])
        self.assertIsNone(result.metadata["tolls"]["total"])
        self.assertTrue(any(item.code == "motorhome_beta" for item in result.warnings))

    def test_fixture_preserves_directional_crossings_without_fabricating_wait(self):
        result = NakordoniMotorhomeProvider().normalize_fixture({"ok": True, "data": {"vehicle": {"type": "motorhome", "beta": True}, "route": {
            "distance_m": 1000, "duration_s": 100, "geometry": [[48, 11], [45, 10]],
            "border_crossings": [{"name": "Example crossing", "ppid": "id_1", "from_country": "DE", "to_country": "AT", "lat": 47.2, "lon": 11.1, "wait_min": None, "wait_at": "2026-10-26T12:00:00Z", "wait_sides": [{"basis": "live", "data_quality": "low"}], "source_url": "https://nakordoni.eu/en/p/example"}],
        }}})
        crossing = result.metadata["border_crossings"][0]
        self.assertEqual((crossing["from_country"], crossing["to_country"]), ("DE", "AT"))
        self.assertIsNone(crossing["wait_min"])
        self.assertEqual(crossing["source_url"], "https://nakordoni.eu/en/p/example")

    def test_fixture_keeps_toll_objects_and_country_coverage(self):
        result = NakordoniMotorhomeProvider().normalize_fixture({"ok": True, "data": {"route": {
            "distance_m": 1000, "duration_s": 100, "geometry": [[48, 11], [45, 10]],
            "tolls": {"currency": "EUR", "total_eur": 12.5, "complete": False, "by_country": [{"country": "AT", "amount": 12.5, "system": "distance", "status": "confirmed"}], "objects": [{"name": "Bridge", "type": "bridge", "country": "AT", "cost_eur": 2.0}]},
        }}})
        tolls = result.metadata["tolls"]
        self.assertEqual(tolls["total"], 12.5)
        self.assertEqual(tolls["countries"][0]["total"], 12.5)
        self.assertEqual(tolls["objects"][0]["type"], "bridge")

    def test_error_mapping_and_safe_links(self):
        error = provider_error_from_payload({"status": 429, "error": {"code": "quota_exceeded"}})
        self.assertEqual(error.code, "quota_exceeded")
        self.assertFalse(error.retryable)
        self.assertEqual(safe_provider_link("https://nakordoni.eu/upgrade"), "https://nakordoni.eu/upgrade")
        self.assertIsNone(safe_provider_link("https://evil.example/steal"))

    def test_manual_key_is_required_for_motorhome_but_never_echoed(self):
        self.assertEqual(validate_user_input({"provider": "nakordoni_motorhome"}), {"api_key": "invalid_api_key"})
        key = normalize_api_key(f"  {'K' * 24}  ")
        self.assertEqual(key, "K" * 24)
        for invalid in ("short", "contains space 123456", f"\n{'K' * 24}"):
            with self.assertRaises(ValueError):
                normalize_api_key(invalid)

    def test_manual_key_errors_do_not_contain_secret(self):
        secret = "S" * 24
        error = provider_error_from_payload({"status": 401, "error": {"code": "invalid_api_key", "message": secret}})
        self.assertNotIn(secret, str(error))
