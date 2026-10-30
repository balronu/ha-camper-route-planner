import L from "leaflet";

// Keep the map handle private to this card. Other custom cards in the same
// Lovelace document use the generic `_leafletMap` property while resizing
// their own map; exposing that name makes them able to invalidate this map.
const CRP_LEAFLET_MAP = Symbol("camper-route-planner-leaflet-map");
const CRP_LEAFLET_RESIZE_OBSERVER = Symbol("camper-route-planner-leaflet-resize-observer");
const CRP_LEAFLET_TILE_TIMER = Symbol("camper-route-planner-leaflet-tile-timer");
const CRP_LEAFLET_MARKERS = Symbol("camper-route-planner-leaflet-markers");
const CRP_LEAFLET_OPTIONS = Symbol("camper-route-planner-leaflet-options");
const CRP_LEAFLET_LABELS = Symbol("camper-route-planner-leaflet-labels");
const CRP_LEAFLET_ROUTE = Symbol("camper-route-planner-leaflet-route");
const CRP_LEAFLET_BORDER_MARKERS = Symbol("camper-route-planner-leaflet-border-markers");
const CRP_LEAFLET_RESTRICTION_MARKERS = Symbol("camper-route-planner-leaflet-restriction-markers");
const CRP_LEAFLET_POI_MARKERS = Symbol("camper-route-planner-leaflet-poi-markers");
const CRP_LEAFLET_POI_DATA = Symbol("camper-route-planner-leaflet-poi-data");
const CRP_LEAFLET_POI_ZOOM_HANDLER = Symbol("camper-route-planner-leaflet-poi-zoom-handler");
const CRP_LEAFLET_FUEL_PLAN_MARKERS = Symbol("camper-route-planner-leaflet-fuel-plan-markers");

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

export function renderGeometryMap(container, route, labels, pois = {}, fuelPlan = null) {
  container.replaceChildren();
  container.className = "crp-map";
  const points = route?.geometry?.points || [];
  if (points.length < 2) {
    const empty = document.createElement("p");
    empty.textContent = labels.emptyMessage || labels.noRoute;
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
  for (const item of [...(pois.parking || []), ...(pois.fuel || [])]) {
    const projectedPoi = project(item);
    const marker = svgElement("circle", { cx: projectedPoi[0], cy: projectedPoi[1], r: 6, fill: item.category === "fuel" ? "#7b1fa2" : "#1565c0", stroke: "white", "stroke-width": 2, "data-poi-id": item.id });
    marker.setAttribute("aria-label", item.name || (item.category === "fuel" ? labels.fuelStation : labels.parking));
    svg.append(marker);
  }
  for (const stop of Array.isArray(fuelPlan?.stops) ? fuelPlan.stops : []) {
    const station = stop.station || {};
    const latitude = Number(station.latitude ?? station.lat ?? stop.latitude ?? stop.lat);
    const longitude = Number(station.longitude ?? station.lon ?? stop.longitude ?? stop.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const projectedFuel = project({ latitude, longitude });
    const marker = svgElement("circle", { cx: projectedFuel[0], cy: projectedFuel[1], r: 8, fill: "#00838f", stroke: "white", "stroke-width": 3, "data-fuel-plan": "true" });
    marker.setAttribute("aria-label", "Fuel plan");
    svg.append(marker);
  }
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
    clearTimeout(container[CRP_LEAFLET_TILE_TIMER]);
    container[CRP_LEAFLET_TILE_TIMER] = null;
    container[CRP_LEAFLET_RESIZE_OBSERVER]?.disconnect();
    container[CRP_LEAFLET_RESIZE_OBSERVER] = null;
    container[CRP_LEAFLET_MAP].remove();
    container[CRP_LEAFLET_MAP] = null;
  }
  if (container) {
    container[CRP_LEAFLET_MARKERS] = null;
    container[CRP_LEAFLET_ROUTE] = null;
    container[CRP_LEAFLET_OPTIONS] = null;
    container[CRP_LEAFLET_LABELS] = null;
    container[CRP_LEAFLET_BORDER_MARKERS] = null;
    container[CRP_LEAFLET_RESTRICTION_MARKERS] = null;
    container[CRP_LEAFLET_POI_MARKERS] = null;
    container[CRP_LEAFLET_POI_DATA] = null;
    container[CRP_LEAFLET_POI_ZOOM_HANDLER] = null;
    container[CRP_LEAFLET_FUEL_PLAN_MARKERS] = null;
  }
}

function markerIcon(target) {
  const kind = target === "origin" ? "start" : target === "destination" ? "destination" : "waypoint";
  const glyph = target === "origin" ? "S" : target === "destination" ? "Z" : "W";
  return L.divIcon({
    className: `crp-marker crp-marker-${kind}`,
    html: `<span aria-hidden="true">${glyph}</span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    tooltipAnchor: [0, -30],
  });
}

function borderMarkerIcon() {
  return L.divIcon({ className: "crp-marker crp-marker-border", html: "<span aria-hidden=\"true\">B</span>", iconSize: [30, 38], iconAnchor: [15, 36] });
}

function updateLeafletMarkers(container, points) {
  const map = container?.[CRP_LEAFLET_MAP];
  if (!map) return false;
  for (const marker of container[CRP_LEAFLET_MARKERS] || []) marker.remove();
  const labels = container[CRP_LEAFLET_LABELS] || {};
  const options = container[CRP_LEAFLET_OPTIONS] || {};
  const markers = points.map((point, index) => {
    const target = point.target || (index === 0 ? "origin" : index === points.length - 1 ? "destination" : "waypoint");
    const marker = L.marker([Number(point.latitude), Number(point.longitude)], { draggable: Boolean(options.onPointChange), icon: markerIcon(target) });
    marker.addTo(map).bindTooltip(point.address || point.label || (target === "origin" ? labels.start : target === "destination" ? labels.destination : `${labels.waypoint} ${index}`));
    marker.on("dragend", (event) => options.onPointChange?.(target, point.index ?? 0, event.target.getLatLng()));
    return marker;
  });
  container[CRP_LEAFLET_MARKERS] = markers;
  return true;
}

function updateLeafletBorderMarkers(container, crossings = []) {
  const map = container?.[CRP_LEAFLET_MAP];
  if (!map) return false;
  for (const marker of container[CRP_LEAFLET_BORDER_MARKERS] || []) marker.remove();
  const labels = container[CRP_LEAFLET_LABELS] || {};
  const markers = crossings.filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon))).map((item) => {
    const marker = L.marker([Number(item.lat), Number(item.lon)], { icon: borderMarkerIcon() });
    const direction = [item.from_country, item.to_country].filter(Boolean).join(" → ");
    const wait = item.wait_min == null ? labels.borderNoWait || "No current wait-time data" : `${Math.round(Number(item.wait_min))} min`;
    marker.addTo(map).bindTooltip(`${item.name || labels.borderCrossing || "Border crossing"}${direction ? ` · ${direction}` : ""} · ${wait}`);
    return marker;
  });
  container[CRP_LEAFLET_BORDER_MARKERS] = markers;
  return true;
}

function updateLeafletRestrictionMarkers(container, items = []) {
  const map = container?.[CRP_LEAFLET_MAP];
  if (!map) return false;
  for (const marker of container[CRP_LEAFLET_RESTRICTION_MARKERS] || []) marker.remove();
  const markers = items.filter((item) => Number.isFinite(Number(item?.lat ?? item?.latitude)) && Number.isFinite(Number(item?.lon ?? item?.longitude))).map((item) => {
    const marker = L.circleMarker([Number(item.lat ?? item.latitude), Number(item.lon ?? item.longitude)], { radius: 7, color: "#d32f2f", fillColor: "#ef5350", fillOpacity: 0.85 });
    marker.addTo(map).bindTooltip(String(item.message || item.type || item.code || "Restriction"));
    return marker;
  });
  container[CRP_LEAFLET_RESTRICTION_MARKERS] = markers;
  return true;
}

function poiMarkerIcon(category) {
  const glyph = category === "fuel" ? "F" : "P";
  const color = category === "fuel" ? "#7b1fa2" : "#1565c0";
  return L.divIcon({ className: `crp-marker crp-marker-poi crp-marker-poi-${category}`, html: `<span aria-hidden="true" style="background:${color}">${glyph}</span>`, iconSize: [24, 32], iconAnchor: [12, 30] });
}

function poiClusterIcon(count) {
  return L.divIcon({ className: "crp-marker crp-marker-poi-cluster", html: `<span aria-label="${count} POIs">${count}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
}

function clusterPoiItems(map, items) {
  const clusters = [];
  const threshold = 6 / (2 ** Math.max(0, map.getZoom() - 5));
  for (const item of items) {
    const latitude = Number(item.latitude), longitude = Number(item.longitude);
    const cluster = clusters.find((candidate) => Math.abs(latitude - candidate.latitude) <= threshold && Math.abs(longitude - candidate.longitude) <= threshold);
    if (cluster) {
      cluster.items.push(item);
      cluster.latitude = cluster.items.reduce((sum, current) => sum + Number(current.latitude), 0) / cluster.items.length;
      cluster.longitude = cluster.items.reduce((sum, current) => sum + Number(current.longitude), 0) / cluster.items.length;
    } else clusters.push({ latitude, longitude, items: [item] });
  }
  return clusters;
}

function updateLeafletPoiMarkers(container, pois = {}) {
  const map = container?.[CRP_LEAFLET_MAP];
  if (!map) return false;
  for (const marker of container[CRP_LEAFLET_POI_MARKERS] || []) marker.remove();
  const items = [...(pois.parking || []), ...(pois.fuel || [])].filter((item) => Number.isFinite(Number(item?.latitude)) && Number.isFinite(Number(item?.longitude)));
  const markers = clusterPoiItems(map, items).map((cluster) => {
    if (cluster.items.length > 1) {
      const center = [cluster.latitude, cluster.longitude];
      const marker = L.marker(center, { icon: poiClusterIcon(cluster.items.length), keyboard: true });
      marker.addTo(map).bindTooltip(`${cluster.items.length} POIs`).on("click", () => map.setView(center, Math.min(map.getZoom() + 2, map.getMaxZoom() || 19), { animate: true }));
      return marker;
    }
    const item = cluster.items[0];
    const marker = L.marker([Number(item.latitude), Number(item.longitude)], { icon: poiMarkerIcon(item.category) });
    const distance = item.km_from_start == null ? "" : ` · ${Number(item.km_from_start).toFixed(1)} km`;
    marker.addTo(map).bindTooltip(`${item.name || (item.category === "fuel" ? "Fuel station" : "Parking")}${distance}`);
    return marker;
  });
  container[CRP_LEAFLET_POI_MARKERS] = markers;
  container[CRP_LEAFLET_POI_DATA] = pois;
  if (!container[CRP_LEAFLET_POI_ZOOM_HANDLER]) {
    let scheduled = false;
    container[CRP_LEAFLET_POI_ZOOM_HANDLER] = () => {
      if (scheduled) return;
      scheduled = true;
      const refresh = () => { scheduled = false; updateLeafletPoiMarkers(container, container[CRP_LEAFLET_POI_DATA] || {}); };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(refresh); else setTimeout(refresh, 0);
    };
    map.on("zoomend", container[CRP_LEAFLET_POI_ZOOM_HANDLER]);
  }
  return true;
}

function fuelPlanMarkerIcon() {
  return L.divIcon({ className: "crp-marker crp-marker-fuel-plan", html: "<span aria-hidden=\"true\">FP</span>", iconSize: [30, 38], iconAnchor: [15, 36] });
}

function updateLeafletFuelPlanMarkers(container, plan = null) {
  const map = container?.[CRP_LEAFLET_MAP];
  if (!map) return false;
  for (const marker of container[CRP_LEAFLET_FUEL_PLAN_MARKERS] || []) marker.remove();
  const markers = (Array.isArray(plan?.stops) ? plan.stops : []).flatMap((stop) => {
    const station = stop.station || {};
    const latitude = Number(station.latitude ?? station.lat ?? stop.latitude ?? stop.lat);
    const longitude = Number(station.longitude ?? station.lon ?? stop.longitude ?? stop.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const marker = L.marker([latitude, longitude], { icon: fuelPlanMarkerIcon() });
    const cost = stop.est_cost_eur ?? stop.est_cost;
    marker.addTo(map).bindTooltip(`Fuel plan · ${Number(stop.km_from_start).toFixed(1)} km · ${Number(stop.litres).toFixed(1)} l${cost == null ? "" : ` · ${Number(cost).toFixed(2)} EUR (estimate)`}`);
    return [marker];
  });
  container[CRP_LEAFLET_FUEL_PLAN_MARKERS] = markers;
  return true;
}

function updateLeafletRoute(container, route, points = []) {
  const map = container?.[CRP_LEAFLET_MAP];
  if (!map) return false;
  container[CRP_LEAFLET_ROUTE]?.remove();
  container[CRP_LEAFLET_ROUTE] = null;
  const geometry = route?.geometry?.points || [];
  const preview = geometry.length < 2 && points.length >= 2;
  const linePoints = preview ? points : geometry;
  if (linePoints.length < 2) return true;
  const line = L.polyline(linePoints.map((point) => [Number(point.latitude), Number(point.longitude)]), {
    color: "var(--primary-color, #03a9f4)",
    weight: 5,
    opacity: preview ? 0.75 : 1,
    dashArray: preview ? "7 9" : undefined,
    className: preview ? "crp-preview-line" : "crp-route-line",
  }).addTo(map);
  if (preview) line.bindTooltip(container[CRP_LEAFLET_LABELS]?.previewLine || "Straight-line preview");
  container[CRP_LEAFLET_ROUTE] = line;
  return true;
}

function routeCoordinates(points = [], route = null) {
  const geometry = Array.isArray(route?.geometry?.points) ? route.geometry.points : [];
  return [...geometry, ...(Array.isArray(points) ? points : [])]
    .filter((point) => Number.isFinite(Number(point?.latitude)) && Number.isFinite(Number(point?.longitude)))
    .map((point) => [Number(point.latitude), Number(point.longitude)]);
}

export function fitMapToRoute(container, points = [], route = null, force = true) {
  const map = container?.[CRP_LEAFLET_MAP];
  const coordinates = routeCoordinates(points, route);
  if (!map || !force || !coordinates.length) return false;
  map.invalidateSize({ pan: false });
  if (coordinates.length === 1) map.setView(coordinates[0], 12, { animate: false });
  else map.fitBounds(L.latLngBounds(coordinates), { padding: [32, 32], maxZoom: 15, animate: false });
  return true;
}

/** Capture the user-controlled Leaflet view before the card DOM is rebuilt. */
export function captureMapView(container) {
  const map = container?.[CRP_LEAFLET_MAP];
  if (!map) return null;
  const center = map.getCenter();
  return { latitude: center.lat, longitude: center.lng, zoom: map.getZoom() };
}

/** Restore a previously captured view without fitting the route or moving it. */
export function restoreMapView(container, view) {
  const map = container?.[CRP_LEAFLET_MAP];
  if (!map || !view || !Number.isFinite(view.latitude) || !Number.isFinite(view.longitude) || !Number.isFinite(view.zoom)) return false;
  map.setView([view.latitude, view.longitude], view.zoom, { animate: false });
  return true;
}

function scheduleMapFit(container, points, route, force) {
  if (!force) return;
  const fit = () => fitMapToRoute(container, points, route, true);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(fit));
  } else fit();
}

/** Update markers without rebuilding the Leaflet map or its tile layer. */
export function updateMapPoints(container, points, labels = {}, options = {}) {
  if (!container?.[CRP_LEAFLET_MAP]) return false;
  container[CRP_LEAFLET_OPTIONS] = { ...container[CRP_LEAFLET_OPTIONS], ...options };
  container[CRP_LEAFLET_LABELS] = { ...container[CRP_LEAFLET_LABELS], ...labels };
  const validPoints = points || [];
  updateLeafletRoute(container, options.route, validPoints);
  updateLeafletMarkers(container, validPoints);
  updateLeafletBorderMarkers(container, options.borderCrossings || []);
  updateLeafletRestrictionMarkers(container, options.restrictionItems || []);
  updateLeafletPoiMarkers(container, options.pois || {});
  updateLeafletFuelPlanMarkers(container, options.fuelPlan || null);
  scheduleMapFit(container, validPoints, options.route, Boolean(options.fitBounds));
  return true;
}

/** Refresh Leaflet's layout after a previously hidden card becomes visible. */
export function invalidateMapSize(container) {
  const map = container?.[CRP_LEAFLET_MAP];
  if (!map) return false;
  map.invalidateSize({ pan: false });
  return true;
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
    container[CRP_LEAFLET_OPTIONS] = options;
    container[CRP_LEAFLET_LABELS] = labels;
    if (globalThis.ResizeObserver) {
      container[CRP_LEAFLET_RESIZE_OBSERVER] = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      container[CRP_LEAFLET_RESIZE_OBSERVER].observe(container);
    }
    const layer = L.tileLayer(mapConfig.tile_url, { maxZoom: 19, attribution: mapConfig.tile_attribution || "" });
    let failed = false;
    let tileLoaded = false;
    const failTiles = () => {
      if (failed) return;
      failed = true;
      clearTimeout(container[CRP_LEAFLET_TILE_TIMER]);
      container[CRP_LEAFLET_TILE_TIMER] = null;
      destroyMap(container);
      renderGeometryMap(container, route, { ...labels, emptyMessage: labels.mapUnavailable || labels.noRoute }, options.pois || {}, options.fuelPlan || null);
      onTileError();
    };
    layer.on("tileload", () => {
      tileLoaded = true;
      clearTimeout(container[CRP_LEAFLET_TILE_TIMER]);
      container[CRP_LEAFLET_TILE_TIMER] = null;
    });
    layer.on("tileerror", () => {
      if (failed || tileLoaded) return;
      // One transient tile failure must not replace an otherwise usable map.
      // If all initial tiles fail, the short grace period produces the SVG
      // fallback without leaving a partially grey Leaflet surface visible.
      clearTimeout(container[CRP_LEAFLET_TILE_TIMER]);
      container[CRP_LEAFLET_TILE_TIMER] = setTimeout(failTiles, 1500);
    });
    container[CRP_LEAFLET_TILE_TIMER] = setTimeout(() => { if (!tileLoaded) failTiles(); }, 10000);
    layer.addTo(map);
    updateLeafletRoute(container, route, points);
    updateLeafletMarkers(container, points);
    updateLeafletBorderMarkers(container, options.borderCrossings || []);
    updateLeafletRestrictionMarkers(container, options.restrictionItems || []);
    updateLeafletPoiMarkers(container, options.pois || {});
    updateLeafletFuelPlanMarkers(container, options.fuelPlan || null);
    if (options.fitBounds) {
      scheduleMapFit(container, points, route, true);
    } else if (!route && points.length === 1) {
      map.setView([Number(points[0].latitude), Number(points[0].longitude)], 12);
    } else if (!route && points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map((point) => [Number(point.latitude), Number(point.longitude)])), { padding: [32, 32], maxZoom: 15 });
    } else {
      // A basemap is useful before a route exists. Keep a neutral central
      // Europe view until the tracker or a manually entered point is known.
      map.setView([51, 10], 5);
    }
    requestAnimationFrame(() => map.invalidateSize());
    map.on("click", (event) => options.onMapClick?.(event.latlng));
    return;
  }
  const emptyMessage = mapConfig?.provider === "carto"
    ? (labels.mapUnavailable || labels.noRoute)
    : (mapConfig ? labels.noRoute : (labels.mapLoading || labels.noRoute));
    renderGeometryMap(container, { geometry: { points: points.length >= 2 ? points : geometry } }, { ...labels, emptyMessage }, options.pois || {}, options.fuelPlan || null);
}
