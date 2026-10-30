import test from "node:test";
import assert from "node:assert/strict";
import { addWaypoint, buildNavigationLink, calculateFuelPlan, formatDistance, formatDuration, hasTrackGeometry, isValidWaypoint, isoDateTimeToLocalInput, localDateTimeToIso, moveWaypoint, navigationPlatform, normalizeConfig, normalizeDecimalInput, normalizeFuelPlan, normalizeProviderId, normalizeRouteOptions, normalizeServiceResponse, pickFuelValues, providerApiVersion, providerErrorMessage, removeWaypoint, resolveProviderStatus, routeRecordFromResult, selectConfigEntry, validOrEmptyWaypoint } from "../src/card-utils.js";
import { languageOf, t } from "../src/localization.js";
import { providerNoteText } from "../src/provider-notes.js";
import { classifyProviderText, formatTollAmount, tollCalculationText, tollCountryName } from "../src/toll-display.js";

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

test("invalid saved coordinates are cleared instead of becoming route inputs", () => {
  assert.deepEqual(validOrEmptyWaypoint({ latitude: 0, longitude: 0, label: "Gondifelos" }), { latitude: "", longitude: "", label: "Gondifelos" });
  assert.deepEqual(validOrEmptyWaypoint({ latitude: 41.4, longitude: -8.6 }), { latitude: 41.4, longitude: -8.6 });
});

test("developer diagnostics are disabled by default and opt in per card", () => {
  assert.equal(normalizeConfig({}).show_developer_diagnostics, false);
  assert.equal(normalizeConfig({ show_developer_diagnostics: true }).show_developer_diagnostics, true);
  assert.equal(normalizeConfig({ show_developer_diagnostics: "true" }).show_developer_diagnostics, false);
});

test("optional route times omit null values but preserve valid values", () => {
  assert.deepEqual(normalizeRouteOptions({ depart_at: null, arrive_at: null }), { traffic: "off", avoid: [], route_type: "fastest", alternatives: 0, depart_at: "", arrive_at: "", poi_parking: false, poi_fuel: false, poi_fuel_type: "diesel", fuel_plan_enabled: false, fuel_plan_tank_l: "", fuel_plan_consumption_l100: "", fuel_plan_start_fuel_pct: 100, fuel_plan_reserve_pct: 15 });
  assert.equal(normalizeRouteOptions({ depart_at: "2026-10-29T08:00:00+02:00" }).depart_at, "2026-10-29T08:00:00+02:00");
  assert.equal(normalizeServiceResponse({ route_options: { depart_at: null } }).route_options.depart_at, "");
});

test("formatters and service response normalization handle mock data", () => {
  assert.match(formatDistance(12000, "de"), /12/);
  assert.equal(formatDuration(3660, "en"), "1 h 1 min");
  const result = normalizeServiceResponse({ response: { provider: "mock", distance_m: 12000, duration_s: 3660, warnings: ["synthetic"], synthetic: true } });
  assert.equal(result.synthetic, true);
  assert.deepEqual(result.warnings, ["synthetic"]);
});

test("fuel-plan normalization keeps optional estimates safe and bounded", () => {
  const result = normalizeFuelPlan({
    total_litres: 42,
    total_est_cost: 73.5,
    total_currency: "EUR",
    stops: [{ km_from_start: 250, litres: 42, station: { name: "Safe Fuel", latitude: 48.1, longitude: 11.5 }, est_cost_eur: 73.5 }, { km_from_start: null, litres: 1 }],
    warnings: ["Estimated only", { code: "reserve", message: "Check reserve" }]
  });
  assert.equal(result.stops.length, 1);
  assert.equal(result.total_currency, "EUR");
  assert.equal(result.warnings.length, 2);
  assert.equal(normalizeFuelPlan({ stops: [{ km_from_start: null, litres: 1 }] }).stops.length, 0);
});

test("datetime-local values become explicit offsets without changing the selected wall clock", () => {
  const normalized = localDateTimeToIso("2026-11-08T12:04");
  assert.match(normalized, /^2026-11-08T12:04:00[+-]\d{2}:\d{2}$/);
  assert.equal(localDateTimeToIso("2026-07-08T12:04:00+02:00"), "2026-07-08T12:04:00+02:00");
  assert.equal(localDateTimeToIso(""), "");
  assert.equal(localDateTimeToIso("2026-11-08 12:04"), null);
});

test("stored explicit-offset times render back in the browser input format", () => {
  assert.match(isoDateTimeToLocalInput("2026-11-08T12:04:00+01:00"), /^2026-11-08T\d{2}:\d{2}$/);
  assert.equal(isoDateTimeToLocalInput("2026-11-08T12:04"), "2026-11-08T12:04");
  assert.equal(isoDateTimeToLocalInput(""), "");
});

test("fuel planning keeps total demand separate from optional tank calculations", () => {
  const plan = calculateFuelPlan(2474700, { consumption_l_per_100km: 10.5, tank_capacity_l: 300, fuel_level_pct: 100, reserve_l: 20, diesel_price_per_l: 1.8 });
  assert.equal(Math.round(plan.totalLiters * 10) / 10, 259.8);
  assert.equal(plan.deficit, 0);
  assert.equal(Math.round(plan.cost * 100) / 100, 467.72);
  assert.equal(calculateFuelPlan(1000, {}).totalLiters, null);
});

test("missing tank fields never become zero and suppress range warnings", () => {
  const plan = calculateFuelPlan(2474700, { consumption_l_per_100km: 10.5 });
  assert.equal(Math.round(plan.totalLiters * 10) / 10, 259.8);
  assert.equal(plan.rangeKm, null);
  assert.equal(plan.deficit, null);
  assert.equal(plan.cost, null);
  assert.equal(plan.sufficient, null);
});

test("tank planning distinguishes missing values from explicit zero", () => {
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_l: 0, reserve_l: 0 }).rangeKm, 0);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_l: 0, reserve_l: 0 }).deficit, 10);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_l: 50 }).rangeKm, 500);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_pct: 50, reserve_l: 0 }).rangeKm, 500);
});

test("fuel planning rejects invalid tank relationships and preserves liter priority", () => {
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_l: 110, reserve_l: 0 }).rangeKm, null);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_l: 50, fuel_level_pct: 10, reserve_l: 0 }).rangeKm, 500);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_l: 50, reserve_l: 110 }).rangeKm, 500);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 0, tank_capacity_l: 100, fuel_level_l: 50, reserve_l: 0 }).totalLiters, null);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_l: 50, reserve_l: 0, diesel_price_per_l: 0 }).cost, 0);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_l: 50, reserve_l: 0, diesel_price_per_l: -1 }).cost, null);
});

test("decimal input accepts comma and dot without coercing intermediate text", () => {
  assert.equal(normalizeDecimalInput("2,16", { maximum: 10 }).value, 2.16);
  assert.equal(normalizeDecimalInput("2.16", { maximum: 10 }).value, 2.16);
  assert.equal(normalizeDecimalInput("1,659", { maximum: 10 }).value, 1.659);
  assert.equal(normalizeDecimalInput("0,99", { maximum: 10 }).value, 0.99);
  assert.equal(normalizeDecimalInput("2,", { maximum: 10 }).intermediate, true);
  assert.equal(normalizeDecimalInput(" 2.16 ", { maximum: 10 }).valid, true);
  assert.equal(normalizeDecimalInput("216", { maximum: 10 }).valid, false);
  assert.equal(normalizeDecimalInput("diesel", { maximum: 10 }).valid, false);
  assert.equal(normalizeDecimalInput("", { maximum: 10 }).present, false);
});

test("range and cost calculations are independent and price validation is bounded", () => {
  const range = calculateFuelPlan(2474700, { consumption_l_per_100km: "10,5", tank_capacity_l: "90", fuel_level_l: "90", reserve_l: "10" });
  assert.equal(Math.round(range.rangeKm), 857);
  assert.equal(range.cost, null);
  const cost = calculateFuelPlan(2474700, { consumption_l_per_100km: 10.5, diesel_price_per_l: "2,16" });
  // Cost uses the internally precise route demand (259.8435 l), while the
  // UI displays the demand rounded to one decimal place.
  assert.equal(Math.round(cost.cost * 100) / 100, 561.26);
  assert.equal(calculateFuelPlan(2474700, { consumption_l_per_100km: 10.5, diesel_price_per_l: "216" }).cost, null);
  assert.equal(calculateFuelPlan(2474700, { consumption_l_per_100km: 10.5, fuel_level_l: 0, reserve_l: 0, tank_capacity_l: 90 }).rangeKm, 0);
});

test("explicit fuel level mode controls percent conversion and legacy percent data remains compatible", () => {
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 90, fuel_level_mode: "percent", fuel_level_pct: "100", reserve_l: 10 }).rangeKm, 900);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 90, fuel_level_pct: 50, reserve_l: 0 }).rangeKm, 450);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 90, fuel_level_mode: "percent", fuel_level_l: 90, fuel_level_pct: "50", reserve_l: 0 }).rangeKm, 450);
});

test("range needs no reserve and ignores legacy reserve values", () => {
  const withoutReserve = calculateFuelPlan(2474700, { consumption_l_per_100km: 10.5, tank_capacity_l: 90, fuel_level_l: 90 });
  const withLegacyReserve = calculateFuelPlan(2474700, { consumption_l_per_100km: 10.5, tank_capacity_l: 90, fuel_level_l: 90, reserve_l: 100 });
  assert.equal(Math.round(withoutReserve.rangeKm), 857);
  assert.equal(withoutReserve.deficit, 169.8435);
  assert.equal(withLegacyReserve.rangeKm, withoutReserve.rangeKm);
  assert.equal(withLegacyReserve.deficit, withoutReserve.deficit);
});

test("fuel planning exposes additional demand without changing the formulas", () => {
  const portugal = calculateFuelPlan(2474700, { consumption_l_per_100km: 10.5, tank_capacity_l: 90, fuel_level_l: 90, diesel_price_per_l: "2,16" });
  assert.equal(Math.round(portugal.totalLiters * 10) / 10, 259.8);
  assert.equal(Math.round(portugal.rangeKm * 10) / 10, 857.1);
  assert.equal(Math.round(portugal.deficit * 10) / 10, 169.8);
  assert.equal(portugal.invalidTankData, false);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100, fuel_level_l: 10 }).deficit, 0);
  assert.equal(calculateFuelPlan(100000, { consumption_l_per_100km: 10, tank_capacity_l: 100 }).deficit, null);
});

test("fuel planning keeps profile values when local editor fields are still empty", () => {
  const profile = { tank_capacity_l: 90, fuel_level_l: 90, consumption_l_per_100km: 10.5, diesel_price_per_l: 2.16 };
  const localEditor = { fuel_level_l: "", fuel_level_pct: "", diesel_price_per_l: "", fuel_level_mode: "liters" };
  const entered = Object.fromEntries(Object.entries(localEditor).filter(([, value]) => value !== "" && value != null));
  const plan = calculateFuelPlan(2474700, { ...profile, ...entered });
  assert.equal(Math.round(plan.cost * 100) / 100, 561.26);
});

test("saved routes retain manual fuel values without changing profile data", () => {
  const record = routeRecordFromResult({ provider: "mock", distance_m: 2474700, duration_s: 1, geometry: { points: [{ latitude: 49, longitude: 7 }, { latitude: 50, longitude: 8 }] }, warnings: [], metadata: {}, created_at: "2026-10-29T00:00:00Z" }, {
    routeName: "Portugal", profileId: "zoe", origin: { latitude: 49, longitude: 7 }, destination: { latitude: 50, longitude: 8 }, waypoints: [], fuelValues: { fuel_level_l: "90", fuel_level_pct: "", reserve_l: "", diesel_price_per_l: "2,16", fuel_level_mode: "liters", ignored: "must not persist" }
  });
  assert.deepEqual(record.fuel_values, { fuel_level_l: "90", fuel_level_pct: "", reserve_l: "", diesel_price_per_l: "2,16", fuel_level_mode: "liters" });
  assert.deepEqual(pickFuelValues({ diesel_price_per_l: "2.16", secret: "ignored" }), { diesel_price_per_l: "2.16" });
});

test("provider status separates configured provider from executed v2/v3 API", () => {
  assert.equal(normalizeProviderId("nakordoni_motorhome_v3"), "nakordoni");
  assert.equal(providerApiVersion("nakordoni_motorhome_v3"), "v3");
  assert.deepEqual(resolveProviderStatus("nakordoni_motorhome_v3", "nakordoni_motorhome", "v3"), { configuredProvider: "nakordoni", provider: "nakordoni", apiVersion: "v3" });
  assert.deepEqual(resolveProviderStatus("nakordoni_motorhome", "nakordoni_motorhome", "v2"), { configuredProvider: "nakordoni", provider: "nakordoni", apiVersion: "v2" });
  assert.deepEqual(resolveProviderStatus("mock", "nakordoni_v3", null), { configuredProvider: "mock", provider: "nakordoni", apiVersion: "v3" });
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
  assert.match(providerNoteText("Emission class not given: Euro 6 assumed (incl. VAT)", "de"), /Emissionsklasse nicht angegeben/);
  assert.match(providerNoteText("Provider-specific tariff wording", "de"), /Anbieterhinweis \(Original\)/);
  assert.match(providerNoteText("Emission class not given: Euro 6 assumed (incl. VAT)", "en"), /not given/);
});

test("POI interval labels never expose internal keys", () => {
  for (const key of ["poiInterval.all", "poiInterval.250", "poiInterval.500", "poiInterval.750", "poiInterval.range", "poiInterval.custom", "poiParkingInterval.all", "poiParkingInterval.100", "poiParkingInterval.custom"]) {
    assert.notEqual(t("de", key), key);
    assert.notEqual(t("en", key), key);
  }
  assert.equal(t("de", "poiParkingInterval.100"), "Alle 100 km");
  assert.equal(t("en", "poiInterval.custom"), "Custom spacing");
});

test("toll display separates known provider hints from original text", () => {
  const known = classifyProviderText("This amount includes VAT", "de");
  assert.equal(known.known.length, 1);
  assert.match(known.known[0].text, /Mehrwertsteuer/);
  assert.equal(known.unknown.length, 0);
  const unknown = classifyProviderText("Provider-specific tariff wording", "de");
  assert.deepEqual(unknown.known, []);
  assert.deepEqual(unknown.unknown, ["Provider-specific tariff wording"]);
});

test("toll amounts and calculation bases are locale-aware and data-driven", () => {
  assert.equal(formatTollAmount(73.07, "EUR", "de"), "73,07 €");
  assert.equal(formatTollAmount(27.04, "CHF", "en"), "CHF 27.04");
  assert.equal(tollCountryName("DE", "de"), "Deutschland");
  assert.equal(tollCountryName("CH", "en"), "Switzerland");
  assert.equal(tollCountryName("ES", "de"), "Spanien");
  assert.equal(tollCountryName("PT", "en"), "Portugal");
  assert.equal(tollCountryName("XX", "de"), "XX");
  assert.match(tollCalculationText({ distance_km: 166.7, rate_eur_per_km: 0.2761 }, "de"), /166,7 km/);
  assert.match(tollCalculationText({ tariff: "763.9 km x 0.2761 EUR/km network average" }, "en"), /763\.9 km/);
  assert.equal(tollCalculationText({ distance_km: 166.7 }, "de"), "");
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

test("provider errors are localized without exposing provider response text", () => {
  assert.match(providerErrorMessage({ code: "route_restrictions_unresolved", message: "raw location detail" }, "de"), /vollständig zulässige Route/);
  assert.match(providerErrorMessage({ code: "quota_exceeded" }, "en"), /request limit/);
  assert.match(providerErrorMessage({ status: 503, message: "raw upstream body" }, "de"), /vorübergehend nicht verfügbar/);
  assert.match(providerErrorMessage({ code: "route_timeout", message: "Fehlerreferenz: req-42." }, "en"), /Error reference: req-42/);
  assert.doesNotMatch(providerErrorMessage({ code: "route_timeout", message: "Fehlerreferenz: secret value." }, "de"), /secret value/);
});
