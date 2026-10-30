import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bundle = await readFile(new URL("../dist/camper-route-planner-card.js", import.meta.url), "utf8");
const html = "<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card></body></html>";
const server = createServer((request, response) => {
  if (request.url === "/") { response.writeHead(200, { "content-type": "text/html" }); response.end(html); return; }
  response.writeHead(404); response.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/`);
await page.addScriptTag({ content: bundle });
await page.evaluate(() => {
  const card = document.querySelector("camper-route-planner-card");
  card.setConfig({ entry_id: "test-entry" });
  let calls = 0;
  let request = null;
  card.hass = { language: "en", connection: {}, user: { is_admin: true }, callWS: async (message) => {
    if (message.type.endsWith("/list_profiles")) return { provider: "mock", profiles: [{ profile_id: "test", name: "Test motorhome", height_m: 3.2, width_m: 2.3, length_m: 7.5, gross_weight_kg: 4000, vehicle_kind: "motorhome", fuel_type: "diesel", tank_capacity_l: 100, consumption_l_per_100km: 10 }] };
    if (message.type.endsWith("/list_routes")) return { routes: [] };
    if (message.type.endsWith("/map_config")) return { provider: "none", status: "not_configured" };
    if (message.type.endsWith("/load_route")) return { route: { route_id: "saved", name: "Portugal", provider: "mock", distance_m: 2474700, duration_s: 95820, geometry: { points: [{ latitude: 49.294307, longitude: 7.051867 }, { latitude: 41.3619, longitude: -8.6718 }] }, profile_id: "test", origin: { latitude: 49.294307, longitude: 7.051867, label: "Sulzbach/Saar" }, destination: { latitude: 41.3619, longitude: -8.6718, label: "Gondifelos" }, waypoints: [{ latitude: 38.878187, longitude: -6.970111, label: "Badajoz" }, { latitude: 41.313533, longitude: -8.722957, label: "Mindelo" }], route_options: {}, warnings: [], metadata: {} } };
    if (message.type.endsWith("/tracker_position")) { await new Promise((resolve) => { globalThis.__releaseTracker = resolve; }); return { available: true, point: { latitude: 47.3769, longitude: 8.5417, label: "tracker" } }; }
    if (message.type.endsWith("/geocode")) return { configured: true, results: [{ label: "Badajoz", latitude: 38.878187, longitude: -6.970111 }] };
    if (message.type.endsWith("/reverse_geocode")) return { configured: false, address: "" };
    if (message.type === "call_service") { calls += 1; request = message.service_data; return { response: { provider: "mock", synthetic: true, distance_m: 1234, duration_s: 3600, geometry: { points: [{ latitude: 49, longitude: 7 }, { latitude: 50, longitude: 8 }] }, warnings: [] } }; }
    return {};
  } };
  globalThis.__crp = { card, get calls() { return calls; }, get request() { return request; } };
});
await page.locator("details.route-planner-shell").waitFor();
await page.locator("summary.route-planner-summary").click();
await page.locator(".stations-panel").waitFor();

await page.evaluate(() => globalThis.__crp.card.loadRoute("saved"));
await page.waitForFunction(() => globalThis.__crp.card._state.result?.distance_m === 2474700);
await page.evaluate(() => globalThis.__releaseTracker?.());
await page.waitForTimeout(50);
assert.equal(await page.evaluate(() => globalThis.__crp.card._state.origin.address), "Sulzbach/Saar", "a late tracker response cannot overwrite the origin of a loaded saved route");
assert.deepEqual(await page.evaluate(() => globalThis.__crp.card._state.stations.map((station) => [station.address, station.latitude, station.longitude])), [
  ["Sulzbach/Saar", 49.294307, 7.051867],
  ["Badajoz", 38.878187, -6.970111],
  ["Mindelo", 41.313533, -8.722957],
  ["Gondifelos", 41.3619, -8.6718],
], "loading a saved route restores stations in the same order as its route result");
assert.equal(await page.locator(".crp-map svg").count(), 1, "a loaded current route is drawn on the dashboard map");

const seed = [
  { latitude: 49.294307, longitude: 7.051867, address: "Sulzbach/Saar" },
  { latitude: 38.878187, longitude: -6.970111, address: "Badajoz" },
  { latitude: 38.722252, longitude: -9.139337, address: "Lissabon" },
  { latitude: 41.313533, longitude: -8.722957, address: "Mindelo" },
  { latitude: 41.3619, longitude: -8.6718, address: "Gondifelos" },
];
await page.waitForTimeout(50);
await page.evaluate((points) => { const card = globalThis.__crp.card; card.setStations(points); card.render(); }, seed);
assert.equal(await page.locator(".station-row").count(), 5, "all route stations render in one ordered list");
assert.deepEqual(await page.locator(".station-role").allTextContents(), ["Start", "Waypoint", "Waypoint", "Waypoint", "Destination"]);
const ids = await page.evaluate(() => globalThis.__crp.card._state.stations.map((station) => station.id));
assert.equal(new Set(ids).size, 5, "stations have stable unique ids");

await page.locator('button[data-action="edit-station"][data-index="2"]').click();
const original = await page.evaluate(() => ({ ...globalThis.__crp.card._state.stations[2] }));
await page.locator('input[data-edit-field="latitude"]').fill("40");
await page.locator('input[data-edit-field="longitude"]').fill("-8");
await page.locator('button[data-action="cancel-edit"]').click();
assert.deepEqual(await page.evaluate(() => globalThis.__crp.card._state.stations[2]), original, "cancel keeps the original station");

await page.locator('button[data-action="edit-station"][data-index="2"]').click();
await page.locator('input[data-search-input="station"]').fill("Badajoz");
await page.locator('button[data-action="search"][data-target="station"]').click();
await page.locator('.station-editor [data-search-results] button').waitFor();
await page.locator('.station-editor [data-search-results] button').click();
await page.locator('button[data-action="apply-edit"]').click();
assert.equal(await page.evaluate(() => globalThis.__crp.card._state.stations[2].address), "Badajoz", "address search updates the edited station only after confirmation");

await page.locator('button[data-action="up-station"][data-index="1"]').click();
assert.deepEqual(await page.evaluate(() => globalThis.__crp.card._state.stations.map((station) => station.address)), ["Badajoz", "Sulzbach/Saar", "Badajoz", "Mindelo", "Gondifelos"], "moving preserves station metadata and recalculates roles");
await page.locator('button[data-action="down-station"][data-index="3"]').click();
assert.deepEqual(await page.evaluate(() => globalThis.__crp.card._state.stations.map((station) => station.address)), ["Badajoz", "Sulzbach/Saar", "Badajoz", "Gondifelos", "Mindelo"], "repeated moves remain ordered");

await page.locator('button[data-action="add-station"]').click();
assert.equal(await page.locator(".station-row").count(), 6, "new station is inserted before the destination");
assert.equal(await page.locator('button[data-action="cancel-edit"]').count(), 1, "new station opens directly in edit mode");
await page.locator('input[data-edit-field="latitude"]').fill("41");
await page.locator('input[data-edit-field="longitude"]').fill("-8.5");
await page.locator('button[data-action="apply-edit"]').click();
await page.locator('button[data-action="remove-station"][data-index="4"]').click();
assert.equal(await page.locator(".station-row").count(), 5, "intermediate station can be removed");
assert.equal(await page.locator('button[data-action="remove-station"][data-index="0"]').count(), 0, "start cannot be removed");

await page.evaluate(() => { const card = globalThis.__crp.card; card._state.stations.forEach((station, index) => { station.latitude = [49.294307, 38.722252, 38.878187, 41.3619, 41.313533][index]; station.longitude = [7.051867, -9.139337, -6.970111, -8.6718, -8.722957][index]; }); card.syncLegacyPoints(); return card.calculate(); });
await page.locator(".result .metrics").first().waitFor();
assert.equal(await page.evaluate(() => globalThis.__crp.calls), 1, "calculation remains explicit");
const request = await page.evaluate(() => globalThis.__crp.request);
assert.deepEqual(request.via.map((point) => point.address), ["Sulzbach/Saar", "Badajoz", "Gondifelos"], "API via order follows the station order");
assert.equal(request.origin.address, "Badajoz");
assert.equal(request.destination.address, "Mindelo");

const loadedPath = await page.locator(".crp-map svg path").getAttribute("d");
await page.evaluate(() => { const card = globalThis.__crp.card; const destination = card._state.stations.at(-1); destination.latitude = 40; destination.longitude = -7; card.syncLegacyPoints(); card._state.resultStale = true; card.render(); });
assert.notEqual(await page.locator(".crp-map svg path").getAttribute("d"), loadedPath, "a changed station state removes the old route geometry from the dashboard map");
await page.evaluate(() => globalThis.__crp.card.setConfig({ entry_id: "new-empty-entry" }));
assert.equal(await page.evaluate(() => globalThis.__crp.card._state.result), null, "a new route entry starts without the previous result");

await page.close();
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log("stations e2e: PASS (ordered list, stable ids, edit transactions, role movement, add/remove, API mapping)");
