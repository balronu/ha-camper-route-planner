import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bundle = await readFile(new URL("../dist/camper-route-planner-card.js", import.meta.url), "utf8");
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const pois = {
  requested: ["parking", "fuel"],
  parking: [{ id: "p1", category: "parking", name: "Aire de repos", latitude: 49.5, longitude: 7.5, km_from_start: 25, country: "DE" }],
  fuel: [{ id: "f1", category: "fuel", name: "Diesel Station", latitude: 50.5, longitude: 8.5, km_from_start: 145, brand: "Fixture Fuel", country: "DE", prices: [{ fuel_type: "diesel", price: 1.79, currency: "EUR" }] }],
};
const route = { provider: "mock", distance_m: 2474700, duration_s: 95820, warnings: [], geometry: { points: [{ latitude: 49, longitude: 7 }, { latitude: 52, longitude: 10 }, { latitude: 55, longitude: 14 }] }, metadata: { pois } };
const server = createServer((request, response) => {
  if (request.url === "/") { response.writeHead(200, { "content-type": "text/html" }); response.end("<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card></body></html>"); return; }
  if (request.url.startsWith("/tiles/")) { response.writeHead(200, { "content-type": "image/png" }); response.end(pixel); return; }
  response.writeHead(404); response.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), headless: true, args: ["--no-sandbox"] });
for (const viewport of [{ width: 1280, height: 900, label: "Windows/Chromium" }, { width: 390, height: 844, isMobile: true, hasTouch: true, label: "mobile" }, { width: 768, height: 900, isMobile: true, hasTouch: true, label: "tablet" }]) {
  const page = await browser.newPage({ ...viewport, colorScheme: "light" });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.route(`http://127.0.0.1:${port}/tiles/**`, (request) => request.fulfill({ status: 200, contentType: "image/png", body: pixel }));
  await page.addScriptTag({ content: bundle });
  await page.evaluate((tileUrl) => {
    const card = document.querySelector("camper-route-planner-card");
    card.setConfig({ entry_id: "test-entry" });
    let calls = 0;
    let lastRequest;
    card.hass = { language: "en", connection: {}, user: { is_admin: true }, callWS: async (message) => {
      if (message.type.endsWith("/list_profiles")) return { provider: "mock", profiles: [{ profile_id: "test", name: "Test motorhome", height_m: 3, width_m: 2, length_m: 7, gross_weight_kg: 3500, vehicle_kind: "motorhome", fuel_type: "diesel" }] };
      if (message.type.endsWith("/list_routes")) return { routes: [] };
      if (message.type.endsWith("/map_config")) return { provider: "carto", status: "configured", tile_url: tileUrl, tile_attribution: "Fixture" };
      if (message.type === "call_service") {
        calls += 1;
        lastRequest = message.service_data;
        const includePois = Boolean(message.service_data.poi_parking || message.service_data.poi_fuel);
        return { response: { ...globalThis.__poiRoute, metadata: includePois ? globalThis.__poiRoute.metadata : {}, route_options: includePois ? { poi_parking: Boolean(message.service_data.poi_parking), poi_fuel: Boolean(message.service_data.poi_fuel), poi_fuel_type: "diesel" } : {} } };
      }
      return {};
    } };
    globalThis.__poiCard = card;
    globalThis.__poiState = { get calls() { return calls; }, get request() { return lastRequest; } };
  }, `http://127.0.0.1:${port}/tiles/{z}/{x}/{y}.png`);
  await page.evaluate((value) => { globalThis.__poiRoute = value; }, route);
  await page.locator("details.route-planner-shell").waitFor();
  await page.locator("summary.route-planner-summary").click();
  await page.waitForFunction(() => document.querySelector("camper-route-planner-card")?._state?.profileId === "test");
  assert.equal(await page.locator('input[data-route-option="poi_parking"]').isChecked(), false, `parking disabled by default on ${viewport.label}`);
  assert.equal(await page.locator('input[data-route-option="poi_fuel"]').isChecked(), false, `fuel disabled by default on ${viewport.label}`);
  await page.evaluate(() => {
    const card = globalThis.__poiCard;
    card.setStations([{ latitude: 49, longitude: 7, address: "Start" }, { latitude: 55, longitude: 14, address: "Destination" }]);
    card.render();
  });
  await page.evaluate(() => globalThis.__poiCard.calculate());
  await page.locator(".crp-route-line").waitFor();
  assert.deepEqual(await page.evaluate(() => ({ calls: globalThis.__poiState.calls, parking: globalThis.__poiState.request.poi_parking, fuel: globalThis.__poiState.request.poi_fuel })), { calls: 1, parking: undefined, fuel: undefined }, `route calculation without POIs omits disabled POI fields on ${viewport.label}`);
  await page.evaluate(() => { globalThis.__poiMapBefore = document.querySelector("camper-route-planner-card").shadowRoot.querySelector(".map-section .crp-map"); });
  await page.locator('input[data-route-option="poi_parking"]').check();
  assert.deepEqual(await page.evaluate(() => ({ sameMap: document.querySelector("camper-route-planner-card").shadowRoot.querySelector(".map-section .crp-map") === globalThis.__poiMapBefore, routeVisible: Boolean(document.querySelector("camper-route-planner-card").shadowRoot.querySelector(".crp-route-line")), stale: document.querySelector("camper-route-planner-card")._state.resultStale })), { sameMap: true, routeVisible: true, stale: false }, `POI toggle preserves the existing map and route on ${viewport.label}`);
  await page.evaluate(() => globalThis.__poiCard.calculate());
  await page.locator(".route-pois").waitFor();
  assert.deepEqual(await page.evaluate(() => ({ calls: globalThis.__poiState.calls, parking: globalThis.__poiState.request.poi_parking, fuel: globalThis.__poiState.request.poi_fuel })), { calls: 2, parking: true, fuel: undefined }, `parking-only request is accepted on ${viewport.label}`);
  await page.locator('input[data-route-option="poi_fuel"]').check();
  await page.evaluate(() => globalThis.__poiCard.calculate());
  await page.locator(".map-section .crp-marker-poi").first().waitFor();
  await page.locator(".route-pois").waitFor();
  await page.locator(".map-section .crp-marker-poi").first().waitFor();
  assert.deepEqual(await page.evaluate(() => ({ calls: globalThis.__poiState.calls, parking: globalThis.__poiState.request.poi_parking, fuel: globalThis.__poiState.request.poi_fuel, fuelType: globalThis.__poiState.request.poi_fuel_type })), { calls: 3, parking: true, fuel: true, fuelType: "diesel" }, `both POI categories are sent with the deliberate route request on ${viewport.label}`);
  assert.equal(await page.locator(".route-poi").count(), 2, `POI list is rendered on ${viewport.label}`);
  assert.equal(await page.locator(".map-section .crp-marker-poi").count(), 2, `normal map renders both POI categories on ${viewport.label}`);
  const callsBeforeDisplay = await page.evaluate(() => globalThis.__poiState.calls);
  await page.locator('input[data-poi-display="parking"]').uncheck();
  assert.deepEqual(await page.evaluate(() => ({ calls: globalThis.__poiState.calls, list: [...document.querySelector("camper-route-planner-card").shadowRoot.querySelectorAll(".route-poi")].map((item) => item.className), markers: document.querySelector("camper-route-planner-card").shadowRoot.querySelectorAll(".crp-marker-poi").length })), { calls: callsBeforeDisplay, list: ["route-poi route-poi-fuel"], markers: 1 }, `local parking display filter does not request or move the route on ${viewport.label}`);
  await page.locator('select[data-poi-display="interval"]').selectOption("500");
  assert.equal(await page.evaluate(() => globalThis.__poiState.calls), callsBeforeDisplay, `local interval filter does not request routing on ${viewport.label}`);
  await page.locator('select[data-poi-display="interval"]').selectOption("all");
  await page.locator('input[data-poi-display="parking"]').check();
  await page.locator('button[data-action="open-map-popup"]').click();
  await page.locator(".map-popup").waitFor();
  await page.waitForTimeout(120);
  assert.equal(await page.locator(".map-popup .crp-marker-poi").count(), 2, `popup reuses the current POIs on ${viewport.label}`);
  assert.equal(await page.evaluate(() => globalThis.__poiState.calls), 3, `popup opening does not request routing on ${viewport.label}`);
  await page.locator(".map-popup-close").click();
  await page.locator('input[data-route-option="poi_parking"]').uncheck();
  await page.evaluate(() => globalThis.__poiCard.calculate());
  assert.deepEqual(await page.evaluate(() => ({ calls: globalThis.__poiState.calls, parking: globalThis.__poiState.request.poi_parking, fuel: globalThis.__poiState.request.poi_fuel })), { calls: 4, parking: undefined, fuel: true }, `fuel-only request omits disabled parking on ${viewport.label}`);
  await page.evaluate(() => { const card = globalThis.__poiCard; card.updatePoint("origin", 0, "latitude", 49.1); card.render(); });
  assert.equal(await page.locator(".route-pois").count(), 0, `stale route hides POI list after station change on ${viewport.label}`);
  assert.equal(await page.locator(".map-section .crp-marker-poi").count(), 0, `stale route removes POI markers after station change on ${viewport.label}`);
  await page.close();
}
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log("POI e2e: PASS (opt-in request, normalized list, normal/popup markers, stale clearing, Windows/mobile/tablet)");
