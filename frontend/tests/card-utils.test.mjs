import test from "node:test";
import assert from "node:assert/strict";
import { addWaypoint, buildNavigationLink, formatDistance, formatDuration, hasTrackGeometry, isValidWaypoint, moveWaypoint, navigationPlatform, normalizeServiceResponse, removeWaypoint, selectConfigEntry } from "../src/card-utils.js";
import { languageOf, t } from "../src/localization.js";

test("coordinates and waypoint ordering are validated deterministically", () => {
  assert.equal(isValidWaypoint({ latitude: 49, longitude: 7 }), true);
  assert.equal(isValidWaypoint({ latitude: 91, longitude: 7 }), false);
  assert.equal(isValidWaypoint({ latitude: 0, longitude: 0 }), false);
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
  assert.equal(t("de", "vehicleKind.motorhome"), "Wohnmobil");
  assert.equal(t("de", "fuelType.electric"), "Elektro");
  assert.equal(t("en", "vehicleKind.truck"), "Truck");
  assert.equal(t("en", "fuelType.petrol"), "Petrol");
  assert.equal(t("de", "motorhomeBeta"), "Nakordoni – Beta");
  assert.equal(t("en", "motorhomeBeta"), "Nakordoni – Beta");
  assert.equal(t("de", "tollSystemName.exempt"), "Befreit");
  assert.equal(t("de", "tollSystemName.section"), "Streckenmaut");
  assert.equal(t("de", "tollSystemName.flat_daily"), "Tagespauschale");
  assert.equal(t("de", "tollStatus.likely"), "Wahrscheinlich");
  assert.equal(t("en", "tollStatus.confirmed"), "Confirmed");
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

test("navigation links use existing route points without an API request", () => {
  const route = {
    origin: { latitude: 49.1234567, longitude: 7.7654321 },
    destination: { latitude: 48.1351, longitude: 11.582 },
    waypoints: [{ latitude: 49.5, longitude: 8.6, label: "München & Süd" }]
  };
  const ios = buildNavigationLink(route, {}, "ios");
  assert.match(ios.url, /^https:\/\/maps\.apple\.com\/directions\?/);
  assert.match(ios.url, /destination=48\.135100%2C11\.582000/);
  assert.match(ios.url, /mode=driving/);
  assert.equal(ios.omittedWaypoints, true);
  const android = buildNavigationLink(route, {}, "android");
  assert.match(android.url, /^https:\/\/www\.google\.com\/maps\/dir\/\?/);
  assert.match(android.url, /destination=48\.135100%2C11\.582000/);
  assert.match(android.url, /dir_action=navigate/);
  assert.equal(android.omittedWaypoints, true);
  const desktop = buildNavigationLink(route, {}, "desktop");
  assert.match(desktop.url, /^https:\/\/www\.openstreetmap\.org\/directions\?route=/);
  assert.equal(desktop.supportsWaypoints, true);
  assert.match(decodeURIComponent(desktop.url), /49\.500000,8\.600000/);
});

test("navigation requires a valid destination and detects mobile platforms", () => {
  assert.equal(buildNavigationLink({ destination: { latitude: "", longitude: 2 } }, {}, "desktop"), null);
  assert.equal(navigationPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
  assert.equal(navigationPlatform("Mozilla/5.0 (Linux; Android 15; Pixel)"), "android");
  assert.equal(navigationPlatform("Mozilla/5.0 (X11; Linux x86_64)"), "desktop");
});
