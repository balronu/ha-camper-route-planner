from datetime import datetime, timezone
import math
import unittest

from custom_components.camper_route_planner.models import RouteRequest, RouteWaypoint, ValidationError, VehicleProfile
from custom_components.camper_route_planner.providers.nakordoni_motorhome import build_motorhome_parameters


def profile(**changes):
    values = dict(profile_id="test", name="Test", vehicle_kind="motorhome", height_m=3.2, width_m=2.3, length_m=7.65, gross_weight_kg=4800, fuel_type="diesel")
    values.update(changes)
    return VehicleProfile(**values)


class Beta12OptionsTests(unittest.TestCase):
  def test_route_options_are_sent_and_cache_isolated(self):
    request = RouteRequest(RouteWaypoint(49, 7), RouteWaypoint(41, -8), profile(), traffic="forecast", avoid=("tolls", "tunnels"), route_type="eco", depart_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    params = build_motorhome_parameters(request)
    self.assertEqual(params["avoid"], "tolls,tunnels")
    self.assertEqual(params["route_type"], "eco")
    self.assertEqual(params["traffic"], "forecast")
    self.assertIn("depart_at", params)
    other = RouteRequest(request.origin, request.destination, request.vehicle, traffic="off")
    self.assertNotEqual(request.cache_key(), other.cache_key())

  def test_alternatives_with_waypoints_are_rejected(self):
    with self.assertRaises(ValidationError):
        RouteRequest(RouteWaypoint(1, 2), RouteWaypoint(3, 4), profile(), (RouteWaypoint(2, 3),), alternatives=1)

  def test_legacy_profiles_and_optional_fuel_fields_are_compatible(self):
    old = profile().as_dict()
    restored = VehicleProfile.from_dict(old)
    self.assertIsNone(restored.tank_capacity_l)
    fuel = profile(tank_capacity_l=300, fuel_level_pct=80, reserve_l=20)
    self.assertEqual(fuel.as_dict()["fuel_level_pct"], 80)

  def test_invalid_finite_tank_values_are_rejected(self):
    for field in ("tank_capacity_l", "fuel_level_l", "fuel_level_pct", "reserve_l", "diesel_price_per_l"):
      with self.assertRaises(ValueError):
        profile(**{field: math.nan})
      with self.assertRaises(ValueError):
        profile(**{field: math.inf})

  def test_explicit_zero_values_round_trip_without_synthetic_defaults(self):
    fuel = profile(tank_capacity_l=100, fuel_level_l=0, reserve_l=0, diesel_price_per_l=0)
    restored = VehicleProfile.from_dict(fuel.as_dict())
    self.assertEqual(restored.fuel_level_l, 0)
    self.assertEqual(restored.reserve_l, 0)
    self.assertEqual(restored.diesel_price_per_l, 0)
    self.assertIsNone(profile().reserve_l)
