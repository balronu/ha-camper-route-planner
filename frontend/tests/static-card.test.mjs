import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/camper-route-planner-card.js", import.meta.url), "utf8");
const services = await readFile(new URL("../src/services.js", import.meta.url), "utf8");

test("card exposes HA registration and editor API", () => {
  assert.match(source, /customElements\.define\("camper-route-planner-card"/);
  assert.match(source, /static getConfigElement\(\)/);
  assert.match(source, /static getStubConfig\(\)/);
  assert.match(source, /custom:camper-route-planner-card/);
  assert.match(source, /config-changed/);
});

test("frontend has no provider secret or direct Nakordoni endpoint", () => {
  assert.match(source, /nakordoni\.eu/);
  assert.doesNotMatch(source, /api\.nakordoni\.dev|Bearer|api[_-]?key|secret/i);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket\(/);
});

test("route calculation appears only behind an explicit action handler", () => {
  assert.match(source, /async calculate\(\)/);
  assert.match(source, /data-action="calculate"/);
  assert.doesNotMatch(source, /connectedCallback\(\)[\s\S]{0,500}calculate\(/);
});

test("GPX export is explicit, backend-mediated and supports mobile share fallback", () => {
  assert.match(services, /camper_route_planner\/export_gpx/);
  assert.match(source, /data-mode="route"/);
  assert.match(source, /deliverGpxExport/);
  assert.match(services, /navigator\.share/);
  assert.doesNotMatch(source, /exportRoute\(.*connectedCallback/);
});
