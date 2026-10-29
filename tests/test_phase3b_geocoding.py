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


class EmptyResponse(Response):
    async def json(self):
        return {"results": []}


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

    def test_search_discards_zero_zero_result(self):
        class ZeroResultSession(Session):
            def get(self, url):
                self.calls.append(url)
                return type("ZeroResponse", (Response,), {"json": lambda _self: asyncio.sleep(0, result={"results": [{"formatted": "Gondifelos", "lat": 0, "lon": 0}, {"formatted": "Valid", "lat": 41.0, "lon": -8.0}]})})()

        result = asyncio.run(GeoapifyGeocoder("key", session=ZeroResultSession()).async_search("Gondifelos"))
        self.assertEqual(result, [{"label": "Valid", "latitude": 41.0, "longitude": -8.0}])

    def test_rate_limit_is_safe_error(self):
        with self.assertRaises(GeocodingError) as error:
            asyncio.run(GeoapifyGeocoder("key", session=RateLimitedSession()).async_search("Berlin"))
        self.assertEqual(str(error.exception), "rate_limited")

    def test_reverse_normalizes_and_caches_address(self):
        session = Session()
        geocoder = GeoapifyGeocoder("fixture-key", session=session, clock=lambda: 100.0)
        first = asyncio.run(geocoder.async_reverse(52.5200001, 13.4050001))
        second = asyncio.run(geocoder.async_reverse(52.5200002, 13.4050002))
        self.assertEqual(first, "Berlin, Deutschland")
        self.assertEqual(first, second)
        self.assertEqual(len(session.calls), 1)
        self.assertIn("lat=52.52", session.calls[0])
        self.assertIn("lon=13.405", session.calls[0])

    def test_reverse_rejects_invalid_coordinates_without_provider_call(self):
        session = Session()
        with self.assertRaises(GeocodingError) as error:
            asyncio.run(GeoapifyGeocoder("key", session=session).async_reverse(91, 7))
        self.assertEqual(str(error.exception), "invalid_coordinates")
        self.assertEqual(session.calls, [])
        with self.assertRaises(GeocodingError) as zero_error:
            asyncio.run(GeoapifyGeocoder("key", session=session).async_reverse(0, 0))
        self.assertEqual(str(zero_error.exception), "invalid_coordinates")
        self.assertEqual(session.calls, [])

    def test_reverse_empty_result_is_a_safe_fallback(self):
        class EmptySession(Session):
            def get(self, url):
                self.calls.append(url)
                return EmptyResponse()

        self.assertIsNone(asyncio.run(GeoapifyGeocoder("key", session=EmptySession()).async_reverse(52.52, 13.405)))


if __name__ == "__main__":
    unittest.main()
