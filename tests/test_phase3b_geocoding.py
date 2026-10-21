import asyncio
import unittest

from custom_components.camper_route_planner.geocoding import GeoapifyGeocoder, GeocodingError


class Response:
    status = 200

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def json(self):
        return {"results": [{"formatted": "Berlin, Deutschland", "lat": 52.52, "lon": 13.405}]}


class Session:
    def __init__(self):
        self.calls = []

    def get(self, url):
        self.calls.append(url)
        return Response()


class RateLimitedResponse(Response):
    status = 429


class RateLimitedSession(Session):
    def get(self, url):
        self.calls.append(url)
        return RateLimitedResponse()


class Phase3BGeocodingTests(unittest.TestCase):
    def test_normalizes_geoapify_results_and_caches(self):
        session = Session()
        geocoder = GeoapifyGeocoder("fixture-key", session=session, clock=lambda: 100.0)
        first = asyncio.run(geocoder.async_search(" Berlin "))
        second = asyncio.run(geocoder.async_search("Berlin"))
        self.assertEqual(first, [{"label": "Berlin, Deutschland", "latitude": 52.52, "longitude": 13.405}])
        self.assertEqual(first, second)
        self.assertEqual(len(session.calls), 1)
        self.assertIn("apiKey=fixture-key", session.calls[0])

    def test_short_query_does_not_call_provider(self):
        session = Session()
        result = asyncio.run(GeoapifyGeocoder("key", session=session).async_search("B"))
        self.assertEqual(result, [])
        self.assertEqual(session.calls, [])

    def test_rate_limit_is_safe_error(self):
        with self.assertRaises(GeocodingError) as error:
            asyncio.run(GeoapifyGeocoder("key", session=RateLimitedSession()).async_search("Berlin"))
        self.assertEqual(str(error.exception), "rate_limited")


if __name__ == "__main__":
    unittest.main()
