import test from "node:test";
import assert from "node:assert/strict";
import { requestedPoiCategories, selectPoiItems } from "../src/poi-utils.js";

const pois = {
  requested: ["parking", "fuel"],
  parking: [{ id: "p1", category: "parking", km_from_start: 100 }],
  fuel: [
    { id: "f1", category: "fuel", km_from_start: 480, distance_from_route_km: 2, price: 1.9 },
    { id: "f2", category: "fuel", km_from_start: 510, distance_from_route_km: 1, price: 2.0 },
    { id: "f3", category: "fuel", km_from_start: 990, distance_from_route_km: 1, price: 1.8 },
  ],
};

test("only requested and locally enabled categories are selected", () => {
  assert.deepEqual([...requestedPoiCategories(pois)], ["parking", "fuel"]);
  const selection = selectPoiItems(pois, { display: { parking: false, fuel: true }, routeDistanceM: 1_500_000 });
  assert.deepEqual(selection.items.map((item) => item.id), ["f1", "f2", "f3"]);
});

test("interval selection uses route-distance windows and allows multiple candidates", () => {
  const selection = selectPoiItems(pois, { display: { parking: false, fuel: true }, interval: "500", routeDistanceM: 1_800_000 });
  assert.deepEqual(selection.items.map((item) => item.id), ["f1", "f2", "f3"]);
  assert.deepEqual(selection.gaps, [{ category: "fuel", km: 1500 }]);
});

test("historical POIs without request metadata are hidden", () => {
  const selection = selectPoiItems({ parking: pois.parking, fuel: pois.fuel }, { display: { parking: true, fuel: true }, routeDistanceM: 1_500_000 });
  assert.equal(selection.availableCount, 0);
  assert.deepEqual(selection.items, []);
});

test("long lists are not truncated by the local selection helper", () => {
  const long = { requested: ["fuel"], fuel: Array.from({ length: 80 }, (_, index) => ({ id: `f${index}`, category: "fuel", km_from_start: index * 30 })), parking: [] };
  const selection = selectPoiItems(long, { display: { fuel: true }, routeDistanceM: 2_400_000 });
  assert.equal(selection.items.length, 80);
  assert.equal(selection.items.at(-1).km_from_start, 2370);
});

test("range mode does not claim reachability without plausible fuel data", () => {
  const selection = selectPoiItems(pois, { display: { fuel: true }, interval: "range", routeDistanceM: 1_500_000, fuelPlan: {} });
  assert.deepEqual(selection.items, []);
});
