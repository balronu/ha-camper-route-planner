"""Phase 3H offline regressions for destructive profile handling."""

from __future__ import annotations

import asyncio
import unittest

from custom_components.camper_route_planner.models import VehicleProfile
from custom_components.camper_route_planner.storage import MemoryStore, ProfileRouteStore


class Phase3HStorageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.backend = MemoryStore()
        self.store = ProfileRouteStore(self.backend)
        asyncio.run(self.store.async_load())

    def profile(self, profile_id: str, name: str) -> VehicleProfile:
        return VehicleProfile(profile_id, name, "motorhome", 3.2, 2.34, 7.65, 4800, "diesel")

    def route(self, route_id: str, profile_id: str) -> dict:
        return {
            "route_id": route_id,
            "name": route_id,
            "provider": "mock",
            "distance_m": 100,
            "duration_s": 100,
            "geometry": {"points": [{"latitude": 49, "longitude": 7}, {"latitude": 50, "longitude": 8}]},
            "profile_id": profile_id,
        }

    def test_duplicate_names_are_independent_and_delete_uses_profile_id(self) -> None:
        asyncio.run(self.store.async_save_profile(self.profile("first", "Zoe")))
        asyncio.run(self.store.async_save_profile(self.profile("second", "Zoe")))
        self.assertEqual({profile.profile_id for profile in self.store.profiles()}, {"first", "second"})
        deleted = asyncio.run(self.store.async_delete_profile("first"))
        self.assertEqual(deleted, ())
        self.assertEqual({profile.profile_id for profile in self.store.profiles()}, {"second"})

    def test_referenced_routes_require_explicit_route_deletion(self) -> None:
        asyncio.run(self.store.async_save_profile(self.profile("carthago", "Carthago")))
        asyncio.run(self.store.async_save_route_record(self.route("saved", "carthago")))
        with self.assertRaisesRegex(ValueError, "profile_has_routes"):
            asyncio.run(self.store.async_delete_profile("carthago"))
        self.assertIsNotNone(self.store.route("saved"))
        deleted = asyncio.run(self.store.async_delete_profile("carthago", delete_routes=True))
        self.assertEqual(deleted, ("saved",))
        self.assertEqual(self.store.profiles(), ())
        self.assertIsNone(self.store.route("saved"))


if __name__ == "__main__":
    unittest.main()
