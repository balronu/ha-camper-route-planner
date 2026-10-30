import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bundle = await readFile(new URL("../dist/camper-route-planner-card.js", import.meta.url), "utf8");
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const route = { route_id: "portugal", name: "Portugal", provider: "mock", distance_m: 2474700, duration_s: 95820, geometry: { points: [{ latitude: 49.294307, longitude: 7.051867 }, { latitude: 38.878187, longitude: -6.970111 }, { latitude: 38.722252, longitude: -9.139337 }, { latitude: 41.313533, longitude: -8.722957 }, { latitude: 41.3619, longitude: -8.6718 }] }, profile_id: "test", origin: { latitude: 49.294307, longitude: 7.051867, label: "Sulzbach/Saar" }, destination: { latitude: 41.3619, longitude: -8.6718, label: "Gondifelos" }, waypoints: [{ latitude: 38.878187, longitude: -6.970111, label: "Badajoz" }, { latitude: 38.722252, longitude: -9.139337, label: "Lissabon" }, { latitude: 41.313533, longitude: -8.722957, label: "Mindelo" }], route_options: {}, warnings: [], metadata: { pois: { requested: ["parking"], parking: [{ id: "saved-p1", category: "parking", name: "Saved parking", latitude: 40, longitude: -8, km_from_start: 210 }], fuel: [] } } };
const otherRoute = { ...route, route_id: "other", geometry: { points: [{ latitude: 52, longitude: 13 }, { latitude: 48, longitude: 11 }, { latitude: 46, longitude: 8 }] }, origin: { latitude: 52, longitude: 13, label: "Berlin" }, destination: { latitude: 46, longitude: 8, label: "Alps" }, waypoints: [], metadata: {} };
const legacyPoiRoute = { ...otherRoute, route_id: "legacy-pois", metadata: { pois: { parking: [{ id: "legacy-p", category: "parking", latitude: 48, longitude: 11, km_from_start: 100 }], fuel: [] } } };
const server = createServer((request, response) => {
  if (request.url === "/") { response.writeHead(200, { "content-type": "text/html" }); response.end("<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card></body></html>"); return; }
  if (request.url.startsWith("/tiles/")) { response.writeHead(200, { "content-type": "image/png" }); response.end(pixel); return; }
  response.writeHead(404); response.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), headless: true, args: ["--no-sandbox"] });
const contexts = [
  { width: 1280, height: 900, isMobile: false, label: "Windows/Chromium" },
  { width: 390, height: 844, isMobile: true, label: "mobile" },
  { width: 768, height: 900, isMobile: true, label: "tablet" },
];
for (const viewport of contexts) {
  const page = await browser.newPage({ viewport, colorScheme: "light" });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.route(`http://127.0.0.1:${port}/tiles/**`, (request) => request.fulfill({ status: 200, contentType: "image/png", body: pixel }));
  await page.addScriptTag({ content: bundle });
  await page.evaluate((tileUrl) => {
    const card = document.querySelector("camper-route-planner-card");
    card.setConfig({ entry_id: "test-entry" });
    card.hass = { language: "en", connection: {}, user: { is_admin: true }, callWS: async (message) => {
      if (message.type.endsWith("/list_profiles")) return { provider: "mock", profiles: [{ profile_id: "test", name: "Test motorhome", height_m: 3, width_m: 2, length_m: 7, gross_weight_kg: 3500, vehicle_kind: "motorhome", fuel_type: "diesel" }] };
      if (message.type.endsWith("/list_routes")) return { routes: [] };
      if (message.type.endsWith("/map_config")) return { provider: "carto", status: "configured", tile_url: tileUrl, tile_attribution: "Fixture" };
      if (message.type.endsWith("/load_route")) return { route: message.route_id === "other" ? globalThis.__otherRoute : message.route_id === "legacy-pois" ? globalThis.__legacyPoiRoute : globalThis.__savedRoute };
      return {};
    }};
    globalThis.__crpRoute = card;
  }, `http://127.0.0.1:${port}/tiles/{z}/{x}/{y}.png`);
  await page.evaluate(([saved, alternate, legacy]) => { globalThis.__savedRoute = saved; globalThis.__otherRoute = alternate; globalThis.__legacyPoiRoute = legacy; }, [route, otherRoute, legacyPoiRoute]);
  await page.locator("details.route-planner-shell").waitFor();
  await page.locator("summary.route-planner-summary").click();
  await page.evaluate(() => globalThis.__crpRoute.loadRoute("portugal"));
  await page.waitForTimeout(180);
  await page.waitForTimeout(180);
  const visible = await page.evaluate(() => {
    const root = document.querySelector("camper-route-planner-card")?.shadowRoot;
    const host = root?.querySelector(".map-section .map-host > .crp-map, .map-section > .crp-map");
    const symbol = Object.getOwnPropertySymbols(host || {}).find((item) => String(item).includes("leaflet-map"));
    const map = symbol ? host[symbol] : null;
    const line = host?.querySelector(".crp-route-line");
    const hostRect = host?.getBoundingClientRect();
    const lineRect = line?.getBoundingClientRect();
    return { routeInBounds: Boolean(map?.getBounds().contains([41.3619, -8.6718]) && map.getBounds().contains([49.294307, 7.051867])), lineVisible: Boolean(lineRect?.width > 0 && lineRect?.height > 0), lineWithinMap: Boolean(lineRect && hostRect && lineRect.left >= hostRect.left - 2 && lineRect.right <= hostRect.right + 2 && lineRect.top >= hostRect.top - 2 && lineRect.bottom <= hostRect.bottom + 2) };
  });
  assert.deepEqual(visible, { routeInBounds: true, lineVisible: true, lineWithinMap: true }, `saved route is actually visible after loading on ${viewport.label}`);
  assert.equal(await page.locator(".route-pois .route-poi").count(), 1, `saved route POIs load without a provider request on ${viewport.label}`);
  const beforePan = await page.evaluate(() => { const host = document.querySelector("camper-route-planner-card").shadowRoot.querySelector(".map-section .map-host > .crp-map, .map-section > .crp-map"); const symbol = Object.getOwnPropertySymbols(host).find((item) => String(item).includes("leaflet-map")); return host[symbol].getCenter(); });
  await page.evaluate(() => { const host = document.querySelector("camper-route-planner-card").shadowRoot.querySelector(".map-section .map-host > .crp-map, .map-section > .crp-map"); const symbol = Object.getOwnPropertySymbols(host).find((item) => String(item).includes("leaflet-map")); host[symbol].panBy([100, 0], { animate: false }); });
  await page.waitForTimeout(80);
  const afterPan = await page.evaluate(() => { const host = document.querySelector("camper-route-planner-card").shadowRoot.querySelector(".map-section .map-host > .crp-map, .map-section > .crp-map"); const symbol = Object.getOwnPropertySymbols(host).find((item) => String(item).includes("leaflet-map")); return host[symbol].getCenter(); });
  assert.notDeepEqual(afterPan, beforePan, `manual map movement is not immediately overridden on ${viewport.label}`);
  await page.evaluate(() => globalThis.__crpRoute.loadRoute("other"));
  await page.waitForFunction(() => globalThis.__crpRoute._state.origin?.latitude === 52);
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => { const host = document.querySelector("camper-route-planner-card").shadowRoot.querySelector(".map-section .map-host > .crp-map, .map-section > .crp-map"); const symbol = Object.getOwnPropertySymbols(host).find((item) => String(item).includes("leaflet-map")); const map = host[symbol]; return map.getBounds().contains([52, 13]) && map.getBounds().contains([46, 8]); }), true, `switching saved routes refits the complete new geometry on ${viewport.label}`);
  assert.equal(await page.locator(".route-pois").count(), 0, `switching saved routes removes POIs belonging to the previous result on ${viewport.label}`);
  await page.evaluate(() => globalThis.__crpRoute.loadRoute("legacy-pois"));
  await page.waitForFunction(() => globalThis.__crpRoute._state.origin?.latitude === 52);
  await page.waitForTimeout(120);
  assert.equal(await page.locator(".route-pois").count(), 0, `historical POIs without request metadata stay hidden on ${viewport.label}`);
  await page.close();
}
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log("map route load e2e: PASS (saved-route fit, geometry visibility, route switching, manual pan, Windows/mobile/tablet)");
