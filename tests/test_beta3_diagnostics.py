import asyncio
import unittest
from dataclasses import dataclass
from types import SimpleNamespace
from unittest.mock import patch

from custom_components.camper_route_planner.const import CONF_PROVIDER, PROVIDER_NAKORDONI_MOTORHOME_V3
from custom_components.camper_route_planner.coordinator import RouteCoordinator
from custom_components.camper_route_planner.models import RouteRequest, RouteWaypoint, VehicleProfile, ProviderError
from custom_components.camper_route_planner.providers.nakordoni_motorhome import ROUTE_ENDPOINT
from custom_components.camper_route_planner.providers.nakordoni_v3 import NakordoniRouteAdapterV3, V3_ROUTE_ENDPOINT
from custom_components.camper_route_planner.runtime import RuntimeData
from custom_components.camper_route_planner.storage import MemoryStore, ProfileRouteStore
from custom_components.camper_route_planner.diagnostics import async_get_config_entry_diagnostics

_MISSING = object()


def route_payload(version="v3", *, complete=False, source="primary", total=12.5, status=200, attempts=1):
    return {
        "ok": True, "status": status, "api_version": version,
        "headers": {"X-Route-Source": source},
        "transport": {"attempts": attempts, "elapsed_s": 0.25, "status": status, "route_source": source},
        "data": {"vehicle": {"type": "motorhome", "beta": True, "height_m": 3.2, "width_m": 2.34, "length_m": 7.65, "weight_t": 4.8, "axles": 2},
                 "route": {"distance_m": 100000, "duration_s": 3600, "geometry": [[48.1, 11.5], [49.0, 12.0]],
                           "legal": True, "restriction_hits": [], "tolls": {"currency": "EUR", "total_eur": total, "complete": complete, "by_country": [{"country": "FR", "amount": total, "status": "likely"}]}}},
    }


@dataclass
class DiagnosticTransport:
    endpoint: str
    response: dict

    async def __call__(self, _parameters):
        return self.response


class Beta3DiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.profile = VehicleProfile("z", "Zoe", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=2)

    def runtime(self, response):
        store = ProfileRouteStore(MemoryStore())
        async def seed():
            await store.async_load()
            await store.async_save_profile(self.profile)
        asyncio.run(seed())
        provider = NakordoniRouteAdapterV3(api_key="K" * 24, transport=DiagnosticTransport(V3_ROUTE_ENDPOINT, response))
        return RuntimeData(RouteCoordinator(provider), store, {CONF_PROVIDER: PROVIDER_NAKORDONI_MOTORHOME_V3})

    def request_data(self):
        return {"profile_id": "z", "origin": {"latitude": 48.1, "longitude": 11.5}, "destination": {"latitude": 49.0, "longitude": 12.0}}

    def test_before_first_route_is_explicitly_empty(self):
        runtime = self.runtime(route_payload())
        self.assertEqual(runtime.diagnostics()["status"], "no_route_calculation")
        self.assertIsNone(runtime.diagnostics()["last_operation"])

    def test_v3_complete_primary_contains_only_safe_toll_fields(self):
        runtime = self.runtime(route_payload(complete=True, source="primary", total=250.24))
        asyncio.run(runtime.async_calculate_service(self.request_data()))
        diagnostic = runtime.diagnostics()
        self.assertEqual(diagnostic["route_calls"], {"v2": 0, "v3": 1})
        self.assertIsNone(diagnostic["last_operation"])
        self.assertNotIn("Authorization", str(diagnostic))
        self.assertNotIn("geometry", str(diagnostic))

    def test_v3_incomplete_fallback_and_retry_count_are_exposed(self):
        runtime = self.runtime(route_payload(complete=False, source="fallback", attempts=2, total=15.59))
        asyncio.run(runtime.async_calculate_service(self.request_data()))
        diagnostic = runtime.diagnostics()
        self.assertEqual(diagnostic["route_calls"], {"v2": 0, "v3": 2})
        self.assertIsNone(diagnostic["last_operation"])

    def test_v2_estimate_is_separate_and_increments_v2_only(self):
        runtime = self.runtime(route_payload(complete=False, total=15.59))
        asyncio.run(runtime.async_calculate_service(self.request_data()))
        v2 = route_payload("v2", complete=True, total=250.24)
        runtime.coordinator.provider.transport = DiagnosticTransport(ROUTE_ENDPOINT, v2)
        result = asyncio.run(runtime.async_estimate_tolls_v2({**self.request_data(), "current_result": {"distance_m": 100000, "duration_s": 3600, "metadata": {"api_version": "v3", "tolls": {"complete": False}}}}))
        self.assertEqual(result["source_api"], "v2")
        self.assertEqual(runtime.diagnostics()["route_calls"], {"v2": 1, "v3": 1})
        self.assertIsNone(runtime.diagnostics()["last_operation"])

    def test_provider_error_is_diagnostic_without_secret_or_location(self):
        runtime = self.runtime({"ok": False, "status": 503, "error": {"code": "busy", "message": "busy"}, "transport": {"attempts": 1, "status": 503, "elapsed_s": 0.1, "route_source": "primary"}})
        with self.assertRaises(ProviderError):
            asyncio.run(runtime.async_calculate_service(self.request_data()))
        diagnostic = runtime.diagnostics()
        self.assertEqual(diagnostic["route_calls"], {"v2": 0, "v3": 1})
        self.assertIsNone(diagnostic["last_operation"])
        self.assertNotIn("48.1", str(diagnostic))
        self.assertNotIn("K" * 24, str(diagnostic))

    def test_armed_provider_error_diagnostic_contains_safe_transport_fields(self):
        response = {"ok": False, "status": 502, "error": {"code": "provider_down", "message": "must not be shown"}, "transport": {"status": 502, "content_type": "application/json", "response_type": "json", "response_length": 91, "elapsed_s": 0.2, "attempts": 1}}
        runtime = self.runtime(response)
        token = runtime.arm_request_diagnostics()
        with self.assertRaises(ProviderError):
            asyncio.run(runtime.async_calculate_service({**self.request_data(), "via": [{"latitude": 40.0, "longitude": -3.0}], "diagnostic_token": token}))
        diagnostic = runtime.diagnostics()
        self.assertEqual(diagnostic["last_request_error"]["error_code"], "provider_down")
        self.assertEqual(diagnostic["last_request_error"]["transport"]["status"], 502)
        self.assertEqual(diagnostic["last_request_error"]["waypoint_count"], 1)
        self.assertNotIn("40.0", str(diagnostic))
        self.assertNotIn("must not be shown", str(diagnostic))
        report = runtime.get_request_diagnostic()
        self.assertEqual(report["response"]["error_code"], "provider_down")
        self.assertEqual(report["response"]["http_status"], 502)
        self.assertEqual(report["response"]["waypoint_count"], 1)
        self.assertEqual(report["response"]["response_type"], "json")
        self.assertIsNone(runtime.get_request_diagnostic())
        self.assertIsNone(runtime.diagnostics()["last_request_error"])

    def test_armed_provider_error_diagnostic_contains_safe_request_id(self):
        response = {"ok": False, "status": 504, "request_id": "req-2026.10.30:abc", "error": {"reason": "route_timeout"}, "transport": {"status": 504, "response_type": "json", "attempts": 1}}
        runtime = self.runtime(response)
        token = runtime.arm_request_diagnostics()
        with self.assertRaises(ProviderError):
            asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        report = runtime.get_request_diagnostic()
        self.assertEqual(report["response"]["request_id"], "req-2026.10.30:abc")
        self.assertEqual(report["response"]["error_code"], "route_timeout")

    def test_armed_parser_error_keeps_transport_and_safe_field_shape(self):
        response = route_payload()
        del response["data"]["route"]["duration_s"]
        response["request_id"] = "req-parser-2026.10.30"
        response["transport"].update({"content_type": "application/json", "response_type": "json", "response_length": 812})
        runtime = self.runtime(response)
        token = runtime.arm_request_diagnostics()
        with self.assertRaises(ProviderError) as context:
            asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        self.assertEqual(context.exception.code, "invalid_response")
        self.assertEqual(runtime.diagnostics()["last_request_error"]["http_status"], 200)
        self.assertEqual(runtime.diagnostics()["last_request_error"]["request_id"], "req-parser-2026.10.30")
        last_error = runtime.diagnostics()["last_request_error"]
        shape = last_error["response_shape"]
        self.assertIn("data.route.duration_s", shape["missing_fields"])
        self.assertEqual(shape["field_types"]["data.route.duration_s"], "null")
        report = runtime.get_request_diagnostic()
        self.assertEqual(report["response"]["content_type"], "application/json")
        self.assertEqual(report["response"]["response_length"], 812)
        self.assertEqual(report["response"]["request_id"], "req-parser-2026.10.30")
        self.assertEqual(report["response"]["response_shape"]["parser_exception"]["type"], "ValueError")
        self.assertEqual(report["response"]["response_shape"]["parser_exception"]["location"]["function"], "normalize_response")
        self.assertNotIn("100000", str(report))
        self.assertNotIn("48.1", str(last_error))
        self.assertNotIn("K" * 24, str(report))

    def test_armed_parser_error_reports_nested_geojson_shape_and_location(self):
        response = route_payload()
        response["data"]["route"]["geometry"] = {"type": "LineString", "coordinates": None}
        runtime = self.runtime(response)
        token = runtime.arm_request_diagnostics()
        with self.assertRaises(ProviderError):
            asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        report = runtime.get_request_diagnostic()
        shape = report["response"]["response_shape"]
        self.assertEqual(shape["geometry_shape"]["type"], "object")
        self.assertTrue(shape["geometry_shape"]["coordinates_present"])
        self.assertEqual(shape["geometry_shape"]["coordinates_type"], "null")
        self.assertEqual(shape["parser_exception"]["type"], "TypeError")
        self.assertEqual(shape["parser_exception"]["location"]["function"], "_geometry")
        self.assertNotIn("coordinates", str(shape["parser_exception"]["message"]))

    def assert_geojson_shape_failure(self, coordinates_marker, expected_coordinates_type, *, expected_length=None, expected_first_type=None):
        response = route_payload()
        geometry = {"type": "LineString"}
        if coordinates_marker is not _MISSING:
            geometry["coordinates"] = coordinates_marker
        response["data"]["route"]["geometry"] = geometry
        runtime = self.runtime(response)
        token = runtime.arm_request_diagnostics()
        with self.assertRaises(ProviderError):
            asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        report = runtime.get_request_diagnostic()
        shape = report["response"]["response_shape"]
        geo = shape["geometry_shape"]
        self.assertEqual(geo["coordinates_present"], coordinates_marker is not _MISSING)
        self.assertEqual(geo["coordinates_type"], expected_coordinates_type)
        if expected_length is not None:
            self.assertEqual(geo["coordinates_length"], expected_length)
        if expected_first_type is not None:
            self.assertEqual(geo["first_point_type"], expected_first_type)
        self.assertEqual(shape["parser_exception"]["location"]["function"], "_geometry")
        self.assertNotIn("coordinates", str(shape["parser_exception"]["message"]))
        self.assertNotIn("48.1", str(shape))

    def test_geojson_missing_coordinates_is_diagnosed_without_values(self):
        self.assert_geojson_shape_failure(_MISSING, "null")

    def test_geojson_empty_coordinates_is_diagnosed_with_length(self):
        self.assert_geojson_shape_failure([], "array", expected_length=0, expected_first_type="null")

    def test_geojson_wrong_nesting_reports_first_point_type(self):
        self.assert_geojson_shape_failure([1, 2], "array", expected_length=2, expected_first_type="number")

    def test_geojson_unexpected_point_object_reports_only_keys(self):
        response = route_payload()
        response["data"]["route"]["geometry"] = {"type": "LineString", "coordinates": [{"lat": 48.1, "lon": 11.5}]}
        runtime = self.runtime(response)
        token = runtime.arm_request_diagnostics()
        with self.assertRaises(ProviderError):
            asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        shape = runtime.get_request_diagnostic()["response"]["response_shape"]
        self.assertEqual(shape["geometry_shape"]["first_point_type"], "object")
        self.assertEqual(shape["geometry_shape"]["first_point_keys"], ["lat", "lon"])
        self.assertNotIn("48.1", str(shape))

    def test_parser_error_outside_geometry_reports_actual_parser_frame(self):
        runtime = self.runtime(route_payload())
        token = runtime.arm_request_diagnostics()
        with patch("custom_components.camper_route_planner.providers.nakordoni_v3._warnings", side_effect=TypeError("internal warning failure")):
            with self.assertRaises(ProviderError):
                asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        shape = runtime.get_request_diagnostic()["response"]["response_shape"]
        self.assertEqual(shape["parser_exception"]["type"], "TypeError")
        self.assertEqual(shape["parser_exception"]["location"]["function"], "normalize_response")
        self.assertEqual(shape["parser_exception"]["location"]["file"], "nakordoni_v3.py")
        self.assertEqual(shape["parser_exception"]["message"], "internal warning failure")

    def test_armed_request_diagnostic_contains_actual_v3_parameters_once(self):
        runtime = self.runtime(route_payload())
        token = runtime.arm_request_diagnostics()
        result = asyncio.run(runtime.async_calculate_service({**self.request_data(), "via": [{"latitude": 40.0, "longitude": -3.0}], "diagnostic_token": token}))
        snapshot = result["request_diagnostic"]
        self.assertEqual(snapshot["request"]["api_version"], "v3")
        self.assertEqual(snapshot["request"]["parameters"]["via"], "40.0,-3.0")
        self.assertEqual(snapshot["response"]["api_version"], "v3")
        self.assertEqual(snapshot["response"]["waypoint_count"], 1)
        self.assertEqual(snapshot["response"]["http_status"], 200)
        self.assertIn("response_type", snapshot["response"])
        self.assertIsNone(snapshot["response"]["error_code"])
        self.assertEqual(snapshot["response"]["distance_m"], 100000)
        self.assertEqual(snapshot["response"]["duration_s"], 3600)
        self.assertNotIn("Authorization", str(snapshot))
        self.assertNotIn("KKKK", str(snapshot))
        self.assertIsNone(runtime.diagnostics()["last_operation"])

    def test_restriction_rejection_report_keeps_only_safe_codes(self):
        response = route_payload()
        response["data"]["route"]["legal"] = False
        response["data"]["route"]["restriction_hits"] = [
            {"code": "HEIGHT", "description": "bridge at 48.123456, 11.654321", "segment_index": 4},
            {"code": "WEIGHT", "description": "weight limit", "waypoint_index": 1},
        ]
        runtime = self.runtime(response)
        token = runtime.arm_request_diagnostics()
        with self.assertRaises(ProviderError):
            asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        report = runtime.get_request_diagnostic()
        self.assertEqual(report["response"]["error_code"], "route_restrictions_unresolved")
        self.assertEqual(report["response"]["restriction_codes"], ["HEIGHT", "WEIGHT"])
        self.assertNotIn("48.123456", str(report))
        self.assertNotIn("bridge at", str(report))

    def test_request_diagnostic_arm_is_consumed_on_failed_call(self):
        runtime = self.runtime({"ok": False, "status": 503, "error": {"code": "busy", "message": "busy"}, "transport": {"attempts": 1, "status": 503}})
        token = runtime.arm_request_diagnostics()
        with self.assertRaises(ProviderError):
            asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        runtime.coordinator.provider.transport.response = route_payload()
        result = asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        self.assertNotIn("request_diagnostic", result)

    def test_request_diagnostic_token_is_one_shot_for_parallel_calls(self):
        runtime = self.runtime(route_payload())
        token = runtime.arm_request_diagnostics()

        async def run_parallel():
            return await asyncio.gather(
                runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}),
                runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}),
            )

        results = asyncio.run(run_parallel())
        self.assertEqual(sum("request_diagnostic" in result for result in results), 1)

    def test_request_diagnostic_can_be_disarmed_before_calculation(self):
        runtime = self.runtime(route_payload())
        token = runtime.arm_request_diagnostics()
        runtime.disarm_request_diagnostics()
        result = asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token}))
        self.assertNotIn("request_diagnostic", result)

    def test_native_diagnostics_never_expose_request_snapshot(self):
        runtime = self.runtime(route_payload())
        token = runtime.arm_request_diagnostics()
        asyncio.run(runtime.async_calculate_service({**self.request_data(), "diagnostic_token": token, "via": [{"latitude": 40.0, "longitude": -3.0}]}))
        snapshot = runtime.diagnostics()
        self.assertIsNone(snapshot["last_operation"])
        self.assertNotIn("coordinates", str(snapshot))
        self.assertNotIn("waypoints", str(snapshot))
        self.assertNotIn("KKKK", str(snapshot))

    def test_native_diagnostics_selects_the_matching_runtime(self):
        first = self.runtime(route_payload(total=1.0))
        second = self.runtime(route_payload(total=2.0))
        hass = SimpleNamespace(data={"camper_route_planner": {"first": first, "second": second}})
        first_entry = SimpleNamespace(entry_id="first")
        second_entry = SimpleNamespace(entry_id="second")
        first_snapshot = asyncio.run(async_get_config_entry_diagnostics(hass, first_entry))
        second_snapshot = asyncio.run(async_get_config_entry_diagnostics(hass, second_entry))
        self.assertEqual(first_snapshot["configured_provider"], PROVIDER_NAKORDONI_MOTORHOME_V3)
        self.assertIsNone(first_snapshot["last_operation"])
        self.assertEqual(second_snapshot["route_calls"], {"v2": 0, "v3": 0})


if __name__ == "__main__":
    unittest.main()
