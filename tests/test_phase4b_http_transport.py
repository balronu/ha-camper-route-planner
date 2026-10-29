import asyncio
import unittest

from custom_components.camper_route_planner.providers.http_transport import ClientTimeout

from custom_components.camper_route_planner.providers.http_transport import NakordoniHttpTransport, NakordoniUsageTransport
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
