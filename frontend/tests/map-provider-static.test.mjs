import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("map implementation keeps Leaflet, CARTO and SVG fallback in the bundle sources", async () => {
  const source = await readFile(new URL("../src/map-view.js", import.meta.url), "utf8");
  assert.match(source, /from "leaflet"/);
  assert.match(source, /tile_url/);
  assert.match(source, /renderGeometryMap/);
  assert.match(source, /map\.setView\(\[51, 10\], 5\)/);
  assert.doesNotMatch(source, /points\.length >= 1/);
  assert.match(source, /ResizeObserver/);
});

test("card requests map configuration over HA WebSocket, never directly from browser HTTP", async () => {
  const source = await readFile(new URL("../src/camper-route-planner-card.js", import.meta.url), "utf8");
  assert.match(source, /camper_route_planner\/map_config/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|basemaps\.cartocdn/);
});
