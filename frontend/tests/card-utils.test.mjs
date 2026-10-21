import test from "node:test";
import assert from "node:assert/strict";
import { addWaypoint, formatDistance, formatDuration, hasTrackGeometry, isValidWaypoint, moveWaypoint, normalizeServiceResponse, removeWaypoint, selectConfigEntry } from "../src/card-utils.js";
import { languageOf, t } from "../src/localization.js";

test("coordinates and waypoint ordering are validated deterministically", () => {
  assert.equal(isValidWaypoint({ latitude: 49, longitude: 7 }), true);
  assert.equal(isValidWaypoint({ latitude: 91, longitude: 7 }), false);
  assert.equal(isValidWaypoint({ latitude: "", longitude: "" }), false);
  const points = addWaypoint([]);
  assert.equal(points.length, 1);
  assert.deepEqual(moveWaypoint([{ id: 1 }, { id: 2 }], 1, -1), [{ id: 2 }, { id: 1 }]);
  assert.deepEqual(removeWaypoint([{ id: 1 }, { id: 2 }], 0), [{ id: 2 }]);
});

test("formatters and service response normalization handle mock data", () => {
  assert.match(formatDistance(12000, "de"), /12/);
  assert.equal(formatDuration(3660, "en"), "1 h 1 min");
  const result = normalizeServiceResponse({ response: { provider: "mock", distance_m: 12000, duration_s: 3660, warnings: ["synthetic"], synthetic: true } });
  assert.equal(result.synthetic, true);
  assert.deepEqual(result.warnings, ["synthetic"]);
});

test("German and English labels are available", () => {
  assert.equal(languageOf({ locale: { language: "de-DE" } }), "de");
  assert.equal(languageOf({ locale: { language: "en-US" } }), "en");
  assert.equal(t("de", "calculate"), "Route berechnen");
  assert.equal(t("en", "calculate"), "Calculate route");
});

test("track export eligibility requires existing geometry", () => {
  assert.equal(hasTrackGeometry({ geometry: { points: [{ latitude: 1, longitude: 2 }, { latitude: 2, longitude: 3 }] } }), true);
  assert.equal(hasTrackGeometry({ geometry: { points: [{ latitude: 1, longitude: 2 }] } }), false);
  assert.equal(hasTrackGeometry({}), false);
});

test("config entry selection handles explicit, single, multiple and missing instances", () => {
  const entries = [{ entry_id: "one", title: "One" }, { entry_id: "two", title: "Two" }];
  assert.equal(selectConfigEntry({}, [entries[0]]).entryId, "one");
  assert.equal(selectConfigEntry({}, entries).status, "multiple");
  assert.equal(selectConfigEntry({}, []).status, "missing");
  assert.deepEqual(selectConfigEntry({ entry_id: "legacy" }, entries), { entryId: "legacy", status: "ready", entries: [{ entry_id: "one", title: "One", state: "" }, { entry_id: "two", title: "Two", state: "" }] });
});
