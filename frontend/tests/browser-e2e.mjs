import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bundle = await readFile(new URL("../dist/camper-route-planner-card.js", import.meta.url), "utf8");
const html = "<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card></body></html>";
const resourceHtml = `<!doctype html><html><body><camper-route-planner-card></camper-route-planner-card><script type="module" src="/camper_route_planner/camper-route-planner-card.js?v=0.1.0-beta.7"></script></body></html>`;
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
const resourceBody = await resourcePage.evaluate((url) => fetch(url).then((response) => response.text()), `http://127.0.0.1:${port}/camper_route_planner/camper-route-planner-card.js?v=0.1.0-beta.7`);
assert.match(resourceBody, /Camper Route Planner Card v0\.1\.0-beta\.7/);
const editorResult = await resourcePage.evaluate(() => {
  const editor = customElements.get("camper-route-planner-card").getConfigElement();
  editor.setConfig({ type: "custom:camper-route-planner-card", entry_id: "" });
  document.body.append(editor);
  return { tag: editor.tagName.toLowerCase(), hasSelect: Boolean(editor.querySelector("select")) };
});
assert.deepEqual(editorResult, { tag: "camper-route-planner-card-editor", hasSelect: true }, "visual editor is created by the card contract");
await resourcePage.close();

async function preparePage(viewport, colorScheme = "light") {
  const page = await browser.newPage({ viewport, colorScheme });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    const card = document.querySelector("camper-route-planner-card");
    card.setConfig({ type: "custom:camper-route-planner-card", entry_id: "test-entry" });
    let calculateCalls = 0;
    card.hass = {
      language: "en",
      connection: {},
      callWS: async (message) => {
        if (message.type.endsWith("/list_profiles")) return { profiles: [{ profile_id: "test", name: "Test motorhome", height_m: 3.2, width_m: 2.34, length_m: 7.65, gross_weight_kg: 4800, vehicle_kind: "motorhome", fuel_type: "diesel" }] };
        if (message.type.endsWith("/list_routes")) return { routes: [] };
        if (message.type.endsWith("/map_config")) return { provider: "carto", status: "configured", tile_url: "https://tiles.test/{z}/{x}/{y}.png?key=browser-safe", tile_attribution: "Mock attribution", browser_safe: true };
        if (message.type.endsWith("/export_gpx")) return { filename: "camper-route-2026-10-16.gpx", mime_type: "application/gpx+xml", content: '<?xml version="1.0"?><gpx version="1.1" />' };
        if (message.type === "call_service") {
          calculateCalls += 1;
          return { response: { provider: "mock", synthetic: true, distance_m: 1234, duration_s: 3600, warnings: [], geometry: { points: [{ latitude: 49, longitude: 7 }, { latitude: 50, longitude: 8 }] } } };
        }
        return {};
      }
    };
    globalThis.__crp = { card, get calculateCalls() { return calculateCalls; } };
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
await desktop.route("https://tiles.test/**", async (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));
await calculate(desktop);
await desktop.locator(".leaflet-container").waitFor();
assert.equal(await desktop.locator(".crp-map > svg").count(), 0, "successful tile mock uses Leaflet");
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
assert.equal(await auto.evaluate(() => window.customCards.filter((item) => item.type === "custom:camper-route-planner-card").length), 1, "catalog registration is idempotent");
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
await calculate(mobile);
assert.equal(await mobile.locator(".grid").evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length), 1, "mobile layout uses one column");
await mobile.screenshot({ path: "../docs/phase2c-mobile.png", fullPage: true });

const tablet = await preparePage({ width: 768, height: 1024 }, "dark");
await tablet.route("https://tiles.test/**", async (route) => route.fulfill({ status: 429, body: "rate limited" }));
await calculate(tablet);
await tablet.locator(".crp-map > svg").waitFor({ timeout: 5000 });
assert.equal(await tablet.locator(".grid").evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length), 2, "tablet layout uses two columns");
assert.equal(await tablet.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches), true, "dark mode is available to the browser");
await tablet.close();

await desktop.close();
await mobile.close();
await browser.close();
server.close();
console.log("browser e2e: PASS (Chromium; success/403/429/timeout fallback; desktop/mobile screenshots)");
