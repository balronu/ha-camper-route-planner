import unittest

from custom_components.camper_route_planner.models import RouteRequest, RouteWaypoint, VehicleProfile
from custom_components.camper_route_planner.providers.nakordoni_v3 import NakordoniRouteAdapterV3, build_v3_motorhome_parameters
from custom_components.camper_route_planner.providers.poi import normalize_pois


def request(**changes):
    vehicle = VehicleProfile("test", "Test motorhome", "motorhome", 3.2, 2.3, 7.65, 4800, "diesel")
    return RouteRequest(RouteWaypoint(49, 7), RouteWaypoint(41, -8), vehicle, **changes)


def response():
    return {
        "ok": True,
        "api_version": "v3",
        "data": {
            "vehicle": {"type": "motorhome", "beta": True, "height_m": 3.2, "width_m": 2.3, "length_m": 7.65, "weight_t": 4.8, "axles": 2},
            "route": {"distance_m": 300000, "duration_s": 7200, "geometry": {"type": "LineString", "coordinates": [[7, 49], [-8, 41]]}, "geometry_format": "geojson", "legal": True, "restriction_hits": []},
            "parkings": [{"id": "p1", "name": "Route rest area", "type": "rest_area", "lat": 45, "lon": 0, "km_from_start": 120.5, "country": "FR", "amenities": ["toilet"]}, {"name": "bad", "lat": 95, "lon": 0, "km_from_start": 10}],
            "fuel_stations": [{"id": "f1", "name": "Diesel point", "brand": "Example", "lat": 44, "lon": -1, "km_from_start": 220.0, "prices": [{"fuel_type": "diesel", "price": 1.89, "currency": "EUR", "stale": False}]}],
        },
    }


class Beta9PoiTests(unittest.TestCase):
    def test_poi_parameters_are_opt_in_and_cache_isolated(self):
        self.assertNotIn("include", build_v3_motorhome_parameters(request()))
        params = build_v3_motorhome_parameters(request(poi_parking=True, poi_fuel=True))
        self.assertEqual(params["include"], "parking,fuel")
        self.assertEqual(params["fuel"], "diesel")
        self.assertNotEqual(request().cache_key(), request(poi_fuel=True).cache_key())

    def test_documented_pois_are_normalized_and_invalid_records_dropped(self):
        result = NakordoniRouteAdapterV3().normalize_response(response(), request=request(poi_parking=True, poi_fuel=True))
        pois = result.metadata["pois"]
        self.assertEqual(pois["requested"], ["parking", "fuel"])
        self.assertEqual(pois["parking"][0]["name"], "Route rest area")
        self.assertEqual(pois["fuel"][0]["prices"][0]["price"], 1.89)
        self.assertEqual(len(pois["parking"]), 1)

    def test_missing_pois_do_not_break_valid_route(self):
        body = response()
        body["data"].pop("parkings")
        body["data"].pop("fuel_stations")
        result = NakordoniRouteAdapterV3().normalize_response(body, request=request(poi_parking=True))
        self.assertEqual(result.geometry.points[-1].longitude, -8)
        self.assertEqual(result.metadata["pois"], {"requested": ["parking"], "parking": [], "fuel": []})

    def test_long_valid_route_without_pois_does_not_divide_none(self):
        body = response()
        body["data"]["route"]["distance_m"] = 1_500_000
        body["data"].pop("parkings")
        body["data"].pop("fuel_stations")
        result = NakordoniRouteAdapterV3().normalize_response(body, request=request())
        self.assertEqual(result.distance_m, 1_500_000)
        self.assertEqual(result.metadata["pois"], {"requested": [], "parking": [], "fuel": []})

    def test_invalid_optional_route_distance_is_ignored_safely(self):
        normalized = normalize_pois({}, requested=(), route_distance_m=None)
        self.assertEqual(normalized, {"requested": [], "parking": [], "fuel": []})

    def test_normalizer_does_not_invent_prices_or_vehicle_suitability(self):
        normalized = normalize_pois({"fuel_stations": [{"name": "No price", "lat": 44, "lon": -1, "km_from_start": 1}]}, requested=("fuel",))
        self.assertNotIn("prices", normalized["fuel"][0])
        self.assertNotIn("vehicle_suitable", normalized["fuel"][0])
