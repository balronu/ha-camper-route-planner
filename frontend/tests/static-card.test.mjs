import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/camper-route-planner-card.js", import.meta.url), "utf8");
const services = await readFile(new URL("../src/services.js", import.meta.url), "utf8");

test("card exposes HA registration and editor API", () => {
  assert.match(source, /customElements\.define\("camper-route-planner-card"/);
  assert.match(source, /static getConfigElement\(\)/);
  assert.match(source, /static getStubConfig\(\)/);
  assert.match(source, /config-changed/);
  assert.match(source, /getStubConfig\(\) \{ return \{ entry_id: "" \}; \}/);
  assert.match(source, /customCards\.some\(\(card\) => card\.type === "camper-route-planner-card"\)/);
  assert.doesNotMatch(source, /customCards\.some\(\(card\) => card\.type === "custom:camper-route-planner-card"\)/);
});

test("frontend has no provider secret or direct Nakordoni endpoint", () => {
  assert.match(source, /nakordoni\.eu/);
  assert.doesNotMatch(source, /api\.nakordoni\.dev|Bearer|api[_-]?key|secret/i);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket\(/);
});

test("frontend labels the provider returned by the backend", () => {
  assert.match(source, /translate\("provider"\).*result\.provider/);
  assert.match(source, /result\.synthetic.*mockDataNotice/);
});

test("installable integration contains the same built bundle", () => {
  const packaged = readFileSync(new URL("../../custom_components/camper_route_planner/frontend/camper-route-planner-card.js", import.meta.url), "utf8");
  const built = readFileSync(new URL("../dist/camper-route-planner-card.js", import.meta.url), "utf8");
  assert.equal(packaged, built);
});

test("route calculation appears only behind an explicit action handler", () => {
  assert.match(source, /async calculate\(forceRefresh = false\)/);
  assert.match(source, /data-action="calculate"/);
  assert.doesNotMatch(source, /connectedCallback\(\)[\s\S]{0,500}calculate\(/);
});

test("search drafts and request generations protect active user input", () => {
  assert.match(source, /_inputDrafts/);
  assert.match(source, /_searchRequestIds/);
  assert.match(source, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /selectionStart/);
  assert.match(source, /updateSearchResults\(\)/);
  assert.match(source, /data-search-results/);
  assert.match(source, /updateMapPoints/);
  assert.match(source, /updateSelectedPointDom/);
});

test("GPX export is explicit, backend-mediated and supports mobile share fallback", () => {
  assert.match(services, /camper_route_planner\/export_gpx/);
  assert.match(source, /data-mode="route"/);
  assert.match(source, /deliverGpxExport/);
  assert.match(services, /navigator\.share/);
  assert.doesNotMatch(source, /exportRoute\(.*connectedCallback/);
});

test("navigation handoff is local, platform-aware and keeps GPX export", () => {
  assert.match(source, /data-action="navigation"/);
  assert.match(source, /buildNavigationLink/);
  assert.match(source, /navigation-link/);
  assert.match(source, /target = "_blank"/);
  assert.match(source, /noopener noreferrer/);
  assert.match(source, /navigationSafety/);
  assert.match(source, /navigationWaypointsUnsupported/);
  assert.match(services, /export_gpx/);
  assert.doesNotMatch(source, /calculateRoute\([^)]*navigation/);
});

test("PDF export is a local action available only with the calculated route", () => {
  assert.match(source, /data-action="pdf"/);
  assert.match(source, /createTravelPlanPdf/);
  assert.match(source, /downloadPdf/);
  assert.match(source, /pdfFileName\(savedRoute\?\.name/);
  assert.match(source, /routeName: savedRoute\?\.name/);
  assert.doesNotMatch(source, /navigator\.share/);
  assert.doesNotMatch(source, /fetch\([^)]*pdf/i);
});

test("card uses a native collapsible shell and preserves card state", () => {
  assert.match(source, /<details|createElement\("details"\)/);
  assert.match(source, /createElement\("summary"\)/);
  assert.match(source, /_cardExpanded/);
  assert.match(source, /handleCardToggle/);
  assert.match(source, /invalidateMapSize/);
  assert.match(source, /aria-expanded/);
  assert.doesNotMatch(source, /Beta \/ Mock-Routing/);
});

test("card renders route-provided border crossings and toll details without browser API calls", () => {
  assert.match(source, /border_crossings/);
  assert.match(source, /renderBorderCrossings/);
  assert.match(source, /renderTollDetails/);
  assert.match(source, /borderNoWait/);
  assert.match(source, /borderCrossings/);
  assert.match(source, /borderCrossings: result\?\.metadata/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest\(/);
});

test("fuel inputs are local, vehicle-scoped, and do not trigger routing", () => {
  assert.match(source, /camper-route-planner:fuel:/);
  assert.match(source, /profile\.profile_id/);
  assert.match(source, /data-fuel-field/);
  assert.match(source, /writeFuelValues/);
  assert.match(source, /updateFuelField/);
  assert.match(source, /fuelNotCalculable/);
  assert.doesNotMatch(source, /updateFuelField[\s\S]{0,500}calculateRoute/);
});

test("fuel values remain editable when no route has been calculated", () => {
  assert.match(source, /fuelHost = result \? .* : this\.shadowRoot\.querySelector\("\.map-section"\)/);
  assert.match(source, /renderFuelPlan\(result, profile, this\._state\.fuelValues/);
  assert.match(source, /tankCapacity/);
  assert.match(source, /fuelLevelPercent/);
});

test("toll details use a structured summary and collapsed technical provider section", () => {
  assert.match(source, /tollSummary/);
  assert.match(source, /toll-country-heading/);
  assert.match(source, /provider-details/);
  assert.match(source, /<details class="provider-details"><summary>/);
  assert.match(source, /classifyProviderText/);
  assert.match(source, /formatTollAmount/);
  assert.doesNotMatch(source, /providerNoteText\(item\.tariff/);
});

test("status line has translated provider names and manual calculation wording", async () => {
  const localization = await readFile(new URL("../src/localization.js", import.meta.url), "utf8");
  assert.match(localization, /providerName: \{ mock: "Mock \(offline\)", nakordoni: "Nakordoni"/);
  assert.match(localization, /manualOnly: "Berechnung nur nach Klick"/);
  assert.match(localization, /manualOnly: "Calculation only after click"/);
});
