import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bundle = await readFile(new URL("../dist/camper-route-planner-card.js", import.meta.url), "utf8");
const bundleVersion = "0.1.6-beta.15";
const html = "<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card></body></html>";
const resourceHtml = `<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card><script>window.customCards = [];</script><script type="module" src="/camper_route_planner/camper-route-planner-card.js?v=${bundleVersion}"></script></body></html>`;
const server = createServer((request, response) => {
  if (request.url === "/") { response.writeHead(200, { "content-type": "text/html" }); response.end(html); return; }
  if (request.url === "/resource-test") { response.writeHead(200, { "content-type": "text/html" }); response.end(resourceHtml); return; }
  if (new URL(request.url, "http://127.0.0.1").pathname === "/camper_route_planner/camper-route-planner-card.js") {
    response.writeHead(200, { "content-type": "application/javascript", "cache-control": "public, max-age=31536000" }); response.end(bundle); return;
  }
  response.writeHead(404); response.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), headless: true, args: ["--no-sandbox"] });

const resourcePage = await browser.newPage({ viewport: { width: 1024, height: 800 } });
const resourceResponse = await resourcePage.goto(`http://127.0.0.1:${port}/resource-test`);
assert.equal(resourceResponse.status(), 200, "HA-like resource page loads");
assert.equal(await resourcePage.evaluate(() => customElements.whenDefined("camper-route-planner-card").then(() => true)), true, "custom element is registered from the served module");
assert.equal(await resourcePage.locator("camper-route-planner-card").count(), 1, "card is instantiated from the resource URL");
const resourceBody = await resourcePage.evaluate((url) => fetch(url).then((response) => response.text()), `http://127.0.0.1:${port}/camper_route_planner/camper-route-planner-card.js?v=${bundleVersion}`);
assert.match(resourceBody, new RegExp(`Camper Route Planner Card v${bundleVersion.replaceAll(".", "\\.")}`));
const editorResult = await resourcePage.evaluate(() => {
  const cardClass = customElements.get("camper-route-planner-card");
  const catalogEntry = window.customCards.find((item) => item.type === "camper-route-planner-card");
  const stub = cardClass.getStubConfig();
  const editor = cardClass.getConfigElement();
  editor.setConfig({ type: "custom:camper-route-planner-card", entry_id: "" });
  document.body.append(editor);
  return { stub, catalogEntry, tag: editor.tagName.toLowerCase(), hasSelect: Boolean(editor.querySelector("select")) };
});
assert.deepEqual(editorResult.stub, { entry_id: "" }, "picker stub omits the type field");
assert.equal(editorResult.catalogEntry.type, "camper-route-planner-card", "catalog metadata uses the tag name without custom prefix");
assert.equal(editorResult.catalogEntry.preview, true, "catalog metadata enables preview");
assert.deepEqual({ tag: editorResult.tag, hasSelect: editorResult.hasSelect }, { tag: "camper-route-planner-card-editor", hasSelect: true }, "visual editor is created by the card contract");
await resourcePage.close();

async function preparePage(viewport, colorScheme = "light", tileHandler = null, hasTouch = false, geocodeError = false, fixture = {}) {
  const page = await browser.newPage({ viewport, colorScheme, hasTouch });
  let tileRequests = 0;
  page.on("request", (request) => { if (request.url().startsWith("https://tiles.test/")) tileRequests += 1; });
  page.tileRequestCount = () => tileRequests;
  await page.route("https://tiles.test/**", tileHandler || (async (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") })));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.addScriptTag({ content: bundle });
  await page.evaluate(({ shouldFailGeocode, fixture }) => {
    const card = document.querySelector("camper-route-planner-card");
    card.setConfig({ type: "custom:camper-route-planner-card", entry_id: "test-entry", show_developer_diagnostics: fixture.showDeveloperDiagnostics === true });
    let calculateCalls = 0;
    let lastServiceData = null;
    let reverseCalls = 0;
    let disarmCalls = 0;
    card.hass = {
      language: fixture.language || "en",
      connection: {},
      user: { is_admin: fixture.isAdmin === true },
      callWS: async (message) => {
        if (message.type.endsWith("/list_profiles")) return { provider: "mock", profiles: [{ profile_id: "test", name: "Test motorhome", height_m: 3.2, width_m: 2.34, length_m: 7.65, gross_weight_kg: 4800, vehicle_kind: "motorhome", fuel_type: "diesel", tank_capacity_l: fixture.profile?.tank_capacity_l ?? 100, consumption_l_per_100km: fixture.profile?.consumption_l_per_100km ?? 10 }, { profile_id: "second", name: "Second motorhome", height_m: 3.1, width_m: 2.3, length_m: 7, gross_weight_kg: 4200, vehicle_kind: "motorhome", fuel_type: "diesel", tank_capacity_l: 200, consumption_l_per_100km: 12 }] };
        if (message.type.endsWith("/list_routes")) return { routes: [] };
        if (message.type.endsWith("/map_config")) return { provider: "carto", status: "configured", tile_url: "https://tiles.test/{z}/{x}/{y}.png?key=browser-safe", tile_attribution: "Mock attribution", browser_safe: true };
        if (message.type.endsWith("/load_route") && fixture.savedRoute) return { route: fixture.savedRoute };
        if (message.type.endsWith("/tracker_position")) return { available: true, point: { latitude: 47.3769, longitude: 8.5417, label: "tracker" } };
        if (message.type.endsWith("/geocode")) { if (shouldFailGeocode) throw new Error("mock geocoding unavailable"); await new Promise((resolve) => setTimeout(resolve, 20)); return { configured: true, results: [{ label: "Fixture address", latitude: 48.137, longitude: 11.575 }, { label: "Second fixture address", latitude: 48.138, longitude: 11.576 }] }; }
        if (message.type.endsWith("/reverse_geocode")) { reverseCalls += 1; return { configured: false, address: "" }; }
        if (message.type.endsWith("/arm_request_diagnostics")) return { armed: true, diagnostic_token: "fixture-diagnostic-token" };
        if (message.type.endsWith("/disarm_request_diagnostics")) { disarmCalls += 1; return { armed: false }; }
        if (message.type.endsWith("/export_gpx")) return { filename: "camper-route-2026-10-16.gpx", mime_type: "application/gpx+xml", content: '<?xml version="1.0"?><gpx version="1.1" />' };
        if (message.type === "call_service") {
          calculateCalls += 1;
          lastServiceData = message.service_data;
          if (fixture.failCalculation) throw new Error("mock route failed");
          return { response: { provider: "mock", synthetic: true, distance_m: fixture.distance_m ?? 1234, duration_s: 3600, warnings: [], geometry: { points: [{ latitude: 49, longitude: 7 }, { latitude: 50, longitude: 8 }] }, ...(fixture.requestDiagnostic ? { request_diagnostic: fixture.requestDiagnostic } : {}) } };
        }
        return {};
      }
    };
    globalThis.__crp = { card, get calculateCalls() { return calculateCalls; }, get reverseCalls() { return reverseCalls; }, get lastServiceData() { return lastServiceData; }, get disarmCalls() { return disarmCalls; } };
  }, { shouldFailGeocode: geocodeError, fixture });
  await page.locator("details.route-planner-shell").waitFor();
  assert.equal(await page.locator("details.route-planner-shell").getAttribute("open"), null, "card starts collapsed");
  assert.match(await page.locator(".status-line").textContent(), /Test motorhome · Mock \(offline\) · (Calculation only after click|Berechnung nur nach Klick)/, "collapsed header shows the selected vehicle, provider and manual-only status");
  await page.locator("summary.route-planner-summary").click();
  await page.locator(".panel").first().waitFor();
  return page;
}

async function calculate(page) {
  await page.locator('input[data-point="origin"][data-field="latitude"]').fill("49");
  await page.locator('input[data-point="origin"][data-field="longitude"]').fill("7");
  await page.locator('input[data-point="destination"][data-field="latitude"]').fill("50");
  await page.locator('input[data-point="destination"][data-field="longitude"]').fill("8");
  await page.evaluate(() => { const card = document.querySelector("camper-route-planner-card"); card._state.origin = { ...card._state.origin, latitude: 49, longitude: 7 }; card._state.destination = { ...card._state.destination, latitude: 50, longitude: 8 }; return card.calculate(); });
  await page.locator(".result .metrics").first().waitFor();
}

const desktop = await preparePage({ width: 1280, height: 900 });
assert.equal(await desktop.locator(".result .metrics").count(), 0, "rendering must not calculate");
assert.equal(await desktop.evaluate(() => globalThis.__crp.calculateCalls), 0, "rendering must not call the route service");
assert.equal(await desktop.locator("button[data-action=arm-diagnostics]").count(), 0, "developer diagnostics are hidden by default");

const nonAdminDiagnosticPage = await preparePage({ width: 900, height: 800 }, "light", null, false, false, { showDeveloperDiagnostics: true, isAdmin: false });
assert.equal(await nonAdminDiagnosticPage.locator("button[data-action=arm-diagnostics]").count(), 0, "non-admins cannot see developer diagnostics");
await nonAdminDiagnosticPage.close();

const diagnosticPage = await preparePage({ width: 900, height: 800 }, "light", null, false, false, { showDeveloperDiagnostics: true, isAdmin: true, requestDiagnostic: { request: { coordinates: { origin: { latitude: 49, longitude: 7 } } }, response: { distance_m: 1234 } } });
await diagnosticPage.getByRole("button", { name: /Diagnose der nächsten Anfrage|Request diagnostics/ }).click();
await diagnosticPage.evaluate(() => { const card = document.querySelector("camper-route-planner-card"); card._state.origin = { ...card._state.origin, latitude: 49, longitude: 7 }; card._state.destination = { ...card._state.destination, latitude: 50, longitude: 8 }; return card.calculate(); });
await diagnosticPage.locator("textarea[data-diagnostic-copy]").waitFor();
assert.equal(await diagnosticPage.locator("button[data-action=copy-diagnostics]").count(), 1, "diagnostic copy action is rendered");
assert.match(await diagnosticPage.locator("textarea[data-diagnostic-copy]").inputValue(), /coordinates/);
await diagnosticPage.locator("button[data-action=copy-diagnostics]").click();
assert.match(await diagnosticPage.locator("[role=status]").textContent(), /Clipboard unavailable|Zwischenablage nicht verfügbar|copied|kopiert/i, "copy action gives a success or safe manual-copy status");
assert.equal((await diagnosticPage.evaluate(() => globalThis.__crp.lastServiceData.diagnostic_token)), "fixture-diagnostic-token", "diagnostic token is bound to the single calculation request");
await diagnosticPage.evaluate(() => document.querySelector("camper-route-planner-card").setConfig({ entry_id: "test-entry", show_developer_diagnostics: false }));
assert.equal(await diagnosticPage.locator("button[data-action=arm-diagnostics]").count(), 0, "disabling the option hides the action");
assert.equal(await diagnosticPage.locator("textarea[data-diagnostic-copy]").count(), 0, "disabling the option clears the diagnostic view");
assert.equal(await diagnosticPage.evaluate(() => globalThis.__crp.disarmCalls), 1, "disabling the option revokes an armed diagnostic");
await diagnosticPage.close();
await desktop.locator('input[data-fuel-field="fuel_level_l"]').fill("40");
assert.equal(await desktop.locator('input[data-fuel-field="reserve_l"]').count(), 0, "legacy reserve is not editable in the fuel section");
const priceInput = desktop.locator('input[data-fuel-field="diesel_price_per_l"]');
await priceInput.scrollIntoViewIfNeeded();
await priceInput.fill("");
await priceInput.focus();
await priceInput.evaluate((input) => { window.__fuelPriceInput = input; });
for (const character of "2,16") {
  await desktop.keyboard.type(character);
  assert.equal(await priceInput.evaluate((input) => input === input.getRootNode().activeElement), true, `diesel price keeps focus after ${character}`);
  assert.equal(await priceInput.evaluate((input) => input === window.__fuelPriceInput), true, `diesel price keeps its DOM node after ${character}`);
}
assert.equal(await priceInput.inputValue(), "2,16", "all diesel price characters are retained without a second click");
assert.equal(await desktop.evaluate(() => globalThis.__crp.calculateCalls), 0, "fuel edits do not call the route service");
assert.deepEqual(await desktop.evaluate(() => JSON.parse(localStorage.getItem("camper-route-planner:fuel:test-entry:test"))), { fuel_level_l: "40", fuel_level_pct: "", reserve_l: "", diesel_price_per_l: "2,16", fuel_level_mode: "liters" }, "fuel edits persist in the vehicle-scoped local store");
const coordinateInput = desktop.locator('input[data-point="origin"][data-field="latitude"]');
await coordinateInput.fill("");
await coordinateInput.focus();
await coordinateInput.evaluate((input) => { window.__originLatitudeInput = input; });
for (const character of "49") {
  await desktop.keyboard.type(character);
  assert.equal(await coordinateInput.evaluate((input) => input === input.getRootNode().activeElement), true, `coordinate keeps focus after ${character}`);
  assert.equal(await coordinateInput.evaluate((input) => input === window.__originLatitudeInput), true, `coordinate keeps its DOM node after ${character}`);
}
assert.equal(await coordinateInput.inputValue(), "49", "coordinate input retains sequential keyboard input");
await desktop.locator("select[data-fuel-mode]").selectOption("percent");
assert.equal(await desktop.locator('input[data-fuel-field="fuel_level_pct"]').inputValue(), "40", "switching to percent converts the active value");
await desktop.locator("select[data-fuel-mode]").selectOption("liters");
assert.equal(await desktop.locator('input[data-fuel-field="fuel_level_l"]').inputValue(), "40", "switching back to litres restores the converted value");
await desktop.locator('select[data-action="profile"]').selectOption("second");
assert.equal(await desktop.locator('input[data-fuel-field="fuel_level_l"]').inputValue(), "", "switching vehicles does not reuse another vehicle's fuel level");
await desktop.locator('select[data-action="profile"]').selectOption("test");
assert.equal(await desktop.locator('input[data-fuel-field="fuel_level_l"]').inputValue(), "40", "returning to a vehicle restores its local fuel values");
await desktop.locator(".leaflet-container").waitFor();
assert.equal(await desktop.locator(".result .metrics").count(), 0, "a basemap is visible before route calculation");
assert.equal(await desktop.locator(".leaflet-tile").count() > 0, true, "geographic tile fixture is visible before route calculation");
const initialTileCoverage = await desktop.evaluate(() => {
  const map = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".leaflet-container");
  const mapRect = map?.getBoundingClientRect();
  const tiles = [...(map?.querySelectorAll(".leaflet-tile-loaded") || [])].map((tile) => tile.getBoundingClientRect());
  const samples = [
    [mapRect.left + 1, mapRect.top + 1],
    [mapRect.right - 1, mapRect.top + 1],
    [mapRect.left + 1, mapRect.bottom - 1],
    [mapRect.right - 1, mapRect.bottom - 1],
    [(mapRect.left + mapRect.right) / 2, (mapRect.top + mapRect.bottom) / 2],
  ];
  return {
    width: mapRect?.width || 0,
    height: mapRect?.height || 0,
    tileCount: tiles.length,
    hasTilePane: Boolean(map?.querySelector(".leaflet-tile-pane")),
    hasMapPane: Boolean(map?.querySelector(".leaflet-map-pane")),
    covered: Boolean(mapRect) && samples.every(([x, y]) => tiles.some((tile) => x >= tile.left && x <= tile.right && y >= tile.top && y <= tile.bottom)),
  };
});
assert.ok(initialTileCoverage.width > 500 && initialTileCoverage.height > 300, "Leaflet container fills the map area");
assert.ok(initialTileCoverage.tileCount >= 4, "Leaflet loads a tile grid rather than one isolated tile");
assert.equal(initialTileCoverage.hasTilePane, true, "Leaflet tile pane is present");
assert.equal(initialTileCoverage.hasMapPane, true, "Leaflet map pane is present");
assert.equal(initialTileCoverage.covered, true, "loaded tiles cover the complete visible map container");
await desktop.waitForFunction(() => document.querySelector("camper-route-planner-card")?._state.origin.latitude === 47.3769);
const selectionMapState = await desktop.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map");
  window.__selectionMapHost = host;
  return { leafletId: host?._leaflet_id, tileCount: host?.querySelectorAll(".leaflet-tile").length || 0 };
});
const selectionTileRequests = desktop.tileRequestCount();
const attributionFlag = await desktop.locator(".leaflet-attribution-flag").evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, inAttribution: Boolean(node.closest(".leaflet-control-attribution")) }));
assert.ok(attributionFlag.width <= 20 && attributionFlag.height <= 12, "Leaflet attribution flag keeps its intrinsic size instead of becoming a map-sized rectangle");
assert.equal(attributionFlag.inAttribution, true, "attribution flag remains inside the attribution control");
const emptyTileFailure = await preparePage({ width: 1280, height: 900 }, "light", async (route) => route.fulfill({ status: 403, body: "forbidden" }));
await emptyTileFailure.getByText("Map tiles are unavailable; check the map provider and key.").waitFor();
assert.equal(await emptyTileFailure.locator(".result .metrics").count(), 0, "tile failure before route calculation does not calculate a route");
assert.equal(await emptyTileFailure.getByText("Map tiles are unavailable; check the map provider and key.").count(), 1, "empty tile failure explains the map problem");
await emptyTileFailure.close();
const longDestination = "Rue de la République, Strasbourg, France";
const destinationSearch = desktop.locator('input[data-search-input="destination"]');
const destinationIdentity = await destinationSearch.evaluate((input) => {
  document.body.style.minHeight = "2400px";
  input.focus();
  window.scrollTo(0, 240);
  window.__destinationInput = input;
  return { scrollY: window.scrollY };
});
await destinationSearch.fill(longDestination);
await desktop.locator('button[data-action="search"][data-target="destination"]').click();
await desktop.locator('.panel').nth(2).locator('.search-results').waitFor({ timeout: 5000 });
assert.equal(await destinationSearch.inputValue(), longDestination, "long destination input survives async search rendering");
assert.equal(await destinationSearch.evaluate((input) => input === input.getRootNode().activeElement), true, "destination input keeps focus after async search rendering");
assert.equal(await destinationSearch.evaluate((input) => input === window.__destinationInput), true, "destination input remains the same DOM node during async search rendering");
assert.equal(await desktop.evaluate(() => window.scrollY), destinationIdentity.scrollY, "page scroll position remains stable while suggestions update");
assert.equal(await desktop.locator('.panel').nth(2).locator('.search-results').count(), 1, "search results render directly inside destination editor");
assert.equal(await desktop.locator('.panel').nth(2).locator('.search-results button').count(), 2, "multiple asynchronous search results render in the destination editor");
assert.equal(await desktop.locator('.waypoints .search-results').count(), 0, "search results do not render below waypoint editor");
await desktop.getByRole("button", { name: "Fixture address", exact: true }).click();
assert.equal(await desktop.locator('input[data-point="destination"][data-field="latitude"]').inputValue(), "48.137", "selected search result fills latitude");
assert.equal(await desktop.locator('input[data-point="destination"][data-field="longitude"]').inputValue(), "11.575", "selected search result fills longitude");
assert.equal(await desktop.evaluate(() => document.querySelector("camper-route-planner-card")._state.destination.address), "Fixture address", "selected address is retained in state");
assert.ok((await desktop.locator('.panel').nth(2).locator('.point-address').textContent()).includes("Fixture address"), "selected address is shown");
assert.equal(await desktop.locator('.panel').nth(2).locator('.search-results').count(), 0, "search results close after selection");
assert.equal(await desktop.locator('.panel').nth(2).locator('input[data-search-input="destination"] + button').count(), 1, "destination search stays with destination editor");
assert.equal(await desktop.locator('.waypoints .search-results').count(), 0, "destination results never render below waypoints");
assert.ok(await desktop.locator('.leaflet-marker-icon').count() >= 2, "origin and selected destination markers are rendered");
const afterFirstSelection = await desktop.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map");
  return { sameHost: host === window.__selectionMapHost, leafletId: host?._leaflet_id, tileCount: host?.querySelectorAll(".leaflet-tile").length || 0, hasFallback: Boolean(host?.querySelector(":scope > svg")), markers: host?.querySelectorAll(".leaflet-marker-icon").length || 0 };
});
assert.equal(afterFirstSelection.sameHost, true, "target selection keeps the existing map container");
assert.equal(afterFirstSelection.leafletId, selectionMapState.leafletId, "target selection keeps the existing Leaflet instance");
assert.equal(afterFirstSelection.tileCount, selectionMapState.tileCount, "target selection does not rebuild the tile layer");
assert.ok(desktop.tileRequestCount() >= selectionTileRequests, "target selection may refit but keeps the existing tile layer");
assert.equal(afterFirstSelection.hasFallback, false, "target selection does not activate the SVG fallback");
assert.equal(afterFirstSelection.markers, 2, "target selection leaves exactly one marker per point");
assert.equal(await desktop.evaluate(() => window.scrollY), destinationIdentity.scrollY, "target selection keeps the dashboard scroll position");
await destinationSearch.fill("Second fixture address");
await desktop.evaluate((query) => { const card = document.querySelector("camper-route-planner-card"); card._inputDrafts.set("destination:0", query); return card.searchAddress("destination", query, 0); }, "Second fixture address");
await desktop.locator('.panel').nth(2).locator('.search-results').waitFor();
await desktop.locator('.panel').nth(2).locator('.search-results').getByRole("button", { name: "Second fixture address", exact: true }).click();
assert.equal(await desktop.locator('input[data-point="destination"][data-field="latitude"]').inputValue(), "48.138", "repeated target selection updates latitude");
assert.equal(await desktop.evaluate(() => document.querySelector("camper-route-planner-card")._state.destination.address), "Second fixture address", "repeated target selection updates the address");
const afterSecondSelection = await desktop.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map");
  return { sameHost: host === window.__selectionMapHost, leafletId: host?._leaflet_id, tileCount: host?.querySelectorAll(".leaflet-tile").length || 0, markers: host?.querySelectorAll(".leaflet-marker-icon").length || 0 };
});
assert.equal(afterSecondSelection.sameHost, true, "repeated target selection keeps the existing map container");
assert.equal(afterSecondSelection.leafletId, selectionMapState.leafletId, "repeated target selection keeps one Leaflet instance");
assert.equal(afterSecondSelection.tileCount, selectionMapState.tileCount, "repeated target selection does not reload tiles");
assert.ok(desktop.tileRequestCount() >= selectionTileRequests, "repeated target selection may refit but keeps the existing tile layer");
assert.equal(afterSecondSelection.markers, 2, "repeated target selection does not duplicate markers");
await desktop.evaluate(() => { const card = document.querySelector("camper-route-planner-card"); card._state.waypoints = [{ latitude: "", longitude: "", label: "" }]; card.render(); });
await desktop.locator('.waypoints input[data-search-input="waypoint"]').waitFor();
const waypointMapState = await desktop.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map");
  return { host, leafletId: host?._leaflet_id, tileCount: host?.querySelectorAll(".leaflet-tile").length || 0 };
});
const selectWaypoint = async (query, resultName) => {
  await desktop.locator('.waypoints input[data-search-input="waypoint"]').fill(query);
  await desktop.locator('.waypoints button[data-action="search"][data-index="0"]').click();
  await desktop.locator('.waypoints [data-search-results][data-index="0"].search-results').waitFor();
  await desktop.locator('.waypoints [data-search-results][data-index="0"].search-results').getByRole("button", { name: resultName, exact: true }).click();
};
await selectWaypoint("Waypoint fixture", "Fixture address");
const afterWaypointSelection = await desktop.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map");
  return { sameHost: host === window.__selectionMapHost, leafletId: host?._leaflet_id, tileCount: host?.querySelectorAll(".leaflet-tile").length || 0, markers: host?.querySelectorAll(".leaflet-marker-icon").length || 0, preview: host?.querySelectorAll(".crp-preview-line").length || 0, brokenImages: host?.querySelectorAll(".leaflet-marker-icon img").length || 0 };
});
assert.equal(afterWaypointSelection.sameHost, true, "waypoint selection keeps the existing map container");
assert.equal(afterWaypointSelection.leafletId, waypointMapState.leafletId, "waypoint selection keeps the existing Leaflet instance");
assert.equal(afterWaypointSelection.markers, 3, "start, waypoint and destination each have one marker");
assert.equal(afterWaypointSelection.preview, 1, "unrouted point sequence uses a visible straight-line preview");
assert.equal(afterWaypointSelection.brokenImages, 0, "bundled div markers do not request broken image assets");
await selectWaypoint("Second waypoint fixture", "Second fixture address");
assert.equal(await desktop.locator(".leaflet-marker-icon").count(), 3, "changing a waypoint does not duplicate markers");
const afterWaypointChange = await desktop.evaluate(() => document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map")?._leaflet_id);
assert.equal(afterWaypointChange, waypointMapState.leafletId, "changing a waypoint keeps the existing Leaflet instance");
await desktop.evaluate(() => { const card = document.querySelector("camper-route-planner-card"); card._state.waypoints = []; card._fitMapOnNextRender = true; card.render(); });
assert.equal(await desktop.locator(".leaflet-marker-icon").count(), 2, "removing a waypoint removes only its marker");
assert.equal(await desktop.evaluate(() => document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map")?._leaflet_id), waypointMapState.leafletId, "removing a waypoint keeps the existing Leaflet instance");
await desktop.evaluate(() => {
  const card = document.querySelector("camper-route-planner-card");
  card._state.waypoints = [{ latitude: 48.2, longitude: 11.6, address: "Waypoint A" }, { latitude: 48.3, longitude: 11.7, address: "Waypoint B" }];
  card._fitMapOnNextRender = true;
  card.render();
});
await desktop.evaluate(() => { const card = document.querySelector("camper-route-planner-card"); card._state.waypoints.reverse(); card._fitMapOnNextRender = true; card.render(); });
assert.deepEqual(await desktop.evaluate(() => document.querySelector("camper-route-planner-card")._state.waypoints.map((point) => point.address)), ["Waypoint B", "Waypoint A"], "reordering waypoints changes their order");
assert.equal(await desktop.locator(".leaflet-marker-icon").count(), 4, "reordering keeps exactly one marker per point");
assert.equal(await desktop.evaluate(() => document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map")?._leaflet_id), waypointMapState.leafletId, "reordering keeps the existing Leaflet instance");
await desktop.evaluate(() => document.querySelector("camper-route-planner-card").useTrackerLocation(true));
await desktop.waitForFunction(() => document.querySelector("camper-route-planner-card")._state.origin.latitude === 47.3769);
assert.equal(await desktop.locator('input[data-point="origin"][data-field="longitude"]').inputValue(), "8.5417", "tracker point fills origin coordinates");
await desktop.evaluate(() => document.querySelector("camper-route-planner-card").calculate());
await desktop.locator(".result .metrics").first().waitFor();
assert.equal(await desktop.locator(".fuel-planning-notice").count(), 0, "a route within the current fuel level has no refuelling note");
await desktop.locator('input[data-fuel-field="fuel_level_l"]').fill("0");
assert.equal(await desktop.locator(".fuel-planning-notice").count(), 1, "zero fuel is valid and produces a neutral refuelling note");
assert.equal(await desktop.locator(".fuel-planning-notice.error").count(), 0, "additional fuel demand is not rendered as an error");
assert.match(await desktop.locator(".fuel-planning-notice").textContent(), /Refuelling stops required/);
await desktop.locator('input[data-fuel-field="fuel_level_l"]').fill("40");
const collapseState = await desktop.evaluate(() => {
  const card = document.querySelector("camper-route-planner-card");
  const host = card.shadowRoot.querySelector(".crp-map");
  return { calls: globalThis.__crp.calculateCalls, host, leafletId: host?._leaflet_id, destination: { ...card._state.destination }, geometry: card._state.result?.geometry };
});
await desktop.locator("summary.route-planner-summary").click();
assert.equal(await desktop.locator("details.route-planner-shell").getAttribute("open"), null, "header click collapses the card");
assert.equal(await desktop.locator(".result .metrics").first().isVisible(), false, "route details are hidden while collapsed");
assert.equal(await desktop.evaluate(() => globalThis.__crp.calculateCalls), collapseState.calls, "collapsing does not calculate again");
await desktop.locator("summary.route-planner-summary").click();
await desktop.locator(".result .metrics").first().waitFor();
assert.equal(await desktop.evaluate(() => globalThis.__crp.calculateCalls), collapseState.calls, "reopening does not calculate again");
assert.deepEqual(await desktop.evaluate(() => document.querySelector("camper-route-planner-card")._state.destination), collapseState.destination, "destination survives collapse and reopen");
assert.deepEqual(await desktop.evaluate(() => document.querySelector("camper-route-planner-card")._state.result.geometry), collapseState.geometry, "route geometry survives collapse and reopen");
assert.equal(await desktop.evaluate(() => document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map")?._leaflet_id), collapseState.leafletId, "reopening keeps the existing Leaflet instance");
const desktopNavigation = desktop.locator('.navigation-actions .navigation-link');
assert.equal(await desktopNavigation.count(), 1, "a valid route renders a direct navigation link");
assert.match(await desktopNavigation.getAttribute("href"), /^https:\/\/www\.openstreetmap\.org\/directions\?route=/, "desktop uses the browser fallback");
assert.equal(await desktopNavigation.getAttribute("target"), "_blank", "navigation opens from the user-activated link");
assert.equal(await desktopNavigation.getAttribute("rel"), "noopener noreferrer", "navigation link is isolated from the opener");
await desktop.locator(".leaflet-container").waitFor();
await desktop.waitForFunction(() => globalThis.__crp.reverseCalls > 0);
await desktop.locator(".point-address").first().waitFor();
assert.ok(await desktop.evaluate(() => globalThis.__crp.reverseCalls > 0), "valid points use backend reverse geocoding");
assert.equal(await desktop.locator(".crp-map > svg").count(), 0, "successful tile mock uses Leaflet");
assert.equal(await desktop.locator(".crp-route-line").count(), 1, "calculated geometry uses the real route line style");
await desktop.setViewportSize({ width: 700, height: 900 });
await desktop.waitForFunction(() => { const node = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".leaflet-container"); return node?.clientWidth > 0 && node?.clientHeight > 0; });
assert.equal(await desktop.locator(".leaflet-container").evaluate((node) => node.clientWidth > 0 && node.clientHeight > 0), true, "Leaflet map remains sized after viewport resize");
const lifecycle = await desktop.evaluate(() => {
  const card = document.querySelector("camper-route-planner-card");
  const oldHost = card.shadowRoot.querySelector(".crp-map");
  const oldHadLeafletClass = oldHost?.classList.contains("leaflet-container");
  const oldHadMapPane = Boolean(oldHost?.querySelector(".leaflet-map-pane"));
  card.render();
  const newHost = card.shadowRoot.querySelector(".crp-map");
  const afterRender = { oldHadLeafletClass, oldHadMapPane, oldHostClassAfterRender: oldHost?.className || "", oldHostMapPaneAfterRender: Boolean(oldHost?.querySelector(".leaflet-map-pane")), newMap: Boolean(newHost?.classList.contains("leaflet-container")) };
  card.remove();
  const afterDisconnect = { newMapHostChildren: newHost?.children.length || 0 };
  document.body.append(card);
  const afterReconnect = { reconnectedMap: Boolean(card.shadowRoot.querySelector(".crp-map.leaflet-container")) };
  return { afterRender, afterDisconnect, afterReconnect };
});
assert.equal(lifecycle.afterRender.oldHadLeafletClass, true, "the test started with a Leaflet map");
assert.equal(lifecycle.afterRender.oldHadMapPane, true, "the test started with Leaflet map DOM");
assert.equal(lifecycle.afterRender.oldHostMapPaneAfterRender, true, "rerender keeps the existing Leaflet DOM");
assert.ok(lifecycle.afterRender.newMap, "rerender preserves the visible Leaflet map");
assert.equal(lifecycle.afterDisconnect.newMapHostChildren, 0, "disconnect leaves no stale map DOM");
assert.ok(lifecycle.afterReconnect.reconnectedMap, "reconnect rebuilds the preview map");
const foreignMapIsolation = await desktop.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-leaflet-map");
  const map = host;
  return {
    className: map?.className || "",
    exposesGenericHandle: Boolean(map && Object.prototype.hasOwnProperty.call(map, "_leafletMap")),
    exposesGenericClass: Boolean(map?.classList.contains("leaflet-map")),
  };
});
assert.equal(foreignMapIsolation.exposesGenericHandle, false, "the route map must not expose other cards' generic Leaflet handle");
assert.equal(foreignMapIsolation.exposesGenericClass, false, "the route map must not expose other cards' generic Leaflet class");
assert.match(foreignMapIsolation.className, /(^| )crp-leaflet-map( |$)/, "the route map keeps a namespaced class");
const callsBeforeExport = await desktop.evaluate(() => globalThis.__crp.calculateCalls);
const download = await (async () => { const wait = desktop.waitForEvent("download"); await desktop.evaluate(() => document.querySelector("camper-route-planner-card").exportRoute("route")); return wait; })();
assert.equal(download.suggestedFilename(), "camper-route-2026-10-16.gpx", "export uses backend filename");
assert.equal(await desktop.evaluate(() => globalThis.__crp.calculateCalls), callsBeforeExport, "export does not recalculate");
const pdfDownload = await (async () => { const wait = desktop.waitForEvent("download"); await desktop.locator('button[data-action="pdf"]').click(); return wait; })();
assert.match(pdfDownload.suggestedFilename(), /\.pdf$/, "PDF export uses a safe PDF filename");
assert.equal(await desktop.evaluate(() => globalThis.__crp.calculateCalls), callsBeforeExport, "PDF export does not recalculate");
await desktop.screenshot({ path: "../docs/phase2c-desktop.png", fullPage: true });

const auto = await browser.newPage({ viewport: { width: 900, height: 700 } });
await auto.goto(`http://127.0.0.1:${port}/`);
await auto.evaluate(() => { window.customCards = []; });
await auto.addScriptTag({ content: bundle });
await auto.evaluate(() => {
  const card = document.querySelector("camper-route-planner-card");
  card.hass = { language: "en", connection: {}, callWS: async (message) => {
    if (message.type.endsWith("/list_entries")) return { entries: [{ entry_id: "auto-entry", title: "Automatically selected" }] };
    if (message.type.endsWith("/list_profiles")) return { profiles: [] };
    if (message.type.endsWith("/list_routes")) return { routes: [] };
    if (message.type.endsWith("/map_config")) return { provider: "none", status: "not_configured" };
    return {};
  } };
  globalThis.__autoCard = card;
});
await auto.locator("summary.route-planner-summary").click();
await auto.locator(".panel").first().waitFor();
assert.equal(await auto.evaluate(() => globalThis.__autoCard._config.entry_id), "auto-entry", "single entry is auto-selected");
assert.equal(await auto.evaluate(() => window.customCards.filter((item) => item.type === "camper-route-planner-card").length), 1, "catalog registration is idempotent");
await auto.close();

const mobile = await preparePage({ width: 390, height: 844 });
await mobile.route("https://tiles.test/**", async (route) => route.fulfill({ status: 403, body: "forbidden" }));
const mobileDestination = mobile.locator('input[data-search-input="destination"]');
await mobileDestination.fill("Via Roma 123, Palermo, Italy");
await mobile.waitForTimeout(500);
assert.equal(await mobileDestination.inputValue(), "Via Roma 123, Palermo, Italy", "mobile destination input survives missing-key response");
assert.equal(await mobileDestination.evaluate((input) => input === input.getRootNode().activeElement), true, "mobile destination input keeps focus");
await calculate(mobile);
assert.equal(await mobile.locator(".grid").evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length), 1, "mobile layout uses one column");
await mobile.screenshot({ path: "../docs/phase2c-mobile.png", fullPage: true });

const touchSelection = await preparePage({ width: 390, height: 844 }, "light", null, true);
const touchSearch = touchSelection.locator('input[data-search-input="destination"]');
await touchSearch.fill("Touch selection address");
await touchSelection.evaluate((query) => { const card = document.querySelector("camper-route-planner-card"); card._inputDrafts.set("destination:0", query); return card.searchAddress("destination", query, 0); }, "Touch selection address");
await touchSelection.locator('.panel').nth(2).locator('.search-results').waitFor();
await touchSelection.getByRole("button", { name: "Fixture address", exact: true }).tap();
assert.equal(await touchSelection.locator('input[data-point="destination"][data-field="latitude"]').inputValue(), "48.137", "touch selection fills destination latitude");
assert.equal(await touchSelection.evaluate(() => document.querySelector("camper-route-planner-card")._state.destination.address), "Fixture address", "touch selection keeps the address label");
assert.equal(await touchSelection.locator(".crp-map > svg").count(), 0, "touch selection keeps Leaflet instead of SVG fallback");
await touchSelection.close();

const buttonFlow = await preparePage({ width: 390, height: 844 }, "light", null, true);
await buttonFlow.waitForFunction(() => document.querySelector("camper-route-planner-card")?._state.origin.latitude === 47.3769);
const buttonFlowViewState = await buttonFlow.evaluate(() => {
  document.body.style.minHeight = "2600px";
  window.scrollTo(0, 520);
  const card = document.querySelector("camper-route-planner-card");
  const add = card?.shadowRoot?.querySelector('button[data-action="add"]');
  add?.focus();
  return { scrollY: window.scrollY, active: add === card?.shadowRoot?.activeElement };
});
assert.equal(buttonFlowViewState.active, true, "waypoint add button can receive keyboard focus before a DOM rebuild");
const buttonFlowMap = await buttonFlow.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map");
  window.__buttonFlowMapHost = host;
  return { leafletId: host?._leaflet_id };
});
const buttonFlowDestination = buttonFlow.locator('input[data-search-input="destination"]');
await buttonFlowDestination.fill("Button destination");
await buttonFlow.locator('button[data-action="search"][data-target="destination"]').click();
await buttonFlow.locator('.panel').nth(2).locator('.search-results').waitFor();
await buttonFlow.getByRole("button", { name: "Fixture address", exact: true }).click();
assert.equal(await buttonFlow.locator('input[data-point="destination"][data-field="latitude"]').inputValue(), "48.137", "real destination search button returns valid latitude");
assert.equal(await buttonFlow.locator('input[data-point="destination"][data-field="longitude"]').inputValue(), "11.575", "real destination search button returns valid longitude");
await buttonFlow.locator('.waypoints button[data-action="add"]').click();
await buttonFlow.locator('.waypoints input[data-search-input="waypoint"][data-index="0"]').waitFor();
assert.equal(await buttonFlow.evaluate(() => window.scrollY), buttonFlowViewState.scrollY, "adding a waypoint preserves the dashboard scroll position");
assert.equal(await buttonFlow.evaluate(() => document.querySelector("camper-route-planner-card")?.shadowRoot?.activeElement?.dataset?.action), "add", "adding a waypoint restores focus to the action button");
await buttonFlow.locator('.waypoints input[data-search-input="waypoint"][data-index="0"]').fill("Waypoint one");
await buttonFlow.locator('.waypoints button[data-action="search"][data-index="0"]').click();
await buttonFlow.locator('.waypoints [data-search-results][data-index="0"].search-results').waitFor();
await buttonFlow.locator('.waypoints [data-search-results][data-index="0"].search-results').getByRole("button", { name: "Second fixture address", exact: true }).click();
assert.equal(await buttonFlow.locator('input[data-point="waypoint"][data-index="0"][data-field="latitude"]').inputValue(), "48.138", "real waypoint search button returns valid latitude");
assert.equal(await buttonFlow.locator(".leaflet-marker-icon").count(), 3, "button flow renders origin, waypoint, and destination markers");
assert.equal(await buttonFlow.locator(".crp-preview-line").count(), 1, "button flow renders a straight preview line");
await buttonFlow.locator('.waypoints button[data-action="add"]').click();
await buttonFlow.locator('.waypoints input[data-search-input="waypoint"][data-index="1"]').fill("Waypoint two");
await buttonFlow.locator('.waypoints button[data-action="search"][data-index="1"]').click();
await buttonFlow.locator('.waypoints [data-search-results][data-index="1"].search-results').waitFor();
await buttonFlow.locator('.waypoints [data-search-results][data-index="1"].search-results').getByRole("button", { name: "Fixture address", exact: true }).click();
assert.equal(await buttonFlow.locator('.waypoints input[data-point="waypoint"]').count(), 4, "button flow preserves both waypoint coordinate pairs");
await buttonFlow.waitForFunction(() => {
  const addresses = document.querySelector("camper-route-planner-card")._state.waypoints.map((point) => point.address);
  return addresses.includes("Fixture address") && addresses.includes("Second fixture address");
});
await buttonFlow.locator('.waypoints button[data-action="down"][data-index="0"]').click();
assert.deepEqual(await buttonFlow.evaluate(() => document.querySelector("camper-route-planner-card")._state.waypoints.map((point) => point.address)), ["Fixture address", "Second fixture address"], "waypoint down button reorders points");
const beforeWaypointRemovalScroll = await buttonFlow.evaluate(() => window.scrollY);
await buttonFlow.locator('.waypoints button[data-action="remove"][data-index="1"]').click();
assert.equal(await buttonFlow.locator('.waypoints input[data-search-input="waypoint"]').count(), 1, "waypoint remove button removes only the selected waypoint");
await buttonFlow.waitForTimeout(80);
assert.equal(await buttonFlow.evaluate(() => window.scrollY), beforeWaypointRemovalScroll, "removing a waypoint preserves the current dashboard scroll position");
const buttonFlowMapAfter = await buttonFlow.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map");
  return { sameHost: host === window.__buttonFlowMapHost, leafletId: host?._leaflet_id, tileCount: host?.querySelectorAll(".leaflet-tile").length || 0 };
});
assert.equal(buttonFlowMapAfter.sameHost, true, "button flow keeps the existing map host");
assert.ok(buttonFlowMapAfter.leafletId, "button flow keeps a Leaflet instance after repeated DOM actions");
assert.equal(await buttonFlow.locator(".crp-map > svg").count(), 0, "button flow keeps CARTO Leaflet map instead of SVG fallback");
await buttonFlow.close();

const geocodeFailure = await preparePage({ width: 390, height: 844 }, "light", null, true, true);
await geocodeFailure.locator('input[data-search-input="destination"]').fill("Unavailable destination");
await geocodeFailure.locator('button[data-action="search"][data-target="destination"]').click();
await geocodeFailure.locator('[data-search-error]').waitFor({ state: "visible" });
assert.match(await geocodeFailure.locator('[data-search-error]').textContent(), /unavailable|nicht verfügbar/i, "geocoding failure is explained in the card");
await geocodeFailure.locator('.waypoints button[data-action="add"]').click();
assert.equal(await geocodeFailure.locator('.waypoints input[data-search-input="waypoint"]').count(), 1, "the remaining card stays usable after geocoding failure");
await geocodeFailure.close();

const tablet = await preparePage({ width: 768, height: 1024 }, "dark");
await calculate(tablet);
assert.equal(await tablet.locator(".grid").evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length), 2, "tablet layout uses two columns");
assert.equal(await tablet.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches), true, "dark mode is available to the browser");
await tablet.close();

const fuelRegression = await preparePage({ width: 1280, height: 900 }, "light", null, false, false, { language: "de", distance_m: 2474700, profile: { tank_capacity_l: 90, consumption_l_per_100km: 10.5 }, savedRoute: { route_id: "saved", name: "Portugal", provider: "mock", distance_m: 2474700, duration_s: 3600, geometry: { points: [{ latitude: 49, longitude: 7 }, { latitude: 50, longitude: 8 }] }, profile_id: "test", origin: { latitude: 49.294307, longitude: 7.051867, label: "Sulzbach/Saar" }, destination: { latitude: 41.3619, longitude: -8.6718, label: "Gondifelos" }, waypoints: [{ latitude: 38.878187, longitude: -6.970111, label: "Badajoz" }, { latitude: 41.313533, longitude: -8.722957, label: "Mindelo" }], route_options: { depart_at: null, arrive_at: null }, warnings: [], metadata: {}, fuel_values: { fuel_level_l: "90", fuel_level_pct: "", reserve_l: "", diesel_price_per_l: "2,16", fuel_level_mode: "liters" } } });
await fuelRegression.locator('input[data-fuel-field="fuel_level_l"]').fill("90");
await fuelRegression.locator('input[data-fuel-field="diesel_price_per_l"]').fill("2,16");
await calculate(fuelRegression);
const fuelText = await fuelRegression.locator(".fuel-range").textContent();
assert.doesNotMatch(fuelText, /Nicht berechenbar/);
assert.match(fuelText, /561,26\s*€/);
assert.equal(await fuelRegression.evaluate(() => globalThis.__crp.calculateCalls), 1, "price entry does not trigger a second routing request");
await fuelRegression.evaluate(() => { localStorage.clear(); return document.querySelector("camper-route-planner-card").loadRoute("saved"); });
await fuelRegression.waitForFunction(() => document.querySelector("camper-route-planner-card")?._state.result?.distance_m === 2474700);
assert.deepEqual(await fuelRegression.evaluate(() => {
  const card = document.querySelector("camper-route-planner-card");
  return { origin: card._state.origin, destination: card._state.destination, waypoints: card._state.waypoints, inputs: [...card.shadowRoot.querySelectorAll("input[data-point]")].map((input) => input.value) };
}), {
  origin: { latitude: 49.294307, longitude: 7.051867, label: "Sulzbach/Saar" },
  destination: { latitude: 41.3619, longitude: -8.6718, label: "Gondifelos" },
  waypoints: [{ latitude: 38.878187, longitude: -6.970111, label: "Badajoz" }, { latitude: 41.313533, longitude: -8.722957, label: "Mindelo" }],
  inputs: ["49.294307", "7.051867", "41.3619", "-8.6718", "38.878187", "-6.970111", "41.313533", "-8.722957"]
}, "loading a saved route replaces stale coordinate drafts for origin, destination, and ordered waypoints");
assert.equal(await fuelRegression.locator('input[data-fuel-field="diesel_price_per_l"]').inputValue(), "2,16", "saved route restores the manual decimal price");
assert.match(await fuelRegression.locator(".fuel-range").textContent(), /561,26\s*€/);
assert.equal(await fuelRegression.evaluate(() => globalThis.__crp.calculateCalls), 1, "loading a saved route does not call the routing service");
await fuelRegression.evaluate(() => document.querySelector("camper-route-planner-card").calculate());
await fuelRegression.waitForFunction(() => globalThis.__crp.calculateCalls === 2);
assert.equal(await fuelRegression.evaluate(() => Object.hasOwn(globalThis.__crp.lastServiceData, "depart_at")), false, "unset depart_at is omitted from the service payload");
assert.equal(await fuelRegression.evaluate(() => Object.hasOwn(globalThis.__crp.lastServiceData, "arrive_at")), false, "unset arrive_at is omitted from the service payload");
await fuelRegression.evaluate(() => {
  const card = document.querySelector("camper-route-planner-card");
  card._state.provider = "nakordoni_motorhome_v3";
  card._state.result = { provider: "nakordoni_motorhome", distance_m: 2474700, duration_s: 101400, geometry: null, warnings: [], metadata: { api_version: "v3" } };
  card.render();
});
assert.match(await fuelRegression.locator(".status-line").textContent(), /Zoe|Test motorhome/);
assert.match(await fuelRegression.locator(".status-line").textContent(), /Nakordoni · API v3 \(Beta\)/, "v3 status uses the executed API version");
await fuelRegression.evaluate(() => {
  const card = document.querySelector("camper-route-planner-card");
  card._state.provider = "nakordoni_motorhome";
  card._state.result = { provider: "nakordoni_motorhome", distance_m: 2474700, duration_s: 101400, geometry: null, warnings: [], metadata: { api_version: "v2" } };
  card.render();
});
assert.match(await fuelRegression.locator(".status-line").textContent(), /Nakordoni · API v2/, "v2 status uses the executed API version");
assert.equal(await fuelRegression.evaluate(() => globalThis.__crp.calculateCalls), 2, "status changes do not call the routing service");
await fuelRegression.close();

const failedRecalculation = await preparePage({ width: 390, height: 844 }, "light", null, false, false, { failCalculation: true, savedRoute: { route_id: "stale", name: "Portugal", provider: "mock", distance_m: 2474700, duration_s: 95820, geometry: { points: [{ latitude: 49, longitude: 7 }, { latitude: 41, longitude: -8 }] }, profile_id: "test", origin: { latitude: 49, longitude: 7 }, destination: { latitude: 41, longitude: -8 }, waypoints: [], route_options: { depart_at: null, arrive_at: null }, warnings: [], metadata: {} } });
await failedRecalculation.evaluate(() => document.querySelector("camper-route-planner-card").loadRoute("stale"));
await failedRecalculation.waitForFunction(() => document.querySelector("camper-route-planner-card")?._state.result?.distance_m === 2474700);
await failedRecalculation.evaluate(() => document.querySelector("camper-route-planner-card").calculate());
await failedRecalculation.waitForFunction(() => document.querySelector("camper-route-planner-card")?._state.busy === false);
assert.equal(await failedRecalculation.evaluate(() => document.querySelector("camper-route-planner-card")._state.resultStale), true, "a failed recalculation marks the previous result stale");
assert.match(await failedRecalculation.locator(".result").textContent(), /2\.474|2,474/);
await failedRecalculation.close();

for (const width of [320, 375, 400, 600, 900]) {
  await desktop.evaluate((containerWidth) => { const card = document.querySelector("camper-route-planner-card"); card.style.width = `${containerWidth}px`; card.updateResponsiveClass(); }, width);
  await desktop.waitForTimeout(50);
  const layout = await desktop.locator(".content").evaluate((content) => ({
    contentWidth: content.clientWidth,
    columns: (() => { const panels = [...content.querySelectorAll(".grid > .panel")]; return panels.length > 1 && Math.abs(panels[0].getBoundingClientRect().top - panels[1].getBoundingClientRect().top) < 1 ? 2 : 1; })(),
    overflows: [...content.children].filter((child) => !child.classList.contains("map-section")).some((child) => child.scrollWidth > content.clientWidth + 1),
    mapClipped: getComputedStyle(content.querySelector(".crp-map")).overflowX === "hidden",
    inputWidths: [...content.querySelectorAll("input")].map((input) => input.getBoundingClientRect().width),
  }));
  assert.equal(layout.overflows, false, `${width}px card has no horizontal overflow`);
  assert.equal(layout.mapClipped, true, `${width}px map clips internal Leaflet panes`);
  assert.equal(layout.inputWidths.every((inputWidth) => inputWidth > 0 && inputWidth <= width), true, `${width}px card inputs fit the container`);
  assert.equal(layout.columns, width <= 600 ? 1 : 2, `${width}px card uses container-aware columns`);
}

await desktop.close();
await mobile.close();
await browser.close();
server.close();
console.log("browser e2e: PASS (Chromium; Leaflet lifecycle/markers/waypoints; desktop/mobile/tablet screenshots)");
