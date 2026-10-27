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

    def test_optional_emission_class_is_only_sent_when_profile_supplies_it(self):
        self.assertNotIn("emission_class", build_motorhome_parameters(request()))
        profile = VehicleProfile("c", "Carthago", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=2, emission_class="euro6")
        self.assertEqual(build_motorhome_parameters(request(vehicle=profile))["emission_class"], "euro6")

    def test_optional_profile_fields_are_persisted_but_only_supported_api_fields_are_sent(self):
        profile = VehicleProfile(
            "c", "Carthago", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel",
            axles=2, emission_class="euro5", co2_class="c",
            first_registration="2020-04-15", consumption_l_per_100km=11.2,
        )
        self.assertEqual(profile.as_dict()["co2_class"], "c")
        self.assertEqual(profile.as_dict()["first_registration"], "2020-04-15")
        self.assertEqual(profile.as_dict()["consumption_l_per_100km"], 11.2)
        params = build_motorhome_parameters(request(vehicle=profile))
        self.assertEqual(params["emission_class"], "euro5")
        self.assertNotIn("co2_class", params)
        self.assertNotIn("first_registration", params)
        self.assertNotIn("consumption_l_per_100km", params)

    def test_optional_profile_field_validation_is_explicit(self):
        with self.assertRaises(ValidationError):
            VehicleProfile("c", "Carthago", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", co2_class="z")
        with self.assertRaises(ValidationError):
            VehicleProfile("c", "Carthago", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", first_registration="15.04.2020")
        with self.assertRaises(ValidationError):
            VehicleProfile("c", "Carthago", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", consumption_l_per_100km=0)

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

    def test_ordered_countries_produce_explicitly_inferred_transitions(self):
        result = NakordoniMotorhomeProvider().normalize_fixture({"ok": True, "data": {"route": {
            "distance_m": 1000, "duration_s": 100, "geometry": [[48, 11], [46, 7]],
            "countries": ["DE", "FR", "CH"], "border_crossings": [],
        }}})
        crossings = result.metadata["border_crossings"]
        self.assertEqual([(item["from_country"], item["to_country"]) for item in crossings], [("DE", "FR"), ("FR", "CH")])
        self.assertTrue(all(item["inferred"] and item["lat"] is None and item["wait_min"] is None for item in crossings))
        self.assertEqual(result.metadata["border_state"], "ordered_country_sequence")

    def test_country_split_is_ordered_fallback(self):
        result = NakordoniMotorhomeProvider().normalize_fixture({"ok": True, "data": {"route": {
            "distance_m": 1000, "duration_s": 100, "geometry": [[48, 11], [46, 7]],
            "country_split": [{"country": "DE"}, {"country": "AT"}, {"country": "IT"}],
        }}})
        self.assertEqual([(x["from_country"], x["to_country"]) for x in result.metadata["border_crossings"]], [("DE", "AT"), ("AT", "IT")])

    def test_unordered_country_map_never_becomes_a_sequence(self):
        result = NakordoniMotorhomeProvider().normalize_fixture({"ok": True, "data": {"route": {
            "distance_m": 1000, "duration_s": 100, "geometry": [[48, 11], [46, 7]],
            "countries": {"DE": {"km": 100}, "FR": {"km": 50}, "CH": {"km": 20}},
        }}})
        self.assertEqual(result.metadata["border_crossings"], [])
        self.assertEqual(result.metadata["border_state"], "unordered_international")

    def test_national_route_is_not_reported_as_international(self):
        result = NakordoniMotorhomeProvider().normalize_fixture({"ok": True, "data": {"route": {
            "distance_m": 1000, "duration_s": 100, "geometry": [[48, 11], [47, 10]], "countries": ["DE"],
        }}})
        self.assertEqual(result.metadata["border_crossings"], [])
        self.assertEqual(result.metadata["border_state"], "national_or_unknown")

    def test_nested_border_payload_and_coordinate_aliases_are_normalized(self):
        payload = {
            "ok": True,
            "data": {"route": {
                "distance_m": 1000,
                "duration_s": 100,
                "geometry": [[48, 11], [46, 7]],
                "border_crossings": {"items": [{"from_country": "DE", "to_country": "AT", "latitude": 47.1, "longitude": 11.2}]},
            }},
        }
        result = NakordoniMotorhomeProvider().normalize_fixture(payload)
        crossing = result.metadata["border_crossings"][0]
        self.assertEqual((crossing["lat"], crossing["lon"]), (47.1, 11.2))
        self.assertEqual(result.metadata["border_state"], "confirmed")

    def test_returned_vehicle_emission_class_is_preserved_and_uncertainty_is_explicit(self):
        result = NakordoniMotorhomeProvider().normalize_fixture({"ok": True, "data": {"vehicle": {"emission_class": "euro6"}, "route": {
            "distance_m": 1000, "duration_s": 100, "geometry": [[48, 11], [46, 7]],
        }}})
        self.assertEqual(result.metadata["emission_class_returned"], "euro6")
        self.assertFalse(result.metadata["tariff_basis_uncertain"])

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
