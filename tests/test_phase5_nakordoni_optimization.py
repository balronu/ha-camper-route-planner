import asyncio
import unittest
from dataclasses import dataclass

from custom_components.camper_route_planner.const import CONF_PROVIDER, PROVIDER_NAKORDONI_MOTORHOME_V3
from custom_components.camper_route_planner.coordinator import RouteCoordinator
from custom_components.camper_route_planner.models import RouteRequest, RouteWaypoint, VehicleProfile
from custom_components.camper_route_planner.providers.nakordoni_motorhome import ROUTE_ENDPOINT
from custom_components.camper_route_planner.providers.nakordoni_v3 import NakordoniRouteAdapterV3, V3_ROUTE_ENDPOINT
from custom_components.camper_route_planner.runtime import RuntimeData
from custom_components.camper_route_planner.storage import MemoryStore, ProfileRouteStore


def payload(*, version, total, complete, distance=100000, duration=3600):
    return {
        "ok": True,
        "api_version": version,
        "headers": {"X-Route-Source": "primary"},
        "transport": {"attempts": 1, "elapsed_s": 0.2, "route_source": "primary"},
        "data": {
            "vehicle": {"type": "motorhome", "beta": True, "height_m": 3.2, "width_m": 2.34, "length_m": 7.65, "weight_t": 4.8, "axles": 2},
            "route": {
                "distance_m": distance, "duration_s": duration, "geometry": [[48.1, 11.5], [49.0, 12.0]],
                "legal": True, "restriction_hits": [], "tolls": {"currency": "EUR", "total_eur": total, "complete": complete, "by_country": [{"country": "FR", "amount": total, "status": "likely"}]},
            },
        },
    }


@dataclass
class FixtureTransport:
    endpoint: str

    async def __call__(self, _parameters):
        return payload(version="v2" if "/v2/" in self.endpoint else "v3", total=250.24 if "/v2/" in self.endpoint else None, complete=True if "/v2/" in self.endpoint else False)


class Phase5NakordoniOptimizationTests(unittest.TestCase):
    def test_v3_preserves_route_source_and_incomplete_tolls(self):
        request = RouteRequest(
            RouteWaypoint(48.1, 11.5), RouteWaypoint(49.0, 12.0), VehicleProfile("z", "Zoe", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=2)
        )
        normalized = NakordoniRouteAdapterV3(api_key="K" * 24).normalize_response(payload(version="v3", total=None, complete=False), request=request, synthetic=False)
        self.assertEqual(normalized.metadata["routing_source"], "primary")
        self.assertFalse(normalized.metadata["tolls"]["complete"])
        self.assertEqual(normalized.metadata["tolls"]["source_api"], "v3")

    def test_explicit_v2_estimate_is_separate_and_uses_v2_endpoint(self):
        async def run():
            backend = MemoryStore()
            store = ProfileRouteStore(backend)
            await store.async_load()
            profile = VehicleProfile("z", "Zoe", "motorhome", 3.2, 2.34, 7.65, 4800, "diesel", axles=2)
            await store.async_save_profile(profile)
            provider = NakordoniRouteAdapterV3(api_key="K" * 24, transport=FixtureTransport(V3_ROUTE_ENDPOINT))
            runtime = RuntimeData(RouteCoordinator(provider), store, {CONF_PROVIDER: PROVIDER_NAKORDONI_MOTORHOME_V3})
            result = await provider.calculate(RouteRequest(RouteWaypoint(48.1, 11.5), RouteWaypoint(49.0, 12.0), profile))
            runtime.coordinator.provider.transport = FixtureTransport(V3_ROUTE_ENDPOINT)
            estimate = await runtime.async_estimate_tolls_v2({
                "profile_id": "z", "origin": {"latitude": 48.1, "longitude": 11.5}, "destination": {"latitude": 49.0, "longitude": 12.0},
                "current_result": {"provider": result.provider, "distance_m": result.distance_m, "duration_s": result.duration_s, "metadata": result.metadata},
            })
            return estimate
        estimate = asyncio.run(run())
        self.assertEqual(estimate["api_version"], "v2")
        self.assertEqual(estimate["tolls"]["total"], 250.24)
        self.assertEqual(estimate["tolls"]["source_api"], "v2")
        self.assertEqual(estimate["source_api"], "v2")
        self.assertEqual(ROUTE_ENDPOINT, "https://nakordoni.eu/api/v2/data/truck-route")
        self.assertNotIn("total", estimate)


if __name__ == "__main__":
    unittest.main()
