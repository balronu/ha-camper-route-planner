import L from "leaflet";

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

export function renderGeometryMap(container, route, labels) {
  container.replaceChildren();
  container.className = "crp-map";
  const points = route?.geometry?.points || [];
  if (points.length < 2) {
    const empty = document.createElement("p");
    empty.textContent = labels.noRoute;
    container.append(empty);
    return;
  }
  const bounds = points.reduce((acc, point) => ({ minLat: Math.min(acc.minLat, Number(point.latitude)), maxLat: Math.max(acc.maxLat, Number(point.latitude)), minLon: Math.min(acc.minLon, Number(point.longitude)), maxLon: Math.max(acc.maxLon, Number(point.longitude)) }), { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity });
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.001);
  const project = (point) => [40 + ((Number(point.longitude) - bounds.minLon) / lonSpan) * 720, 300 - ((Number(point.latitude) - bounds.minLat) / latSpan) * 260];
  const svg = svgElement("svg", { viewBox: "0 0 800 340", role: "img", "aria-label": labels.geometryFallback });
  const background = svgElement("rect", { x: 0, y: 0, width: 800, height: 340, rx: 12, fill: "var(--ha-card-background, #f7f7f7)" });
  svg.append(background);
  const projected = points.map(project);
  const path = svgElement("path", { d: `M ${projected.map(([x, y]) => `${x} ${y}`).join(" L ")}`, fill: "none", stroke: "var(--primary-color, #03a9f4)", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round" });
  svg.append(path);
  projected.forEach(([x, y], index) => {
    const marker = svgElement("circle", { cx: x, cy: y, r: index === 0 || index === projected.length - 1 ? 11 : 8, fill: index === 0 ? "#43a047" : index === projected.length - 1 ? "#e53935" : "#fb8c00", stroke: "white", "stroke-width": 3 });
    marker.setAttribute("aria-label", index === 0 ? labels.start : index === projected.length - 1 ? labels.destination : `${labels.waypoint} ${index}`);
    svg.append(marker);
  });
  container.append(svg);
  const caption = document.createElement("small");
  caption.textContent = labels.geometryFallback;
  container.append(caption);
  let scale = 1;
  let origin = null;
  svg.addEventListener("wheel", (event) => { event.preventDefault(); scale = Math.min(3, Math.max(0.8, scale + (event.deltaY < 0 ? 0.1 : -0.1))); svg.style.transform = `scale(${scale})`; });
  svg.addEventListener("pointerdown", (event) => { origin = [event.clientX, event.clientY]; svg.setPointerCapture?.(event.pointerId); });
  svg.addEventListener("pointerup", () => { origin = null; });
  svg.addEventListener("pointermove", (event) => { if (origin) { svg.style.translate = `${event.clientX - origin[0]}px ${event.clientY - origin[1]}px`; } });
}

export function destroyMap(container) {
  if (container?._leafletMap) {
    container._leafletMap.remove();
    container._leafletMap = null;
  }
}

export function renderMap(container, route, mapConfig, labels, onTileError = () => {}) {
  destroyMap(container);
  const points = route?.geometry?.points || [];
  if (mapConfig?.provider === "carto" && mapConfig.status === "configured" && mapConfig.tile_url && points.length >= 2) {
    container.replaceChildren();
    container.className = "crp-map leaflet-map";
    const map = L.map(container, { zoomControl: true, attributionControl: true });
    container._leafletMap = map;
    const bounds = L.latLngBounds(points.map((point) => [Number(point.latitude), Number(point.longitude)]));
    const layer = L.tileLayer(mapConfig.tile_url, { maxZoom: 19, attribution: mapConfig.tile_attribution || "" });
    let failed = false;
    layer.on("tileerror", () => {
      if (failed) return;
      failed = true;
      destroyMap(container);
      onTileError();
      renderGeometryMap(container, route, labels);
    });
    layer.addTo(map);
    L.polyline(points.map((point) => [Number(point.latitude), Number(point.longitude)]), { color: "var(--primary-color, #03a9f4)", weight: 5 }).addTo(map);
    L.circleMarker([Number(points[0].latitude), Number(points[0].longitude)], { radius: 8, color: "#43a047" }).addTo(map).bindTooltip(labels.start);
    L.circleMarker([Number(points.at(-1).latitude), Number(points.at(-1).longitude)], { radius: 8, color: "#e53935" }).addTo(map).bindTooltip(labels.destination);
    points.slice(1, -1).forEach((point, index) => L.circleMarker([Number(point.latitude), Number(point.longitude)], { radius: 6, color: "#fb8c00" }).addTo(map).bindTooltip(`${labels.waypoint} ${index + 1}`));
    map.fitBounds(bounds, { padding: [20, 20] });
    return;
  }
  renderGeometryMap(container, route, labels);
}
