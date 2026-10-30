import asyncio
from datetime import datetime, timezone
import unittest

from custom_components.camper_route_planner.models import ProviderError, RouteRequest, RouteWaypoint, ValidationError, VehicleProfile
from custom_components.camper_route_planner.providers.nakordoni_v3 import (
    NakordoniRouteAdapterV2,
    NakordoniRouteAdapterV3,
    V3_ROUTE_ENDPOINT,
    build_v3_motorhome_parameters,
)
from custom_components.camper_route_planner.providers.nakordoni_motorhome import provider_error_from_payload


def request(**changes):
    vehicle = VehicleProfile("zoe-fixture", "Carthago chic e-line I 50 Yachting", "motorhome", 3.20, 2.34, 7.65, 4800, "diesel", axles=2, emission_class="euro5", axle_load_kg=2400)
    vehicle = changes.pop("vehicle", vehicle)
    values = {"traffic": "forecast", "geometry_format": "geojson", "avoid": ("tolls",), "route_type": "eco", "depart_at": datetime(2026, 10, 29, 8, 0, tzinfo=timezone.utc)}
    values.update(changes)
    return RouteRequest(RouteWaypoint(48.137, 11.575), RouteWaypoint(45.438, 10.992), vehicle, **values)


def payload(**changes):
    value = {
        "ok": True,
        "api_version": "v3",
        "data": {
            "vehicle": {"type": "motorhome", "beta": True, "beta_note": "fixture", "height_m": 3.2, "width_m": 2.34, "length_m": 7.65, "weight_t": 4.8, "axles": 2},
            "route": {"distance_m": 123000, "duration_s": 7200, "geometry": {"type": "LineString", "coordinates": [[11.575, 48.137], [10.992, 45.438]]}, "geometry_format": "geojson", "legal": True, "restriction_hits": [], "countries": ["DE", "AT", "IT"]},
            "eta": {"driving_time_min": 120, "total_time_min": 150},
            "waits": [],
        },
    }
    for key, val in changes.items():
        value["data"]["route"][key] = val
    return value


class Phase2ANakordoniV3Tests(unittest.TestCase):
    def test_v3_endpoint_is_separate_and_v2_facade_unchanged(self):
        self.assertEqual(V3_ROUTE_ENDPOINT, "https://nakordoni.eu/api/v3/data/truck-route")
        self.assertEqual(NakordoniRouteAdapterV2().endpoint, "https://nakordoni.eu/api/v2/data/truck-route")

    def test_builder_emits_strict_motorhome_units_and_options(self):
        values = build_v3_motorhome_parameters(request())
        self.assertEqual(values["vehicle_type"], "motorhome")
        self.assertEqual((values["length"], values["width"], values["height"], values["weight"], values["axles"]), (7.65, 2.34, 3.2, 4.8, 2))
        self.assertEqual(values["axle_load"], 2.4)
        self.assertEqual(values["avoid"], "tolls")
        self.assertEqual(values["route_type"], "eco")
        self.assertNotIn("crew", values)
        self.assertNotIn("driven_since_break_min", values)

    def test_builder_rejects_non_motorhome_and_missing_safety_value(self):
        with self.assertRaises(ValidationError):
            build_v3_motorhome_parameters(request(vehicle=VehicleProfile("car", "Car", "car", 1.8, 1.8, 4.2, 1800, "petrol")))
        vehicle = request().vehicle
        object.__setattr__(vehicle, "height_m", None)
        with self.assertRaises(ValidationError):
            build_v3_motorhome_parameters(request(vehicle=vehicle))

    def test_builder_rejects_v3_axle_bounds(self):
        vehicle = request().vehicle
        object.__setattr__(vehicle, "axles", 1)
        with self.assertRaises(ValidationError):
            build_v3_motorhome_parameters(request(vehicle=vehicle))

    def test_response_requires_explicit_v3_motorhome_and_restriction_confirmation(self):
        adapter = NakordoniRouteAdapterV3()
        for change, code in (({"api_version": "v2"}, "safety_unconfirmed"), ({"vehicle": {"type": "truck"}}, "vehicle_type_mismatch"), ({"legal": None}, "safety_unconfirmed")):
            body = payload()
            if change.get("api_version"):
                body["api_version"] = change["api_version"]
            else:
                body["data"]["vehicle"] = change.get("vehicle", body["data"]["vehicle"])
                body["data"]["route"]["legal"] = change.get("legal", body["data"]["route"]["legal"])
            with self.assertRaises(ProviderError) as ctx:
                adapter.normalize_response(body, request=request())
            self.assertEqual(ctx.exception.code, code)

    def test_response_rejects_vehicle_mismatch_and_restriction_hits(self):
        adapter = NakordoniRouteAdapterV3()
        body = payload()
        body["data"]["vehicle"]["height_m"] = 3.5
        with self.assertRaises(ProviderError) as ctx:
            adapter.normalize_response(body, request=request())
        self.assertEqual(ctx.exception.code, "vehicle_confirmation_mismatch")
        body = payload()
        body["data"]["route"]["restriction_hits"] = [{"kind": "height", "name": "low bridge", "message": "Low bridge at 48.123456, 7.123456"}, {"code": "weight", "description": "Weight limit"}]
        with self.assertRaises(ProviderError) as ctx:
            adapter.normalize_response(body, request=request())
        self.assertEqual(ctx.exception.code, "route_restrictions_unresolved")
        self.assertEqual(ctx.exception.details["restriction_count"], 2)
        self.assertEqual(ctx.exception.details["restriction_hits"][1]["description"], "Weight limit")
        self.assertNotIn("48.123456", str(ctx.exception.details))

    def test_multiple_waypoints_are_sent_in_order_and_are_not_repaired(self):
        values = build_v3_motorhome_parameters(request(waypoints=(RouteWaypoint(40.0, -3.0, "first"), RouteWaypoint(41.0, -4.0, "second"))))
        self.assertEqual(values["via"], "40.0,-3.0|41.0,-4.0")

    def test_response_preserves_pure_driving_time_without_fabricating_eta(self):
        result = NakordoniRouteAdapterV3().normalize_response(payload(), request=request())
        self.assertEqual(result.duration_s, 7200)
        self.assertEqual(result.metadata["pure_driving_time_s"], 7200)
        self.assertEqual(result.metadata["total_eta_s"], 9000)
        self.assertEqual(result.metadata["border_wait_s"], 0)
        self.assertEqual(result.metadata["registration_wait_s"], 0)
        self.assertEqual(result.geometry.points[0].longitude, 11.575)

    def test_stale_wait_is_none_and_registration_fields_are_preserved(self):
        body = payload(border_crossings=[{"wait_min": None, "registration_required": True, "registration_wait_minutes": 35, "registration_wait_source": "echerha", "registration_wait_at": "2026-10-29T09:00:00Z", "registration_note": "register", "registration_url": "https://nakordoni.eu/register"}], warnings=[{"code": "echerha_wait_unverified", "message": "stale"}])
        body["data"]["waits"] = [{"type": "border_wait", "duration_min": 35, "counts_as": "break"}]
        result = NakordoniRouteAdapterV3().normalize_response(body, request=request())
        crossing = result.metadata["border_crossings"][0]
        self.assertIsNone(crossing["wait_min"])
        self.assertTrue(crossing["registration_required"])
        self.assertEqual(crossing["registration_wait_source"], "echerha")
        self.assertEqual(crossing["registration_url"], "https://nakordoni.eu/register")
        self.assertEqual(result.metadata["waits"][0]["counts_as"], "break")
        self.assertTrue(any(item.code == "echerha_wait_unverified" for item in result.warnings))

    def test_echerha_flags_create_explicit_warnings_without_zero_defaults(self):
        body = payload()
        body["data"]["echerha_registration"] = True
        body["data"]["echerha_wait_unverified"] = True
        body["data"]["eta"] = {"driving_time_min": 120}
        result = NakordoniRouteAdapterV3().normalize_response(body, request=request())
        codes = {item.code for item in result.warnings}
        self.assertIn("echerha_registration", codes)
        self.assertIn("echerha_wait_unverified", codes)
        self.assertIsNone(result.metadata["total_eta_s"])

    def test_polyline5_and_polyline6_are_decoded_with_declared_precision(self):
        # Encoded line: (38.5,-120.2) -> (40.7,-120.95) -> (43.252,-126.453)
        encoded5 = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
        body = payload()
        body["data"]["route"].update({"geometry": encoded5, "geometry_format": "polyline5"})
        result = NakordoniRouteAdapterV3().normalize_response(body, request=request(geometry_format="polyline5"))
        self.assertAlmostEqual(result.geometry.points[0].latitude, 38.5)
        self.assertAlmostEqual(result.geometry.points[-1].longitude, -126.453, places=4)

    def test_options_are_kept_separate_from_response_time_semantics(self):
        result = NakordoniRouteAdapterV3().normalize_response(payload(), request=request(traffic="off", avoid=("ferries",), route_type="fastest", arrive_at=datetime(2026, 10, 30, 12, tzinfo=timezone.utc), depart_at=None))
        options = result.metadata["request_options"]
        self.assertEqual(options["traffic"], "off")
        self.assertEqual(options["avoid"], ["ferries"])
        self.assertIsNotNone(options["arrive_at"])
        self.assertIsNone(options["depart_at"])

    def test_v3_normalizes_toll_total_and_infers_only_explicit_country_order(self):
        body = payload()
        body["data"]["route"].update({
            "countries": ["DE", "FR", "ES", "PT"],
            "tolls": {"total_eur": 42.5, "currency": "EUR", "complete": False, "by_country": [{"country": "DE", "amount": 0, "system": "none"}]},
        })
        result = NakordoniRouteAdapterV3().normalize_response(body, request=request())
        self.assertEqual(result.metadata["tolls"]["total"], 42.5)
        self.assertEqual(result.metadata["tolls"]["countries"][0]["total"], 0)
        self.assertEqual([(item["from_country"], item["to_country"]) for item in result.metadata["border_crossings"]], [("DE", "FR"), ("FR", "ES"), ("ES", "PT")])
        self.assertEqual(result.metadata["border_state"], "ordered_country_sequence")

    def test_v3_distinguishes_missing_border_data_from_national_route(self):
        body = payload()
        body["data"]["route"]["countries"] = {"DE": {"km": 100}, "PT": {"km": 200}}
        result = NakordoniRouteAdapterV3().normalize_response(body, request=request())
        self.assertEqual(result.metadata["border_crossings"], [])
        self.assertEqual(result.metadata["border_state"], "unordered_international")

    def test_motorhome_does_not_apply_truck_rest_plan(self):
        body = payload()
        body["data"]["rest_plan"] = [{"type": "daily_rest", "duration_min": 660}]
        result = NakordoniRouteAdapterV3().normalize_response(body, request=request())
        self.assertIsNone(result.metadata["rest_plan"])
        self.assertTrue(result.metadata["provider_rest_plan_ignored"])
        self.assertTrue(any(item.code == "motorhome_rest_ignored" for item in result.warnings))

    def test_provider_links_are_allowlisted(self):
        body = payload(border_crossings=[{"source_url": "https://evil.example/leak", "registration_url": "https://nakordoni.eu/register"}])
        result = NakordoniRouteAdapterV3().normalize_response(body, request=request())
        crossing = result.metadata["border_crossings"][0]
        self.assertIsNone(crossing["source_url"])
        self.assertEqual(crossing["registration_url"], "https://nakordoni.eu/register")

    def test_missing_geometry_and_error_payloads_are_explicit(self):
        adapter = NakordoniRouteAdapterV3()
        body = payload()
        body["data"]["route"].pop("geometry")
        with self.assertRaises(ProviderError) as ctx:
            adapter.normalize_response(body, request=request())
        self.assertEqual(ctx.exception.code, "invalid_response")
        for status in (400, 401, 403, 404, 408, 429, 500, 502, 503, 504):
            with self.assertRaises(ProviderError) as ctx:
                adapter.normalize_response({"ok": False, "status": status, "error": {"code": "provider_error"}}, request=request())
            self.assertEqual(ctx.exception.status, status)
            self.assertEqual(ctx.exception.retryable, status in {408, 500, 502, 503, 504})

    def test_injected_transport_is_the_only_calculation_path(self):
        captured = {}

        async def transport(parameters):
            captured.update(parameters)
            return payload()

        result = asyncio.run(NakordoniRouteAdapterV3(api_key="dummy-key", transport=transport).calculate(request()))
        self.assertFalse(result.synthetic)
        self.assertEqual(captured["vehicle_type"], "motorhome")

    def test_missing_key_or_transport_does_not_call_network(self):
        called = False

        async def transport(_parameters):
            nonlocal called
            called = True
            return payload()

        with self.assertRaises(ProviderError) as ctx:
            asyncio.run(NakordoniRouteAdapterV3(transport=transport).calculate(request()))
        self.assertEqual(ctx.exception.code, "missing_api_key")
        with self.assertRaises(ProviderError) as ctx:
            asyncio.run(NakordoniRouteAdapterV3(api_key="dummy-key").calculate(request()))
        self.assertEqual(ctx.exception.code, "live_routing_disabled")
        self.assertFalse(called)

    def test_point_not_routable_is_localized_and_bounded(self):
        error = provider_error_from_payload({
            "ok": False, "status": 400, "request_id": "req-42",
            "error": {"reason": "point_not_routable", "waypoint_index": 2, "coordinates": {"latitude": 43.1172, "longitude": -9.8083}},
        })
        self.assertEqual(error.code, "point_not_routable")
        self.assertFalse(error.retryable)
        self.assertEqual(error.details["request_id"], "req-42")
        self.assertEqual(error.details["waypoint_index"], 2)
        self.assertEqual(error.details["coordinates"]["longitude"], -9.8083)
        self.assertIn("Wegpunkt", str(error))

    def test_route_timeout_is_retryable_only_for_explicit_user_retry(self):
        error = provider_error_from_payload({"ok": False, "status": 504, "error": {"reason": "route_timeout"}})
        self.assertEqual(error.code, "route_timeout")
        self.assertTrue(error.retryable)
        self.assertIn("Zeitlimit", str(error))


if __name__ == "__main__":
    unittest.main()
