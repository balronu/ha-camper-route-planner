import asyncio
import unittest

from custom_components.camper_route_planner.providers.http_transport import ClientTimeout

from custom_components.camper_route_planner.providers.http_transport import NakordoniHttpTransport, NakordoniUsageTransport
from custom_components.camper_route_planner.models import ProviderError
from custom_components.camper_route_planner.providers.usage import normalize_usage
from custom_components.camper_route_planner.providers.nakordoni_motorhome import NakordoniMotorhomeProvider


class FakeResponse:
    status = 200
    headers = {
        "X-Devapi-Limit": "10",
        "X-Devapi-Remaining": "9",
        "X-Secret": "must-not-be-forwarded",
    }

    async def json(self, *, content_type=None):
        del content_type
        return {"ok": True, "data": {"route": {"distance_m": 1}}}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class FakeSession:
    def __init__(self):
        self.calls = []

    def get(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return FakeResponse()


class BodyResponse:
    def __init__(self, body, *, status=200, content_type="application/json"):
        self.body = body
        self.status = status
        self.headers = {"Content-Type": content_type}

    async def read(self):
        return self.body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class BodySession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def get(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return self.response


class Phase4BHttpTransportTests(unittest.TestCase):
    def test_bearer_auth_query_and_quota_headers_are_bounded(self):
        session = FakeSession()
        transport = NakordoniHttpTransport(session, "SECRET-KEY", timeout_s=60, connect_timeout_s=10)
        payload = asyncio.run(transport({"from": "48,11", "to": "45,10", "via": "47,11"}))
        args, kwargs = session.calls[0]
        self.assertEqual(args[0], transport.endpoint)
        self.assertEqual(kwargs["headers"], {"Authorization": "Bearer SECRET-KEY"})
        self.assertIsInstance(kwargs["timeout"], ClientTimeout)
        self.assertEqual(kwargs["timeout"].total, 60)
        self.assertEqual(kwargs["timeout"].connect, 10)
        self.assertEqual(kwargs["params"]["via"], "47,11")
        self.assertEqual(payload["headers"], {"X-Devapi-Limit": "10", "X-Devapi-Remaining": "9"})

    def test_route_source_is_safe_and_busy_retry_is_bounded(self):
        class BusyResponse(FakeResponse):
            status = 503
            headers = {"X-Route-Source": "fallback", "Retry-After": "0"}

            async def json(self, *, content_type=None):
                del content_type
                return {"ok": False, "error": {"code": "busy", "retry_after": 0}}

        class SuccessResponse(FakeResponse):
            headers = {"X-Route-Source": "primary"}

        class BusyThenSuccess(FakeSession):
            def get(self, *args, **kwargs):
                self.calls.append((args, kwargs))
                return BusyResponse() if len(self.calls) == 1 else SuccessResponse()

        session = BusyThenSuccess()
        payload = asyncio.run(NakordoniHttpTransport(session, "SECRET-KEY", min_interval_s=0, max_busy_retries=1)({}))
        self.assertEqual(len(session.calls), 2)
        self.assertEqual(payload["headers"], {"X-Route-Source": "primary"})
        self.assertEqual(payload["transport"]["attempts"], 2)

    def test_missing_key_is_rejected_before_transport(self):
        with self.assertRaises(ValueError):
            asyncio.run(NakordoniHttpTransport(FakeSession(), "")({}))

    def test_empty_html_and_invalid_json_are_classified_without_body_retention(self):
        cases = ((b"", "empty_response", "empty"), (b"<html>gateway</html>", "html_response", "html"), (b"{not-json", "invalid_json", "invalid_json"))
        for body, code, response_type in cases:
            with self.subTest(code=code):
                transport = NakordoniHttpTransport(BodySession(BodyResponse(body)), "SECRET-KEY", min_interval_s=0)
                with self.assertRaises(ProviderError) as ctx:
                    asyncio.run(transport({}))
                self.assertEqual(ctx.exception.code, code)
                self.assertEqual(ctx.exception.details["transport"]["response_type"], response_type)
                self.assertNotIn("gateway", str(ctx.exception.details))

    def test_http_status_is_preserved_even_when_body_is_not_json(self):
        for status, code, retryable in ((400, "invalid_request", False), (401, "unauthorized", False), (403, "forbidden", False), (404, "not_found", False), (408, "provider_timeout", True), (429, "quota_exceeded", False), (500, "provider_unavailable", True), (502, "provider_unavailable", True), (503, "provider_unavailable", True), (504, "provider_unavailable", True)):
            with self.subTest(status=status):
                transport = NakordoniHttpTransport(BodySession(BodyResponse(b"not-json", status=status, content_type="text/plain")), "SECRET-KEY", min_interval_s=0)
                with self.assertRaises(ProviderError) as ctx:
                    asyncio.run(transport({}))
                self.assertEqual(ctx.exception.status, status)
                self.assertEqual(ctx.exception.code, code)
                self.assertEqual(ctx.exception.retryable, retryable)
                self.assertEqual(ctx.exception.details["transport"]["content_type"], "text/plain")

    def test_structured_error_keeps_only_safe_transport_metadata(self):
        body = b'{"ok": false, "error": {"code": "quota_exceeded", "message": "private detail"}}'
        payload = asyncio.run(NakordoniHttpTransport(BodySession(BodyResponse(body, status=429)), "SECRET-KEY", min_interval_s=0)({}))
        self.assertEqual(payload["status"], 429)
        self.assertEqual(payload["transport"]["response_length"], len(body))
        self.assertEqual(payload["transport"]["response_type"], "json")

    def test_request_id_is_taken_from_header_but_not_exposed_as_raw_header(self):
        response = BodyResponse(b'{"ok": false, "status": 400, "error": {"reason": "point_not_routable", "waypoint_index": 1, "coordinates": {"latitude": 43.1, "longitude": -9.8}}}', status=400)
        response.headers["X-Request-Id"] = "req_2026.10:abc-123"
        payload = asyncio.run(NakordoniHttpTransport(BodySession(response), "SECRET-KEY", min_interval_s=0)({}))
        self.assertEqual(payload["request_id"], "req_2026.10:abc-123")
        self.assertNotIn("X-Request-Id", payload["headers"])

    def test_unsafe_request_id_is_discarded(self):
        response = BodyResponse(b'{"ok": false, "status": 504, "request_id": "secret value", "error": {"reason": "route_timeout"}}', status=504)
        payload = asyncio.run(NakordoniHttpTransport(BodySession(response), "SECRET-KEY", min_interval_s=0)({}))
        self.assertNotIn("request_id", payload)
        self.assertNotIn("request_id", payload["headers"])

    def test_http_504_is_not_retried(self):
        response = BodyResponse(b'{"ok": false, "status": 504, "error": {"reason": "route_timeout"}}', status=504)
        session = BodySession(response)
        payload = asyncio.run(NakordoniHttpTransport(session, "SECRET-KEY", min_interval_s=0)({}))
        self.assertEqual(len(session.calls), 1)
        self.assertEqual(payload["status"], 504)

    def test_usage_transport_is_single_bounded_get_without_redirects(self):
        class UsageResponse(FakeResponse):
            async def json(self, *, content_type=None):
                del content_type
                return {"ok": True, "data": {"plan": {"name": "Explorer"}, "quotas": {"route": {"limit": 10, "used": 2, "remaining": 8}}}}

        class UsageSession(FakeSession):
            def get(self, *args, **kwargs):
                self.calls.append((args, kwargs))
                return UsageResponse()

        session = UsageSession()
        payload = asyncio.run(NakordoniUsageTransport(session, "SECRET-KEY")())
        args, kwargs = session.calls[0]
        self.assertEqual(args[0], "https://api.nakordoni.dev/api/v2/account/usage")
        self.assertEqual(kwargs["headers"], {"Authorization": "Bearer SECRET-KEY"})
        self.assertFalse(kwargs["allow_redirects"])
        self.assertEqual(normalize_usage(payload).remaining, 8)
        self.assertEqual(len(session.calls), 1)

    def test_usage_public_projection_contains_no_secret_or_headers(self):
        result = normalize_usage({"ok": True, "status": 200, "data": {"plan": {"name": "Explorer"}, "quotas": {"route": {"limit": 10, "used": 2, "remaining": 8}}}}).as_public_dict(status=200)
        self.assertEqual(result["quota"]["remaining"], 8)
        self.assertNotIn("headers", result)
        self.assertNotIn("api_key", result)

    def test_geojson_geometry_uses_longitude_latitude_order(self):
        result = NakordoniMotorhomeProvider().normalize_fixture({
            "ok": True,
            "data": {"route": {
                "distance_m": 1000,
                "duration_s": 100,
                "geometry": {"type": "LineString", "coordinates": [[11.5, 48.1], [10.9, 45.4]]},
            }},
        })
        self.assertEqual(result.geometry.points[0].latitude, 48.1)
        self.assertEqual(result.geometry.points[0].longitude, 11.5)


if __name__ == "__main__":
    unittest.main()
