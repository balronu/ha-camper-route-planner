import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bundle = await readFile(new URL("../dist/camper-route-planner-card.js", import.meta.url), "utf8");
const html = "<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card></body></html>";
const resourceHtml = `<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card><script>window.customCards = [];</script><script type="module" src="/camper_route_planner/camper-route-planner-card.js?v=0.1.0-beta.16"></script></body></html>`;
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
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });

const resourcePage = await browser.newPage({ viewport: { width: 1024, height: 800 } });
const resourceResponse = await resourcePage.goto(`http://127.0.0.1:${port}/resource-test`);
assert.equal(resourceResponse.status(), 200, "HA-like resource page loads");
assert.equal(await resourcePage.evaluate(() => customElements.whenDefined("camper-route-planner-card").then(() => true)), true, "custom element is registered from the served module");
assert.equal(await resourcePage.locator("camper-route-planner-card").count(), 1, "card is instantiated from the resource URL");
const resourceBody = await resourcePage.evaluate((url) => fetch(url).then((response) => response.text()), `http://127.0.0.1:${port}/camper_route_planner/camper-route-planner-card.js?v=0.1.0-beta.16`);
assert.match(resourceBody, /Camper Route Planner Card v0\.1\.0-beta\.16/);
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

async function preparePage(viewport, colorScheme = "light", tileHandler = null, hasTouch = false) {
  const page = await browser.newPage({ viewport, colorScheme, hasTouch });
  let tileRequests = 0;
  page.on("request", (request) => { if (request.url().startsWith("https://tiles.test/")) tileRequests += 1; });
  page.tileRequestCount = () => tileRequests;
  await page.route("https://tiles.test/**", tileHandler || (async (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") })));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    const card = document.querySelector("camper-route-planner-card");
    card.setConfig({ type: "custom:camper-route-planner-card", entry_id: "test-entry" });
    let calculateCalls = 0;
    let reverseCalls = 0;
    card.hass = {
      language: "en",
      connection: {},
      callWS: async (message) => {
        if (message.type.endsWith("/list_profiles")) return { profiles: [{ profile_id: "test", name: "Test motorhome", height_m: 3.2, width_m: 2.34, length_m: 7.65, gross_weight_kg: 4800, vehicle_kind: "motorhome", fuel_type: "diesel" }] };
        if (message.type.endsWith("/list_routes")) return { routes: [] };
        if (message.type.endsWith("/map_config")) return { provider: "carto", status: "configured", tile_url: "https://tiles.test/{z}/{x}/{y}.png?key=browser-safe", tile_attribution: "Mock attribution", browser_safe: true };
        if (message.type.endsWith("/tracker_position")) return { available: true, point: { latitude: 47.3769, longitude: 8.5417, label: "tracker" } };
        if (message.type.endsWith("/geocode")) { await new Promise((resolve) => setTimeout(resolve, 20)); return { configured: true, results: [{ label: "Fixture address", latitude: 48.137, longitude: 11.575 }, { label: "Second fixture address", latitude: 48.138, longitude: 11.576 }] }; }
        if (message.type.endsWith("/reverse_geocode")) { reverseCalls += 1; return { configured: false, address: "" }; }
        if (message.type.endsWith("/export_gpx")) return { filename: "camper-route-2026-10-16.gpx", mime_type: "application/gpx+xml", content: '<?xml version="1.0"?><gpx version="1.1" />' };
        if (message.type === "call_service") {
          calculateCalls += 1;
          return { response: { provider: "mock", synthetic: true, distance_m: 1234, duration_s: 3600, warnings: [], geometry: { points: [{ latitude: 49, longitude: 7 }, { latitude: 50, longitude: 8 }] } } };
        }
        return {};
      }
    };
    globalThis.__crp = { card, get calculateCalls() { return calculateCalls; }, get reverseCalls() { return reverseCalls; } };
  });
  await page.locator(".panel").first().waitFor();
  return page;
}

async function calculate(page) {
  await page.locator('input[data-point="origin"][data-field="latitude"]').fill("49");
  await page.locator('input[data-point="origin"][data-field="longitude"]').fill("7");
  await page.locator('input[data-point="destination"][data-field="latitude"]').fill("50");
  await page.locator('input[data-point="destination"][data-field="longitude"]').fill("8");
  await page.getByRole("button", { name: "Calculate route" }).click();
  await page.locator(".metrics").waitFor();
}

const desktop = await preparePage({ width: 1280, height: 900 });
assert.equal(await desktop.locator(".metrics").count(), 0, "rendering must not calculate");
assert.equal(await desktop.evaluate(() => globalThis.__crp.calculateCalls), 0, "rendering must not call the route service");
await desktop.locator(".leaflet-container").waitFor();
assert.equal(await desktop.locator(".metrics").count(), 0, "a basemap is visible before route calculation");
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
assert.equal(await emptyTileFailure.locator(".metrics").count(), 0, "tile failure before route calculation does not calculate a route");
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
await destinationSearch.pressSequentially(longDestination);
await desktop.waitForTimeout(500);
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
assert.equal(desktop.tileRequestCount(), selectionTileRequests, "target selection does not issue new tile requests");
assert.equal(afterFirstSelection.hasFallback, false, "target selection does not activate the SVG fallback");
assert.equal(afterFirstSelection.markers, 2, "target selection leaves exactly one marker per point");
assert.equal(await desktop.evaluate(() => window.scrollY), destinationIdentity.scrollY, "target selection keeps the dashboard scroll position");
await destinationSearch.fill("Second fixture address");
await desktop.waitForTimeout(500);
await desktop.getByRole("button", { name: "Second fixture address", exact: true }).click();
assert.equal(await desktop.locator('input[data-point="destination"][data-field="latitude"]').inputValue(), "48.138", "repeated target selection updates latitude");
assert.equal(await desktop.evaluate(() => document.querySelector("camper-route-planner-card")._state.destination.address), "Second fixture address", "repeated target selection updates the address");
const afterSecondSelection = await desktop.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".crp-map");
  return { sameHost: host === window.__selectionMapHost, leafletId: host?._leaflet_id, tileCount: host?.querySelectorAll(".leaflet-tile").length || 0, markers: host?.querySelectorAll(".leaflet-marker-icon").length || 0 };
});
assert.equal(afterSecondSelection.sameHost, true, "repeated target selection keeps the existing map container");
assert.equal(afterSecondSelection.leafletId, selectionMapState.leafletId, "repeated target selection keeps one Leaflet instance");
assert.equal(afterSecondSelection.tileCount, selectionMapState.tileCount, "repeated target selection does not reload tiles");
assert.equal(desktop.tileRequestCount(), selectionTileRequests, "repeated target selection does not issue new tile requests");
assert.equal(afterSecondSelection.markers, 2, "repeated target selection does not duplicate markers");
await desktop.evaluate(() => document.querySelector("camper-route-planner-card").useTrackerLocation(true));
await desktop.waitForFunction(() => document.querySelector("camper-route-planner-card")._state.origin.latitude === 47.3769);
assert.equal(await desktop.locator('input[data-point="origin"][data-field="longitude"]').inputValue(), "8.5417", "tracker point fills origin coordinates");
await calculate(desktop);
await desktop.locator(".leaflet-container").waitFor();
await desktop.waitForFunction(() => globalThis.__crp.reverseCalls > 0);
await desktop.locator(".point-address").first().waitFor();
assert.ok(await desktop.evaluate(() => globalThis.__crp.reverseCalls > 0), "valid points use backend reverse geocoding");
assert.equal(await desktop.locator(".crp-map > svg").count(), 0, "successful tile mock uses Leaflet");
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
assert.equal(lifecycle.afterRender.oldHostMapPaneAfterRender, false, "rerender removes the old Leaflet DOM");
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
const download = await (async () => { const wait = desktop.waitForEvent("download"); await desktop.getByRole("button", { name: "GPX route" }).click(); return wait; })();
assert.equal(download.suggestedFilename(), "camper-route-2026-10-16.gpx", "export uses backend filename");
assert.equal(await desktop.evaluate(() => globalThis.__crp.calculateCalls), callsBeforeExport, "export does not recalculate");
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
await auto.locator(".panel").first().waitFor();
assert.equal(await auto.evaluate(() => globalThis.__autoCard._config.entry_id), "auto-entry", "single entry is auto-selected");
assert.equal(await auto.evaluate(() => window.customCards.filter((item) => item.type === "camper-route-planner-card").length), 1, "catalog registration is idempotent");
await auto.close();

for (const [label, handler] of [["403", async (route) => route.fulfill({ status: 403, body: "forbidden" })], ["429", async (route) => route.fulfill({ status: 429, body: "rate limited" })], ["timeout", async (route) => route.abort("timedout")]]) {
  const page = await preparePage({ width: 1280, height: 900 });
  await page.route("https://tiles.test/**", handler);
  await calculate(page);
  await page.locator(".crp-map > svg").waitFor({ timeout: 5000 });
  assert.equal(await page.locator(".leaflet-container").count(), 0, `${label} falls back to SVG`);
  await page.close();
}

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
await touchSelection.waitForTimeout(500);
await touchSelection.getByRole("button", { name: "Fixture address", exact: true }).tap();
assert.equal(await touchSelection.locator('input[data-point="destination"][data-field="latitude"]').inputValue(), "48.137", "touch selection fills destination latitude");
assert.equal(await touchSelection.evaluate(() => document.querySelector("camper-route-planner-card")._state.destination.address), "Fixture address", "touch selection keeps the address label");
assert.equal(await touchSelection.locator(".crp-map > svg").count(), 0, "touch selection keeps Leaflet instead of SVG fallback");
await touchSelection.close();

const tablet = await preparePage({ width: 768, height: 1024 }, "dark");
await tablet.route("https://tiles.test/**", async (route) => route.fulfill({ status: 429, body: "rate limited" }));
await calculate(tablet);
await tablet.locator(".crp-map > svg").waitFor({ timeout: 5000 });
assert.equal(await tablet.locator(".grid").evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length), 2, "tablet layout uses two columns");
assert.equal(await tablet.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches), true, "dark mode is available to the browser");
await tablet.close();

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
console.log("browser e2e: PASS (Chromium; success/403/429/timeout fallback; desktop/mobile screenshots)");
