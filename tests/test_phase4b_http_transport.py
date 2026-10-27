import asyncio
import unittest

from custom_components.camper_route_planner.providers.http_transport import ClientTimeout

from custom_components.camper_route_planner.providers.http_transport import NakordoniHttpTransport
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

    def test_missing_key_is_rejected_before_transport(self):
        with self.assertRaises(ValueError):
            asyncio.run(NakordoniHttpTransport(FakeSession(), "")({}))

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
