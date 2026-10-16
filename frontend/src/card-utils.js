export function isValidCoordinate(value) {
  return Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180;
}

export function isValidWaypoint(point) {
  return point && Number.isFinite(Number(point.latitude)) && Number(point.latitude) >= -90 && Number(point.latitude) <= 90 && isValidCoordinate(point.longitude);
}

export function normalizeConfig(config = {}) {
  return { entry_id: String(config.entry_id || ""), title: String(config.title || "Camper Route Planner") };
}

export function addWaypoint(waypoints, point = { latitude: "", longitude: "", label: "" }) {
  return [...waypoints, { ...point }];
}

export function removeWaypoint(waypoints, index) {
  return waypoints.filter((_, current) => current !== index);
}

export function moveWaypoint(waypoints, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= waypoints.length) return [...waypoints];
  const result = [...waypoints];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function formatDistance(distanceM, language) {
  const value = Number(distanceM);
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value >= 10000 ? value / 1000 : value) + (value >= 10000 ? " km" : " m");
}

export function formatDuration(durationS, language) {
  const value = Number(durationS);
  if (!Number.isFinite(value) || value < 0) return "—";
  const hours = Math.floor(value / 3600);
  const minutes = Math.round((value % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function normalizeServiceResponse(response) {
  const payload = response?.response || response || {};
  return {
    provider: payload.provider || "unknown",
    distance_m: Number(payload.distance_m),
    duration_s: Number(payload.duration_s),
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : [],
    synthetic: Boolean(payload.synthetic),
    created_at: payload.created_at || new Date().toISOString(),
    geometry: payload.geometry || null,
    origin: payload.origin || null,
    destination: payload.destination || null,
    waypoints: Array.isArray(payload.waypoints) ? payload.waypoints : []
  };
}

export function routeRecordFromResult(result, state) {
  const routeId = globalThis.crypto?.randomUUID?.() || `route-${Date.now()}`;
  return {
    route_id: routeId,
    name: state.routeName || "manual route",
    provider: result.provider,
    distance_m: result.distance_m,
    duration_s: result.duration_s,
    synthetic: result.synthetic,
    geometry: result.geometry,
    profile_id: state.profileId,
    origin: state.origin,
    destination: state.destination,
    waypoints: state.waypoints,
    warnings: result.warnings,
    created_at: result.created_at
  };
}

export function hasTrackGeometry(route) {
  const points = route?.geometry?.points;
  return Array.isArray(points) && points.length >= 2;
}
