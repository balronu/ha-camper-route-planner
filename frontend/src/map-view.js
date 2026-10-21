import L from "leaflet";

// Keep the map handle private to this card. Other custom cards in the same
// Lovelace document use the generic `_leafletMap` property while resizing
// their own map; exposing that name makes them able to invalidate this map.
const CRP_LEAFLET_MAP = Symbol("camper-route-planner-leaflet-map");
const CRP_LEAFLET_RESIZE_OBSERVER = Symbol("camper-route-planner-leaflet-resize-observer");

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
  if (container?.[CRP_LEAFLET_MAP]) {
    container[CRP_LEAFLET_RESIZE_OBSERVER]?.disconnect();
    container[CRP_LEAFLET_RESIZE_OBSERVER] = null;
    container[CRP_LEAFLET_MAP].remove();
    container[CRP_LEAFLET_MAP] = null;
  }
}

export function renderMap(container, route, mapConfig, labels, onTileError = () => {}, options = {}) {
  destroyMap(container);
  const points = options.points || route?.geometry?.points || [];
  const geometry = route?.geometry?.points || [];
  if (mapConfig?.provider === "carto" && mapConfig.status === "configured" && mapConfig.tile_url) {
    container.replaceChildren();
    container.className = "crp-map crp-leaflet-map";
    const map = L.map(container, { zoomControl: true, attributionControl: true });
    container[CRP_LEAFLET_MAP] = map;
    if (globalThis.ResizeObserver) {
      container[CRP_LEAFLET_RESIZE_OBSERVER] = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      container[CRP_LEAFLET_RESIZE_OBSERVER].observe(container);
    }
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
    if (geometry.length >= 2) L.polyline(geometry.map((point) => [Number(point.latitude), Number(point.longitude)]), { color: "var(--primary-color, #03a9f4)", weight: 5 }).addTo(map);
    points.forEach((point, index) => {
      const target = point.target || (index === 0 ? "origin" : index === points.length - 1 ? "destination" : "waypoint");
      const marker = L.marker([Number(point.latitude), Number(point.longitude)], { draggable: Boolean(options.onPointChange) });
        marker.addTo(map).bindTooltip(point.address || point.label || (target === "origin" ? labels.start : target === "destination" ? labels.destination : `${labels.waypoint} ${index}`));
      marker.on("dragend", (event) => options.onPointChange?.(target, point.index ?? 0, event.target.getLatLng()));
    });
    if (points.length === 1) {
      map.setView([Number(points[0].latitude), Number(points[0].longitude)], 12);
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map((point) => [Number(point.latitude), Number(point.longitude)])), { padding: [20, 20] });
    } else {
      // A basemap is useful before a route exists. Keep a neutral central
      // Europe view until the tracker or a manually entered point is known.
      map.setView([51, 10], 5);
    }
    requestAnimationFrame(() => map.invalidateSize());
    map.on("click", (event) => options.onMapClick?.(event.latlng));
    return;
  }
  renderGeometryMap(container, { geometry: { points: points.length >= 2 ? points : geometry } }, labels);
}
