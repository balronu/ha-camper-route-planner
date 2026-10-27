from datetime import datetime, timezone

import pytest

from custom_components.camper_route_planner.models import RouteRequest, RouteWaypoint, ValidationError, VehicleProfile
from custom_components.camper_route_planner.providers.nakordoni_motorhome import build_motorhome_parameters


def profile(**changes):
    values = dict(profile_id="test", name="Test", vehicle_kind="motorhome", height_m=3.2, width_m=2.3, length_m=7.65, gross_weight_kg=4800, fuel_type="diesel")
    values.update(changes)
    return VehicleProfile(**values)


def test_route_options_are_sent_and_cache_isolated():
    request = RouteRequest(RouteWaypoint(49, 7), RouteWaypoint(41, -8), profile(), traffic="forecast", avoid=("tolls", "tunnels"), route_type="eco", depart_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    params = build_motorhome_parameters(request)
    assert params["avoid"] == "tolls,tunnels"
    assert params["route_type"] == "eco"
    assert params["traffic"] == "forecast"
    assert "depart_at" in params
    other = RouteRequest(request.origin, request.destination, request.vehicle, traffic="off")
    assert request.cache_key() != other.cache_key()


def test_alternatives_with_waypoints_are_rejected():
    with pytest.raises(ValidationError):
        RouteRequest(RouteWaypoint(1, 2), RouteWaypoint(3, 4), profile(), (RouteWaypoint(2, 3),), alternatives=1)


def test_legacy_profiles_and_optional_fuel_fields_are_compatible():
    old = profile().as_dict()
    restored = VehicleProfile.from_dict(old)
    assert restored.tank_capacity_l is None
    fuel = profile(tank_capacity_l=300, fuel_level_pct=80, reserve_l=20)
    assert fuel.as_dict()["fuel_level_pct"] == 80

