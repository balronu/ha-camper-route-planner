import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bundle = await readFile(new URL("../dist/camper-route-planner-card.js", import.meta.url), "utf8");
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const server = createServer((request, response) => {
  if (request.url === "/") { response.writeHead(200, { "content-type": "text/html" }); response.end("<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card></body></html>"); return; }
  if (request.url.startsWith("/tiles/")) { response.writeHead(200, { "content-type": "image/png" }); response.end(pixel); return; }
  response.writeHead(404); response.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" });
await page.goto(`http://127.0.0.1:${port}/`);
await page.route(`http://127.0.0.1:${port}/tiles/**`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: pixel }));
await page.addScriptTag({ content: bundle });
await page.evaluate((tileUrl) => {
  const card = document.querySelector("camper-route-planner-card");
  card.setConfig({ entry_id: "test-entry" });
  let calls = 0;
  card.hass = { language: "en", connection: {}, user: { is_admin: true }, callWS: async (message) => {
    if (message.type.endsWith("/list_profiles")) return { provider: "mock", profiles: [{ profile_id: "test", name: "Test motorhome", height_m: 3, width_m: 2, length_m: 7, gross_weight_kg: 3500, vehicle_kind: "motorhome", fuel_type: "diesel", tank_capacity_l: 100, consumption_l_per_100km: 10 }] };
    if (message.type.endsWith("/list_routes")) return { routes: [] };
    if (message.type.endsWith("/map_config")) return { provider: "carto", status: "configured", tile_url: tileUrl, tile_attribution: "Fixture" };
    if (message.type === "call_service") { calls += 1; return { response: { provider: "mock", synthetic: true, distance_m: 1000, duration_s: 3600, warnings: [], geometry: { points: [{ latitude: 49, longitude: 7 }, { latitude: 52, longitude: 10 }, { latitude: 55, longitude: 14 }] } } }; }
    return {};
  } };
  globalThis.__crpPopup = { card, get calls() { return calls; } };
}, `http://127.0.0.1:${port}/tiles/{z}/{x}/{y}.png`);
await page.locator("details.route-planner-shell").waitFor();
await page.locator("summary.route-planner-summary").click();
await page.locator(".stations-panel").waitFor();
await page.waitForFunction(() => {
  const state = document.querySelector("camper-route-planner-card")?._state;
  return state?.mapConfig?.provider === "carto" && Boolean(state.profileId);
}, null, { timeout: 5000 });
await page.evaluate(() => {
  const card = globalThis.__crpPopup.card;
  card.setStations([{ latitude: 49, longitude: 7, address: "Start" }, { latitude: 50, longitude: 8, address: "Destination" }]);
  card.render();
  return card.calculate();
});
await page.locator(".result > .metrics").waitFor();
assert.equal(await page.evaluate(() => globalThis.__crpPopup.calls), 1, "calculation makes one provider request");
await page.waitForTimeout(150);
const mainMapState = await page.evaluate(() => {
  const host = document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelector(".map-section > .crp-map");
  const symbol = Object.getOwnPropertySymbols(host || {}).find((item) => String(item).includes("leaflet-map"));
  const map = symbol ? host[symbol] : null;
  return { mapCount: document.querySelector("camper-route-planner-card")?.shadowRoot?.querySelectorAll(".map-section > .leaflet-container").length || 0, containsRouteEnd: Boolean(map?.getBounds().contains([55, 14])) };
});
assert.deepEqual(mainMapState, { mapCount: 1, containsRouteEnd: true }, "successful calculation fits the complete route geometry");

const opener = page.locator('button[data-action="open-map-popup"]');
await opener.focus();
await opener.press("Enter");
await page.locator(".map-popup").waitFor();
await page.waitForTimeout(50);
assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden", "popup locks background scrolling");
assert.equal(await page.locator(".map-popup .leaflet-container").count(), 1, "popup owns a separate Leaflet container");
assert.equal(await page.locator(".map-section .leaflet-container").count(), 1, "main map remains mounted separately");
assert.equal(await page.evaluate(() => globalThis.__crpPopup.calls), 1, "opening popup makes no provider request");
assert.equal(await page.locator(".map-popup-close").evaluate((node) => node === node.getRootNode().activeElement), true, "popup focuses its close control");
await page.locator(".map-popup-close").press("Escape");
await page.waitForTimeout(20);
assert.equal(await page.locator(".map-popup").count(), 0, "Escape closes the popup");
assert.equal(await page.evaluate(() => document.body.style.overflow), "", "closing restores body overflow");
assert.equal(await page.locator('button[data-action="open-map-popup"]').evaluate((node) => node === node.getRootNode().activeElement), true, "focus returns to the opener");

await page.locator('button[data-action="open-map-popup"]').click();
await page.locator(".map-popup").waitFor();
await page.locator('button[data-action="fit-map-popup"]').click();
assert.equal(await page.evaluate(() => globalThis.__crpPopup.calls), 1, "fit action makes no provider request");
await page.locator('button[data-action="close-map-popup"]').click();
assert.equal(await page.locator(".map-popup").count(), 0, "close button removes the popup");

await page.close();
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log("map popup e2e: PASS (route fit, independent Leaflet instance, modal focus, Escape, scroll lock, no extra API request)");
