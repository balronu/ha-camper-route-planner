export function isValidCoordinate(value) {
  return Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180;
}

export function isValidWaypoint(point) {
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);
  return point && point.latitude !== "" && point.longitude !== "" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && isValidCoordinate(longitude) && !(latitude === 0 && longitude === 0);
}

export function validOrEmptyWaypoint(point) {
  return isValidWaypoint(point) ? { ...point } : { latitude: "", longitude: "", label: point?.label || "" };
}

export function normalizeConfig(config = {}) {
  return { entry_id: String(config.entry_id || ""), title: String(config.title || "Camper Route Planner"), show_developer_diagnostics: config.show_developer_diagnostics === true };
}

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
const OFFSET_DATE_TIME = /(?:Z|[+-]\d{2}:\d{2})$/;
const padDatePart = (value) => String(value).padStart(2, "0");

/** Convert a datetime-local wall-clock value in the browser timezone to ISO-8601. */
export function localDateTimeToIso(value, makeDate = (raw) => new Date(raw)) {
  if (value == null || String(value).trim() === "") return "";
  const raw = String(value).trim();
  if (OFFSET_DATE_TIME.test(raw)) {
    const explicit = new Date(raw);
    return Number.isNaN(explicit.getTime()) ? null : raw;
  }
  const match = raw.match(LOCAL_DATE_TIME);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00"] = match;
  const date = makeDate(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  // Date normalizes nonexistent spring-forward times; reject that shift.
  if (date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day) || date.getHours() !== Number(hour) || date.getMinutes() !== Number(minute) || date.getSeconds() !== Number(second)) return null;
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${padDatePart(Math.floor(absoluteOffset / 60))}:${padDatePart(absoluteOffset % 60)}`;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

/** Render an explicit-offset value back into the browser datetime-local input. */
export function isoDateTimeToLocalInput(value) {
  if (value == null || String(value).trim() === "") return "";
  const raw = String(value).trim();
  if (!OFFSET_DATE_TIME.test(raw)) return raw.slice(0, 16);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

export function selectConfigEntry(config = {}, entries = []) {
  const explicit = String(config.entry_id || "");
  const normalized = (Array.isArray(entries) ? entries : []).filter((entry) => entry && entry.entry_id).map((entry) => ({
    entry_id: String(entry.entry_id), title: String(entry.title || "Camper Route Planner"), state: String(entry.state || "")
  }));
  if (explicit) return { entryId: explicit, status: "ready", entries: normalized };
  if (normalized.length === 1) return { entryId: normalized[0].entry_id, status: "ready", entries: normalized };
  if (normalized.length > 1) return { entryId: "", status: "multiple", entries: normalized };
  return { entryId: "", status: "missing", entries: normalized };
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
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
    beta: Boolean(payload.beta),
    attribution_url: payload.attribution_url || payload.metadata?.attribution_url || null,
    origin: payload.origin || null,
    destination: payload.destination || null,
    waypoints: Array.isArray(payload.waypoints) ? payload.waypoints : []
    ,route_options: normalizeRouteOptions(payload.route_options || payload.metadata?.request_options || {}), request_diagnostic: payload.request_diagnostic || null
  };
}

export function providerErrorMessage(error, language = "en") {
  const code = String(error?.code || error?.data?.code || "");
  const status = Number(error?.status || error?.data?.status || 0);
  const messages = {
    de: {
      route_restrictions_unresolved: "Für diese Strecke konnte keine vollständig zulässige Route für dein Fahrzeug bestätigt werden. Prüfe deine Zwischenziele und Fahrzeugangaben.",
      point_not_routable: "Der Routingdienst kann einen Wegpunkt nicht routen. Prüfe diesen Punkt und seine Koordinaten.",
      route_timeout: "Der Routingdienst hat die Routenberechnung wegen eines Zeitlimits beendet. Bitte versuche es später erneut.",
      quota_exceeded: "Der Routingdienst hat sein Anfragelimit erreicht. Bitte versuche es später erneut.",
      timeout: "Der Routingdienst hat nicht rechtzeitig geantwortet. Bitte versuche es später erneut.",
      network_error: "Die Netzwerkverbindung zum Routingdienst ist fehlgeschlagen. Bitte versuche es später erneut.",
      invalid_response: "Der Routingdienst hat keine gültige Antwort geliefert. Bitte versuche es später erneut.",
      invalid_json: "Der Routingdienst hat kein gültiges JSON geliefert. Bitte versuche es später erneut.",
      empty_response: "Der Routingdienst hat keine Antwort geliefert. Bitte versuche es später erneut.",
      html_response: "Der Routingdienst hat eine ungültige HTML-Antwort geliefert. Bitte versuche es später erneut.",
      unauthorized: "Der Routingdienst hat die Zugangsdaten abgelehnt.",
      forbidden: "Der Routingdienst hat diese Anfrage nicht erlaubt.",
      not_found: "Der Routingdienst-Endpunkt wurde nicht gefunden.",
      provider_unavailable: "Der Routingdienst ist vorübergehend nicht verfügbar. Bitte versuche es später erneut."
    },
    en: {
      route_restrictions_unresolved: "A fully permitted route for your vehicle could not be confirmed. Check your waypoints and vehicle details.",
      point_not_routable: "The routing service cannot route one waypoint. Check that point and its coordinates.",
      route_timeout: "The routing service stopped the route calculation because it timed out. Please try again later.",
      quota_exceeded: "The routing service has reached its request limit. Please try again later.",
      timeout: "The routing service did not respond in time. Please try again later.",
      network_error: "The network connection to the routing service failed. Please try again later.",
      invalid_response: "The routing service did not return a valid response. Please try again later.",
      invalid_json: "The routing service did not return valid JSON. Please try again later.",
      empty_response: "The routing service returned no response. Please try again later.",
      html_response: "The routing service returned an invalid HTML response. Please try again later.",
      unauthorized: "The routing service rejected the credentials.",
      forbidden: "The routing service did not allow this request.",
      not_found: "The routing service endpoint was not found.",
      provider_unavailable: "The routing service is temporarily unavailable. Please try again later."
    }
  };
  if (messages[language]?.[code]) return messages[language][code];
  if (status === 429) return messages[language]?.quota_exceeded || messages.en.quota_exceeded;
  if (status >= 500) return messages[language]?.provider_unavailable || messages.en.provider_unavailable;
  return error?.message || (language === "de" ? "Die Routenberechnung ist fehlgeschlagen." : "Route calculation failed.");
}

export function normalizeRouteOptions(options = {}) {
  const source = options && typeof options === "object" ? options : {};
  return {
    traffic: source.traffic || "off",
    avoid: Array.isArray(source.avoid) ? source.avoid : [],
    route_type: source.route_type || "fastest",
    alternatives: Number.isFinite(Number(source.alternatives)) ? Number(source.alternatives) : 0,
    depart_at: source.depart_at || "",
    arrive_at: source.arrive_at || "",
  };
}

const PROVIDER_ALIASES = {
  nakordoni: "nakordoni",
  nakordoni_v2: "nakordoni",
  nakordoni_v3: "nakordoni",
  nakordoni_motorhome: "nakordoni",
  nakordoni_motorhome_v2: "nakordoni",
  nakordoni_motorhome_v3: "nakordoni",
};

export function normalizeProviderId(value) {
  const raw = String(value || "").trim().toLowerCase();
  return PROVIDER_ALIASES[raw] || raw;
}

export function providerApiVersion(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw.endsWith("_v3") || raw === "nakordoni_v3" ? "v3" : raw.endsWith("_v2") || raw === "nakordoni_v2" || raw === "nakordoni_motorhome" ? "v2" : null;
}

/** Prefer the executed result version while retaining the configured fallback. */
export function resolveProviderStatus(configuredProvider, resultProvider, resultApiVersion = null) {
  const configured = normalizeProviderId(configuredProvider);
  const actual = normalizeProviderId(resultProvider);
  return {
    configuredProvider: configured,
    provider: actual || configured,
    apiVersion: resultApiVersion === "v2" || resultApiVersion === "v3" ? resultApiVersion : providerApiVersion(resultProvider) || providerApiVersion(configuredProvider),
  };
}

export function normalizeDecimalInput(value, { minimum = 0, maximum = Infinity } = {}) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return { present: false, valid: true, intermediate: false, value: null };
  if (typeof value === "number") return { present: true, valid: Number.isFinite(value) && value >= minimum && value <= maximum, intermediate: false, value };
  const raw = String(value).trim();
  if (/^[+]?\d+[.,]$/.test(raw)) return { present: true, valid: false, intermediate: true, value: null };
  if (!/^[+]?((\d+(?:[.,]\d+)?)|(\.\d+))$/.test(raw)) return { present: true, valid: false, intermediate: false, value: null };
  const number = Number(raw.replace(",", "."));
  return { present: true, valid: Number.isFinite(number) && number >= minimum && number <= maximum, intermediate: false, value: number };
}

export function calculateFuelPlan(distanceM, profile = {}) {
  const optionalNumber = (value, minimum = 0, maximum = Infinity) => normalizeDecimalInput(value, { minimum, maximum });
  const distance = optionalNumber(distanceM, 0);
  const consumptionInput = optionalNumber(profile.consumption_l_per_100km, 0);
  const tankInput = optionalNumber(profile.tank_capacity_l, 0);
  const levelLitersInput = optionalNumber(profile.fuel_level_l, 0);
  const levelPercentInput = optionalNumber(profile.fuel_level_pct, 0, 100);
  // Legacy reserve values remain readable for backward compatibility, but are
  // no longer part of the local range calculation in Beta.15.
  const reserveInput = optionalNumber(profile.reserve_l, 0);
  // A manual price is an explicitly rough €/l estimate. Values such as 216
  // are rejected instead of silently being interpreted as cents.
  const priceInput = optionalNumber(profile.diesel_price_per_l, 0, 10);
  const distanceKm = distance.valid ? distance.value / 1000 : null;
  const consumption = consumptionInput.valid && consumptionInput.present && consumptionInput.value > 0 ? consumptionInput.value : null;
  const totalLiters = consumption != null && distanceKm != null ? distanceKm * consumption / 100 : null;
  const tank = tankInput.valid && tankInput.present && tankInput.value > 0 ? tankInput.value : null;
  // Liter filling level has priority when both representations are present.
  // The options flow prevents saving both, while old data remains readable.
  const levelMode = profile.fuel_level_mode === "percent" || (profile.fuel_level_mode == null && !levelLitersInput.present && levelPercentInput.present) ? "percent" : "liters";
  const selectedLevelInput = levelMode === "percent" ? levelPercentInput : levelLitersInput;
  const level = levelMode === "percent"
    ? selectedLevelInput.valid && selectedLevelInput.present && tank != null ? tank * selectedLevelInput.value / 100 : null
    : selectedLevelInput.valid && selectedLevelInput.present ? selectedLevelInput.value : null;
  const reserve = reserveInput.valid && reserveInput.present ? reserveInput.value : null;
  const invalidTankData = !distance.valid || !consumptionInput.valid || !tankInput.valid || !selectedLevelInput.valid || (tank != null && level != null && level > tank);
  const completeTankData = !invalidTankData && tank != null && level != null && consumption != null;
  const usable = completeTankData ? level : null;
  const rangeKm = usable == null ? null : usable * 100 / consumption;
  const deficit = totalLiters == null || usable == null ? null : Math.max(0, totalLiters - usable);
  const cost = totalLiters != null && priceInput.valid && priceInput.present ? totalLiters * priceInput.value : null;
  return { distanceKm, consumption, tank, level, reserve, usable, rangeKm, totalLiters, deficit, cost, sufficient: rangeKm == null || totalLiters == null ? null : rangeKm >= distanceKm, invalidTankData, invalidPrice: priceInput.present && !priceInput.valid, completeTankData, fuelLevelMode: levelMode };
}

const FUEL_VALUE_FIELDS = ["fuel_level_l", "fuel_level_pct", "reserve_l", "diesel_price_per_l", "fuel_level_mode"];

/** Keep card-local fuel inputs with a saved route without changing profile data. */
export function pickFuelValues(values = {}) {
  return Object.fromEntries(FUEL_VALUE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(values, field)).map((field) => [field, values[field]]));
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
    metadata: result.metadata,
    created_at: result.created_at,
    fuel_values: pickFuelValues(state.fuelValues)
    ,route_options: normalizeRouteOptions(result.route_options || result.metadata?.request_options || {})
  };
}

export function hasTrackGeometry(route) {
  const points = route?.geometry?.points;
  return Array.isArray(points) && points.length >= 2;
}

export function navigationPlatform(userAgent = globalThis.navigator?.userAgent || "") {
  const ua = String(userAgent);
  const navigatorObject = globalThis.navigator;
  if (/iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(navigatorObject?.maxTouchPoints) > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function buildNavigationLink(route = {}, state = {}, platform = navigationPlatform()) {
  const origin = route.origin || state.origin;
  const destination = route.destination || state.destination;
  const waypoints = Array.isArray(route.waypoints) ? route.waypoints : (state.waypoints || []);
  if (!isValidWaypoint(destination)) return null;
  const validOrigin = isValidWaypoint(origin) ? origin : null;
  const validWaypoints = waypoints.filter(isValidWaypoint);
  const point = (value) => `${Number(value.latitude).toFixed(6)},${Number(value.longitude).toFixed(6)}`;
  const destinationValue = point(destination);
  if (platform === "ios") {
    // Use the direct HTTPS Directions link proven by Mobile Fuel Stations.
    // Proprietary maps:// URLs are unreliable inside the Home Assistant iOS WebView.
    return { url: `https://maps.apple.com/directions?destination=${encodeURIComponent(destinationValue)}&mode=driving`, platform, supportsWaypoints: false, omittedWaypoints: validWaypoints.length > 0 };
  }
  if (platform === "android") {
    // This is also a normal browser URL, so the Android Companion WebView can
    // hand it to Google Maps without relying on geo: URI handling.
    return { url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationValue)}&travelmode=driving&dir_action=navigate`, platform, supportsWaypoints: false, omittedWaypoints: validWaypoints.length > 0 };
  }
  const routePoints = [validOrigin, ...validWaypoints, destination].filter(Boolean).map(point).join(";");
  return { url: `https://www.openstreetmap.org/directions?route=${encodeURIComponent(routePoints)}`, platform: "desktop", supportsWaypoints: true, omittedWaypoints: false };
}
