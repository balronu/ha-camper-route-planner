import { languageOf, t } from "./localization.js";
import { addWaypoint, buildNavigationLink, calculateFuelPlan, formatDistance, formatDuration, hasTrackGeometry, isValidWaypoint, moveWaypoint, navigationPlatform, normalizeConfig, normalizeDecimalInput, normalizeServiceResponse, removeWaypoint, routeRecordFromResult, selectConfigEntry } from "./card-utils.js";
import { callWebsocket, calculateRoute, deliverGpxExport, exportGpx, geocode, reverseGeocode, trackerPosition } from "./services.js";
import { destroyMap, invalidateMapSize, renderMap, updateMapPoints } from "./map-view.js";
import { LEAFLET_CSS } from "./leaflet-css.js";
import { classifyProviderText, formatTollAmount, tollCalculationText, tollCountryName } from "./toll-display.js";
import { createTravelPlanPdf, downloadPdf, pdfFileName } from "./pdf-export.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const formatCoordinate = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return number.toFixed(6).replace(/\.?0+$/, "");
};
const FUEL_FIELDS = ["fuel_level_l", "fuel_level_pct", "reserve_l", "diesel_price_per_l", "fuel_level_mode"];
const emptyFuelValues = () => ({ fuel_level_l: "", fuel_level_pct: "", reserve_l: "", diesel_price_per_l: "", fuel_level_mode: "liters" });
const fuelStorageKey = (entryId, profileId) => `camper-route-planner:fuel:${String(entryId)}:${String(profileId)}`;
function readFuelValues(entryId, profile) {
  const empty = emptyFuelValues();
  if (!profile?.profile_id) return empty;
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(fuelStorageKey(entryId, profile.profile_id)) || "null");
    if (stored && typeof stored === "object") return { ...empty, ...Object.fromEntries(FUEL_FIELDS.map((field) => [field, stored[field] ?? ""])), fuel_level_mode: stored.fuel_level_mode === "percent" ? "percent" : "liters" };
  } catch (_error) { /* local storage is optional in HA previews/private mode */ }
  // Beta.12 profiles may contain these fields. Read them as a compatibility
  // fallback without writing them back or changing the durable profile.
  return { ...empty, fuel_level_l: profile.fuel_level_l ?? "", fuel_level_pct: profile.fuel_level_pct ?? "", reserve_l: profile.reserve_l ?? "", diesel_price_per_l: profile.diesel_price_per_l ?? "", fuel_level_mode: profile.fuel_level_pct != null && profile.fuel_level_l == null ? "percent" : "liters" };
}
function writeFuelValues(entryId, profileId, values) {
  try { globalThis.localStorage?.setItem(fuelStorageKey(entryId, profileId), JSON.stringify(values)); } catch (_error) { /* best effort */ }
}


function renderBorderCrossings(result, translate) {
  const crossings = result?.metadata?.border_crossings;
  if (!Array.isArray(crossings)) return "";
  if (!crossings.length && result?.metadata?.border_state === "unordered_international") return `<section class="route-details border-crossings"><h3>${translate("borderCrossings")}</h3><p class="subtle">${translate("borderInternationalAmbiguous")}</p></section>`;
  const rows = crossings.length ? crossings.map((crossing) => {
    const direction = [crossing.from_country, crossing.to_country].filter(Boolean).join(" → ") || "—";
    const wait = crossing.wait_min == null ? translate("borderNoWait") : `${Math.round(Number(crossing.wait_min))} min`;
    const side = Array.isArray(crossing.wait_sides) ? crossing.wait_sides[0] : null;
    const basis = side?.basis === "forecast" ? translate("borderForecast") : side?.basis === "live" ? translate("borderLive") : null;
    const source = crossing.source_url ? `<a href="${escapeHtml(crossing.source_url)}" target="_blank" rel="noreferrer">${translate("dataByNakordoni")}</a>` : translate("dataByNakordoni");
    const quality = side?.data_quality === "low" ? translate("borderEstimate") : (side?.data_quality || basis || "—");
    const inferred = crossing.inferred ? `<small>${translate("borderInferred")}</small>` : "";
    return `<article class="border-crossing"><b>${escapeHtml(direction)}</b>${crossing.name ? `<div>${translate("borderName")}: ${escapeHtml(crossing.name)}</div>` : ""}<div><span>${translate("borderWait")}: ${escapeHtml(wait)}</span>${basis ? ` · ${escapeHtml(basis)}` : ""}</div><small>${translate("borderDataAt")}: ${escapeHtml(crossing.wait_at || "—")} · ${translate("borderQuality")}: ${escapeHtml(quality)} · ${translate("borderSource")}: ${source}</small>${crossing.wait_notes?.length ? `<small>${escapeHtml(crossing.wait_notes.join(" "))}</small>` : ""}${inferred}</article>`;
  }).join("") : `<p class="subtle">${translate(result?.metadata?.border_state === "unordered_international" ? "borderInternationalAmbiguous" : "noBorderCrossings")}</p>`;
  return `<section class="route-details border-crossings"><h3>${translate("borderCrossings")}</h3>${rows}</section>`;
}

function renderTollDetails(result, translate, language) {
  const tolls = result?.metadata?.tolls;
  if (!tolls) return "";
  const total = tolls.total != null ? formatTollAmount(tolls.total, tolls.currency || "EUR", language) : tolls.complete === false ? translate("tollIncomplete") : translate("tollUnavailable");
  const knownHints = [];
  const unknownTexts = [];
  const collectProviderText = (raw) => {
    const classified = classifyProviderText(raw, language);
    knownHints.push(...classified.known);
    unknownTexts.push(...classified.unknown);
  };
  const countries = Array.isArray(tolls.countries) ? tolls.countries.map((item) => {
    const system = translate(`tollSystemName.${item.system}`);
    const status = translate(`tollStatus.${item.status}`);
    const systemLabel = system === `tollSystemName.${item.system}` ? translate("unknown") : system;
    const statusLabel = status === `tollStatus.${item.status}` ? translate("unknown") : status;
    collectProviderText(item.tariff);
    const amount = item.total ?? item.amount;
    const amountText = amount != null ? formatTollAmount(amount, item.currency || tolls.currency || "EUR", language) : translate("tollUnavailable");
    const calculation = tollCalculationText(item, language);
    return `<article class="toll-country"><div class="toll-country-heading"><b>${escapeHtml(tollCountryName(item.country, language))}</b><strong>${escapeHtml(amountText)}</strong></div><div class="toll-country-meta">${escapeHtml(systemLabel)}${item.status ? ` · ${escapeHtml(statusLabel)}` : ""}</div>${calculation ? `<small>${escapeHtml(calculation)}</small>` : ""}</article>`;
  }).join("") : "";
  const objects = Array.isArray(tolls.objects) ? tolls.objects.map((item) => `<li>${escapeHtml(item.name || item.type || "—")}: ${item.cost_eur != null ? escapeHtml(formatTollAmount(item.cost_eur, "EUR", language)) : translate("tollUnavailable")}${item.country ? ` · ${escapeHtml(tollCountryName(item.country, language))}` : ""}${item.status ? ` · ${escapeHtml(translate(`tollStatus.${item.status}`))}` : ""}</li>`).join("") : "";
  collectProviderText(tolls.coverage_note);
  const tariffNotice = result?.metadata?.tariff_basis_uncertain ? `<p class="subtle">${translate("tariffBasisUncertain")}</p>` : "";
  const knownNotes = knownHints.length ? `<div class="toll-known-notes"><b>${translate("tollNotes")}</b><ul>${knownHints.map((hint) => `<li>${escapeHtml(hint.text)}${hint.original ? ` <span class="subtle">(${escapeHtml(hint.original)})</span>` : ""}</li>`).join("")}</ul></div>` : "";
  const technicalNotes = unknownTexts.length ? `<details class="provider-details"><summary>${translate("tollTechnicalInfo")}</summary><ul>${[...new Set(unknownTexts)].map((note) => `<li lang="en">${escapeHtml(note)}</li>`).join("")}</ul></details>` : "";
  return `<section class="route-details toll-details"><h3>${translate("tollSummary")}</h3><div class="toll-total">${escapeHtml(total)}${tolls.estimate ? ` <span class="subtle">(${translate("tollEstimate")})</span>` : ""}</div>${countries ? `<div class="toll-countries">${countries}</div>` : ""}${objects ? `<div class="toll-objects"><b>${translate("tollReference")}</b><ul>${objects}</ul></div>` : ""}${knownNotes}${technicalNotes}${tariffNotice}</section>`;
}

function renderRestrictions(result, translate) {
  const metadata = result?.metadata || {};
  const items = [...(Array.isArray(metadata.restriction_hits) ? metadata.restriction_hits : []), ...(Array.isArray(metadata.low_emission_zones_on_route) ? metadata.low_emission_zones_on_route : [])];
  const warnings = Array.isArray(metadata.provider_warnings) ? metadata.provider_warnings : [];
  const row = (item) => {
    const applies = item?.applies === true || item?.active === true;
    const status = applies ? translate("restrictionActive") : item?.applies === false ? translate("restrictionConsidered") : translate("restrictionInfo");
    const validity = [item.valid_from, item.valid_until, item.data_at || item.timestamp].filter(Boolean).join(" – ");
    return `<li><b>${escapeHtml(item.code || item.type || translate("restriction"))}</b> · ${escapeHtml(status)}${item.message ? `: ${escapeHtml(item.message)}` : ""}${validity ? `<small>${escapeHtml(translate("validity"))}: ${escapeHtml(validity)}</small>` : ""}</li>`;
  };
  const groups = items.length ? `<ul>${items.map(row).join("")}</ul>` : `<p class="subtle">${translate("noRestrictions")}</p>`;
  const notes = warnings.length ? `<details><summary>${translate("providerWarnings")}</summary><ul>${warnings.map((item) => row(typeof item === "string" ? { message: item } : item)).join("")}</ul></details>` : "";
  return `<details class="route-details restrictions" open><summary><h3>${translate("trafficRestrictions")}</h3></summary><p class="subtle">${escapeHtml(translate(`trafficMode.${result?.metadata?.traffic || "off"}`))}</p>${groups}${notes}</details>`;
}

function renderFuelPlan(result, profile, fuelValues, translate, language) {
  const plan = calculateFuelPlan(result?.distance_m, { ...(profile || {}), ...(fuelValues || {}) });
  const number = (value, digits = 1) => value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value);
  const range = plan.rangeKm == null ? translate("fuelNotCalculable") : `${number(plan.rangeKm)} km`;
  const mode = fuelValues?.fuel_level_mode === "percent" ? "percent" : "liters";
  const activeField = mode === "percent" ? "fuel_level_pct" : "fuel_level_l";
  const input = (field, label, placeholder) => `<label class="fuel-input">${label}<input data-fuel-field="${field}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="${placeholder}" aria-invalid="${plan.invalidTankData && field === activeField ? "true" : "false"}" value="${escapeHtml(fuelValues?.[field] ?? "")}"></label>`;
  const tankText = profile?.tank_capacity_l == null ? translate("fuelNotCalculable") : `${number(Number(profile.tank_capacity_l))} l`;
  const consumptionText = profile?.consumption_l_per_100km == null ? translate("fuelNotCalculable") : `${number(Number(profile.consumption_l_per_100km))} l/100 km`;
  const validation = plan.invalidPrice ? `<p class="error" role="alert">${translate("fuelPriceInvalid")}</p>` : plan.invalidTankData ? `<p class="error" role="alert">${translate("fuelInputInvalid")}</p>` : "";
  const planningNotice = plan.deficit > 0 ? `<p class="fuel-planning-notice notice">${translate("fuelRefuelRequired")} ${number(plan.deficit)} l</p>` : plan.deficit == null ? `<p class="subtle">${translate("fuelDataMissing")}</p>` : "";
  return `<details class="route-details fuel-range" open><summary><h3>${translate("fuelRange")}</h3></summary><div class="fuel-profile-facts"><span><b>${tankText}</b><small>${translate("tankCapacity")}</small></span><span><b>${consumptionText}</b><small>${translate("consumption")}</small></span></div><div class="fuel-input-grid"><label class="fuel-input">${translate("fuelLevelUnit")}<select data-fuel-mode><option value="liters" ${mode === "liters" ? "selected" : ""}>${translate("fuelLevelLiters")}</option><option value="percent" ${mode === "percent" ? "selected" : ""}>${translate("fuelLevelPercent")}</option></select></label>${input(activeField, mode === "percent" ? translate("fuelLevelPercent") : translate("fuelLevelLiters"), mode === "percent" ? "0–100" : "0,0")}${input("diesel_price_per_l", translate("dieselPrice"), "2,16")}</div>${validation}<div class="metrics"><div><b>${plan.totalLiters == null ? translate("fuelNotCalculable") : `${number(plan.totalLiters)} l`}</b><span>${translate("estimatedFuel")}</span></div><div><b>${range}</b><span>${translate("availableRange")}</span></div><div><b>${plan.cost == null ? translate("fuelNotCalculable") : `${number(plan.cost, 2)} €`}</b><span>${translate("estimatedCost")}</span></div></div>${planningNotice}</details>`;
}

class CamperRoutePlannerCardEditor extends HTMLElement {
  setConfig(config) { this.config = { ...config }; this.render(); }
  set hass(hass) { this._hass = hass; this._connection = hass?.connection || hass; this.loadEntries(); }
  connectedCallback() { this.render(); }
  async loadEntries() {
    if (!this._hass?.callWS || this._entriesConnection === this._connection || this._loadingEntries) return;
    this._entriesConnection = this._connection; this._loadingEntries = true;
    try { const response = await callWebsocket(this._hass, { type: "camper_route_planner/list_entries" }); this._entries = Array.isArray(response?.entries) ? response.entries : []; }
    catch (_error) { this._entries = []; }
    finally { this._loadingEntries = false; this.render(); }
  }
  render() {
    const language = languageOf(this._hass); const translate = (key) => t(language, key); const selection = selectConfigEntry(this.config, this._entries || []);
    const options = (this._entries || []).map((entry) => `<option value="${escapeHtml(entry.entry_id)}" ${entry.entry_id === this.config?.entry_id ? "selected" : ""}>${escapeHtml(entry.title)}</option>`).join("");
    this.innerHTML = `<label>${translate("entrySelection")} <select data-entry-id><option value="">${selection.status === "multiple" ? translate("multipleEntries") : translate("configMissing")}</option>${options}</select></label>`;
    this.querySelector("select")?.addEventListener("change", (event) => this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config: { ...this.config, entry_id: event.target.value } } })));
  }
}

export class CamperRoutePlannerCard extends HTMLElement {
  static getConfigElement() { return document.createElement("camper-route-planner-card-editor"); }
  static getStubConfig() { return { entry_id: "" }; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig();
    this._state = { profiles: [], routes: [], provider: "", mapConfig: null, profileId: "", fuelValues: emptyFuelValues(), origin: { latitude: "", longitude: "", label: "" }, destination: { latitude: "", longitude: "", label: "" }, waypoints: [], routeName: "manual route", routeOptions: { traffic: "off", avoid: [], route_type: "fastest", alternatives: 0, depart_at: "", arrive_at: "" }, result: null, error: "", mapError: "", searchError: "", searchResults: [], searchTarget: "origin", searchSlot: 0, originManual: false, busy: false, loaded: false, entryStatus: "missing", entries: [] };
    this._cardExpanded = false;
    this._connection = null;
    this._reverseTimers = new Map();
    this._inputDrafts = new Map();
    this._preserveInputDraftKeys = new Set();
    this._searchRequestIds = new Map();
    this._fitMapOnNextRender = false;
    this._entryDiscoveryConnection = null;
    this._entryDiscoveryPromise = null;
  }

  connectedCallback() {
    this._resizeObserver?.disconnect();
    if (globalThis.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(() => this.updateResponsiveClass());
      this._resizeObserver.observe(this);
    }
    this.updateResponsiveClass();
    // A catalog preview can disconnect and reconnect the same element. Rebuild
    // a map that was deliberately torn down during the disconnected phase.
    if (this._config.entry_id && this._state.result) this.render();
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    // Leaflet installs window listeners. Removing the host DOM alone does not
    // call map.remove(), so clean up before HA discards a preview/card.
    destroyMap(this.shadowRoot?.querySelector(".crp-map"));
  }

  updateResponsiveClass() {
    const width = this.getBoundingClientRect().width;
    const narrow = width > 0 && width <= 600;
    const tiny = width > 0 && width <= 360;
    this.classList.toggle("crp-narrow", narrow);
    this.classList.toggle("crp-tiny", tiny);
    const grid = this.shadowRoot?.querySelector(".grid");
    if (grid) grid.style.gridTemplateColumns = narrow ? "1fr" : "repeat(2, minmax(0, 1fr))";
  }

  setConfig(config) {
    const next = normalizeConfig(config); const changed = next.entry_id !== this._config.entry_id || next.title !== this._config.title;
    this._config = next; if (changed && this._hass) this.loadData(); else this.render();
  }

  set hass(hass) {
    this._hass = hass;
    const connection = hass?.connection || hass;
    if (connection && connection !== this._connection) {
      this._connection = connection;
      this.loadData();
    }
  }

  async discoverEntry() {
    if (this._config.entry_id) return selectConfigEntry(this._config, []);
    if (this._entryDiscoveryConnection === this._connection && this._entryDiscoveryPromise) return this._entryDiscoveryPromise;
    this._entryDiscoveryConnection = this._connection;
    this._entryDiscoveryPromise = callWebsocket(this._hass, { type: "camper_route_planner/list_entries" }).then((response) => {
      const selection = selectConfigEntry(this._config, response?.entries || []); this._state.entries = selection.entries; this._state.entryStatus = selection.status; return selection;
    }).finally(() => { this._entryDiscoveryPromise = null; });
    return this._entryDiscoveryPromise;
  }

  async loadData() {
    if (!this._hass) return;
    this._state.error = "";
    try {
      const selection = await this.discoverEntry();
      if (!selection.entryId) { this._state.entryStatus = selection.status; this._state.loaded = true; this.render(); return; }
      const entryId = selection.entryId;
      const [profiles, routes, mapConfig] = await Promise.all([
        callWebsocket(this._hass, { type: "camper_route_planner/list_profiles", entry_id: entryId }),
        callWebsocket(this._hass, { type: "camper_route_planner/list_routes", entry_id: entryId }),
        callWebsocket(this._hass, { type: "camper_route_planner/map_config", entry_id: entryId })
      ]);
      this._config = { ...this._config, entry_id: entryId };
      this._state.profiles = Array.isArray(profiles?.profiles) ? profiles.profiles : [];
      this._state.provider = String(profiles?.provider || this._state.provider || "");
      this._state.routes = Array.isArray(routes?.routes) ? routes.routes : [];
      this._state.mapConfig = mapConfig || { provider: "none", status: "not_configured" };
      if (!this._state.profileId && this._state.profiles[0]) this._state.profileId = this._state.profiles[0].profile_id;
      this._state.fuelValues = readFuelValues(this._config.entry_id, this._state.profiles.find((item) => item.profile_id === this._state.profileId));
      if (this._state.profileId && !this._state.originManual) this.useTrackerLocation(false);
    } catch (error) { this._state.error = error.message || t(languageOf(this._hass), "providerUnavailable"); }
    this._state.loaded = true;
    this.render();
  }

  updateFuelField(field, value) {
    if (!FUEL_FIELDS.includes(field)) return;
    this._state.fuelValues = { ...this._state.fuelValues, [field]: value };
    writeFuelValues(this._config.entry_id, this._state.profileId, this._state.fuelValues);
    this.render();
  }

  updateFuelMode(mode) {
    const nextMode = mode === "percent" ? "percent" : "liters";
    const profile = this._state.profiles.find((item) => item.profile_id === this._state.profileId) || {};
    const tank = normalizeDecimalInput(profile.tank_capacity_l, { minimum: 0 }).value;
    const oldMode = this._state.fuelValues.fuel_level_mode === "percent" ? "percent" : "liters";
    const sourceField = oldMode === "percent" ? "fuel_level_pct" : "fuel_level_l";
    const targetField = nextMode === "percent" ? "fuel_level_pct" : "fuel_level_l";
    const current = normalizeDecimalInput(this._state.fuelValues[sourceField], { minimum: 0, maximum: oldMode === "percent" ? 100 : Infinity });
    const values = { ...this._state.fuelValues, fuel_level_mode: nextMode };
    if (current.valid && current.present && Number.isFinite(tank) && tank > 0) {
      const converted = nextMode === "percent" ? current.value / tank * 100 : current.value * tank / 100;
      values[targetField] = String(Math.round(converted * 100) / 100);
    } else if (!current.present) values[targetField] = "";
    this._state.fuelValues = values;
    writeFuelValues(this._config.entry_id, this._state.profileId, values);
    this.render();
  }

  async calculate(forceRefresh = false) {
    if (this._state.busy) return;
    const language = languageOf(this._hass);
    if (!isValidWaypoint(this._state.origin) || !isValidWaypoint(this._state.destination) || this._state.waypoints.some((point) => !isValidWaypoint(point))) { this._state.error = t(language, "invalidCoordinates"); this.render(); return; }
    if (!this._state.profileId) { this._state.error = t(language, "noProfiles"); this.render(); return; }
    this._state.busy = true; this._state.error = ""; this.render();
    try {
      if (this._state.routeOptions.alternatives && this._state.waypoints.length) throw new Error(t(language, "alternativesNoWaypoints"));
      const payload = await calculateRoute(this._hass, { entry_id: this._config.entry_id, profile_id: this._state.profileId, origin: this._state.origin, destination: this._state.destination, via: this._state.waypoints, route_name: this._state.routeName, force_refresh: forceRefresh, ...this._state.routeOptions });
      this._state.result = normalizeServiceResponse(payload);
      this._state.routes = this._state.routes.filter((route) => route.route_id !== this._state.result.route_id);
    } catch (error) { this._state.error = error.message || t(language, "calculationFailed"); }
    this._state.busy = false; this.render();
  }

  async useTrackerLocation(showErrors = true) {
    if (!this._config.entry_id || !this._state.profileId) return;
    try {
      const response = await trackerPosition(this._hass, { entry_id: this._config.entry_id, profile_id: this._state.profileId });
      if (response?.available && response.point && isValidWaypoint(response.point)) {
        this._state.origin = response.point;
        this._inputDrafts.set("point:origin:0:latitude", formatCoordinate(response.point.latitude));
        this._inputDrafts.set("point:origin:0:longitude", formatCoordinate(response.point.longitude));
        this._preserveInputDraftKeys.add("point:origin:0:latitude");
        this._preserveInputDraftKeys.add("point:origin:0:longitude");
        this._state.originManual = false; this._state.trackerError = ""; this.scheduleReverseGeocode("origin", 0, response.point, true);
      }
      else if (showErrors) this._state.trackerError = t(languageOf(this._hass), "trackerUnavailable");
    } catch (_error) { if (showErrors) this._state.trackerError = t(languageOf(this._hass), "trackerUnavailable"); }
    this.render();
  }

  async searchAddress(target, text, slot = 0) {
    const key = `${target}:${slot}`;
    const query = String(text || "");
    this._state.searchTarget = target; this._state.searchSlot = slot; this._state.searchError = "";
    const requestId = (this._searchRequestIds.get(key) || 0) + 1;
    this._searchRequestIds.set(key, requestId);
    if (query.trim().length < 2) { this._state.searchResults = []; this.updateSearchResults(); return; }
    try {
      const response = await geocode(this._hass, { entry_id: this._config.entry_id, text: query.trim(), limit: 5 });
      if (this._searchRequestIds.get(key) !== requestId || this._inputDrafts.get(key) !== query) return;
      this._state.searchResults = response?.results || [];
      if (response && response.configured === false) this._state.searchError = t(languageOf(this._hass), "geocodingNotConfigured");
    } catch (_error) {
      if (this._searchRequestIds.get(key) !== requestId || this._inputDrafts.get(key) !== query) return;
      this._state.searchResults = []; this._state.searchError = t(languageOf(this._hass), "providerUnavailable");
    }
    this.updateSearchResults();
  }

  updateSearchResults() {
    const target = this._state.searchTarget;
    const slot = this._state.searchSlot;
    const container = [...(this.shadowRoot?.querySelectorAll("[data-search-results]") || [])]
      .find((node) => node.dataset.target === target && Number(node.dataset.index) === slot);
    if (!container) return;
    const buttons = this._state.searchResults.map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "select-search";
      button.dataset.target = target;
      button.dataset.index = String(index);
      button.dataset.slot = String(slot);
      button.textContent = item.label || "";
      button.addEventListener("click", () => this.selectSearchResult(target, index, slot));
      return button;
    });
    container.replaceChildren(...buttons);
    container.classList.toggle("search-results", buttons.length > 0);
    const error = this.shadowRoot.querySelector("[data-search-error]");
    if (error) {
      error.textContent = this._state.searchError || "";
      error.hidden = !this._state.searchError;
    }
  }

  selectSearchResult(target, index, slot = this._state.searchSlot) {
    const rawPoint = this._state.searchResults[index];
    const point = rawPoint && {
      ...rawPoint,
      address: rawPoint.address || rawPoint.label || "",
      latitude: Number(rawPoint.latitude ?? rawPoint.lat),
      longitude: Number(rawPoint.longitude ?? rawPoint.lon),
    };
    if (!point || !isValidWaypoint(point)) return;
    if (target === "waypoint") { this._state.waypoints[slot] = { ...point }; }
    else { this._state[target] = { ...point }; if (target === "origin") this._state.originManual = true; }
    // render() snapshots the current DOM inputs before replacing them. Seed
    // the selected coordinates so stale 0/0 drafts cannot overwrite the
    // chosen geocoding result during that snapshot.
    this._inputDrafts.set(`point:${target}:${slot}:latitude`, formatCoordinate(point.latitude));
    this._inputDrafts.set(`point:${target}:${slot}:longitude`, formatCoordinate(point.longitude));
    this._preserveInputDraftKeys.add(`point:${target}:${slot}:latitude`);
    this._preserveInputDraftKeys.add(`point:${target}:${slot}:longitude`);
    this._inputDrafts.delete(`${target}:${slot}`);
    this._state.searchResults = []; this._state.searchTarget = target;
    this.updateSelectedPointDom(target, slot, point);
    updateMapPoints(this.shadowRoot?.querySelector(".crp-map"), this.mapPoints(), { start: t(languageOf(this._hass), "start"), destination: t(languageOf(this._hass), "destination"), waypoint: t(languageOf(this._hass), "waypoint"), previewLine: t(languageOf(this._hass), "previewLine") }, { route: this._state.result, fitBounds: true, onPointChange: (changedTarget, changedIndex, latlng) => this.onMapPointChange(changedTarget, changedIndex, latlng) });
    this.updateSearchResults();
  }

  updateSelectedPointDom(target, index, point) {
    const input = this.shadowRoot?.querySelector(`input[data-point="${target}"][data-index="${index}"][data-field="latitude"]`);
    const longitude = this.shadowRoot?.querySelector(`input[data-point="${target}"][data-index="${index}"][data-field="longitude"]`);
    if (!input || !longitude) return;
    input.value = formatCoordinate(point.latitude);
    longitude.value = formatCoordinate(point.longitude);
    const row = input.closest(".point-row");
    const searchRow = row?.parentElement?.querySelector(`.search-row input[data-search-input="${target}"][data-index="${index}"]`)?.parentElement;
    if (!row || !searchRow) return;
    let address = row.nextElementSibling?.classList.contains("point-address") ? row.nextElementSibling : null;
    if (!address) {
      address = document.createElement("small");
      address.className = "point-address";
      searchRow.before(address);
    }
    address.textContent = point.address || t(languageOf(this._hass), "addressUnavailable");
  }

  captureInputState() {
    const active = this.shadowRoot?.activeElement;
    const activeKey = active?.dataset?.searchInput
      ? `search:${active.dataset.searchInput}:${active.dataset.index}`
      : active?.dataset?.point
        ? `point:${active.dataset.point}:${active.dataset.index}:${active.dataset.field}`
        : active?.dataset?.fuelField
          ? `fuel:${active.dataset.fuelField}`
        : active?.dataset?.field || "";
    this.shadowRoot?.querySelectorAll("input[data-search-input]").forEach((input) => {
      this._inputDrafts.set(`${input.dataset.searchInput}:${input.dataset.index}`, input.value);
    });
    this.shadowRoot?.querySelectorAll("input[data-point]").forEach((input) => {
      const key = `point:${input.dataset.point}:${input.dataset.index}:${input.dataset.field}`;
      if (!this._preserveInputDraftKeys.has(key)) this._inputDrafts.set(key, input.value);
    });
    return { activeKey, selectionStart: active?.selectionStart, selectionEnd: active?.selectionEnd };
  }

  restoreInputState(state) {
    this.shadowRoot?.querySelectorAll("input[data-search-input]").forEach((input) => {
      const value = this._inputDrafts.get(`${input.dataset.searchInput}:${input.dataset.index}`);
      if (value !== undefined) input.value = value;
    });
    this.shadowRoot?.querySelectorAll("input[data-point]").forEach((input) => {
      const value = this._inputDrafts.get(`point:${input.dataset.point}:${input.dataset.index}:${input.dataset.field}`);
      if (value !== undefined) input.value = value;
    });
    if (!state?.activeKey) return;
    let input;
    if (state.activeKey.startsWith("search:")) {
      const [, target, index] = state.activeKey.split(":");
      input = this.shadowRoot?.querySelector(`input[data-search-input="${target}"][data-index="${index}"]`);
    } else if (state.activeKey.startsWith("point:")) {
      const [, target, index, field] = state.activeKey.split(":");
      input = this.shadowRoot?.querySelector(`input[data-point="${target}"][data-index="${index}"][data-field="${field}"]`);
    } else if (state.activeKey.startsWith("fuel:")) input = this.shadowRoot?.querySelector(`input[data-fuel-field="${state.activeKey.slice(5)}"]`);
    else input = this.shadowRoot?.querySelector(`input[data-field="${state.activeKey}"]`);
    if (input) {
      input.focus({ preventScroll: true });
      if (state.selectionStart != null) input.setSelectionRange(state.selectionStart, state.selectionEnd ?? state.selectionStart);
    }
  }

  scheduleReverseGeocode(target, index, point, immediate = false) {
    if (!isValidWaypoint(point) || !this._config.entry_id) return;
    const key = `${target}:${index}`;
    clearTimeout(this._reverseTimers.get(key));
    const run = () => this.resolvePointAddress(target, index, point);
    this._reverseTimers.set(key, immediate ? null : setTimeout(run, 350));
    if (immediate) run();
  }

  async resolvePointAddress(target, index, point) {
    try {
      const response = await reverseGeocode(this._hass, { entry_id: this._config.entry_id, latitude: Number(point.latitude), longitude: Number(point.longitude) });
      const current = target === "waypoint" ? this._state.waypoints[index] : this._state[target];
      if (!current || Number(current.latitude) !== Number(point.latitude) || Number(current.longitude) !== Number(point.longitude)) return;
      // Preserve a selected search label when reverse geocoding is empty or
      // unavailable; only a usable response may replace it.
      if (response?.configured && response.address) current.address = response.address;
      this.render();
    } catch (_error) {
      const current = target === "waypoint" ? this._state.waypoints[index] : this._state[target];
      if (current && Number(current.latitude) === Number(point.latitude) && Number(current.longitude) === Number(point.longitude)) this.render();
    }
  }

  async saveCurrent() {
    if (!this._state.result || !this._hass) return;
    const record = routeRecordFromResult(this._state.result, this._state);
    this._state.busy = true; this.render();
    try { await callWebsocket(this._hass, { type: "camper_route_planner/save_route", entry_id: this._config.entry_id, route: record }); this._state.routes = [record, ...this._state.routes.filter((route) => route.route_id !== record.route_id)]; this._state.result.route_id = record.route_id; }
    catch (error) { this._state.error = error.message || t(languageOf(this._hass), "calculationFailed"); }
    this._state.busy = false; this.render();
  }

  async loadRoute(routeId) {
    try { const response = await callWebsocket(this._hass, { type: "camper_route_planner/load_route", entry_id: this._config.entry_id, route_id: routeId }); const route = response.route; this._state.origin = route.origin || this._state.origin; this._state.destination = route.destination || this._state.destination; this._state.waypoints = route.waypoints || []; this._state.profileId = route.profile_id || this._state.profileId; this._state.fuelValues = readFuelValues(this._config.entry_id, this._state.profiles.find((item) => item.profile_id === this._state.profileId)); this._state.routeOptions = { ...this._state.routeOptions, ...(route.route_options || route.metadata?.request_options || {}) }; this._state.result = normalizeServiceResponse(route); this.render(); }
    catch (error) { this._state.error = error.message || t(languageOf(this._hass), "calculationFailed"); this.render(); }
  }

  async deleteRoute(routeId) {
    if (!globalThis.confirm?.(t(languageOf(this._hass), "confirmation"))) return;
    try { await callWebsocket(this._hass, { type: "camper_route_planner/delete_route", entry_id: this._config.entry_id, route_id: routeId }); this._state.routes = this._state.routes.filter((route) => route.route_id !== routeId); this.render(); }
    catch (error) { this._state.error = error.message || t(languageOf(this._hass), "calculationFailed"); this.render(); }
  }

  async exportRoute(mode, savedRoute = null) {
    const language = languageOf(this._hass);
    const route = savedRoute || (this._state.result ? routeRecordFromResult(this._state.result, this._state) : null);
    if (!route) { this._state.error = t(language, "exportFailed"); this.render(); return; }
    if ((mode === "track" || mode === "combined") && !hasTrackGeometry(route)) { this._state.error = t(language, "exportNoGeometry"); this.render(); return; }
    try {
      const payload = await exportGpx(this._hass, { entry_id: this._config.entry_id, mode, route });
      await deliverGpxExport(payload);
      this._state.error = "";
    } catch (error) { this._state.error = error.message || t(language, "exportFailed"); }
    this.render();
  }

  async exportPdf(savedRoute = null) {
    const language = languageOf(this._hass);
    const result = savedRoute || this._state.result;
    const profileId = savedRoute?.profile_id || this._state.profileId;
    const profile = this._state.profiles.find((item) => item.profile_id === profileId);
    const state = savedRoute ? { ...this._state, profileId, origin: savedRoute.origin || this._state.origin, destination: savedRoute.destination || this._state.destination, waypoints: savedRoute.waypoints || [] } : this._state;
    if (!result) {
      this._state.error = t(language, "pdfNoRoute");
      this.render();
      return;
    }
    try {
      const bytes = await createTravelPlanPdf({ language, profile, state, result, title: this._config.title, routeName: savedRoute?.name || this._state.routeName });
      const filename = pdfFileName(savedRoute?.name || this._state.routeName || profile?.name || "Camper");
      downloadPdf(bytes, filename);
      this._state.error = "";
    } catch (error) {
      this._state.error = error.message || t(language, "pdfExportFailed");
    }
    this.render();
  }

  openNavigation() {
    const language = languageOf(this._hass);
    const target = this._state.result ? buildNavigationLink(this._state.result, this._state, navigationPlatform()) : null;
    if (!target) {
      this._state.error = t(language, "navigationUnavailable");
      this.render();
      return;
    }
    // The route is already available locally. Opening the platform URI must
    // not calculate or fetch another route.
    if (target.omittedWaypoints) this._state.navigationNotice = t(language, "navigationWaypointsUnsupported");
    if (globalThis.location?.assign) globalThis.location.assign(target.url);
  }

  updatePoint(target, index, field, value) { const list = target === "waypoint" ? [...this._state.waypoints] : [{ ...this._state[target] }]; const point = target === "waypoint" ? { ...list[index] } : list[0]; point[field] = value; point.address = ""; if (target === "waypoint") list[index] = point; else { this._state[target] = point; if (target === "origin") this._state.originManual = true; } if (target === "waypoint") this._state.waypoints = list; this.render(); this.scheduleReverseGeocode(target, index, point); }

  mapPoints() { return [{ ...this._state.origin, target: "origin" }, ...this._state.waypoints.map((point, index) => ({ ...point, target: "waypoint", index })), { ...this._state.destination, target: "destination" }].filter((point) => isValidWaypoint(point)); }

  providerLabel(provider, language) {
    const key = provider === "mock" ? "providerName.mock" : provider === "nakordoni" || provider === "nakordoni_motorhome" ? "providerName.nakordoni" : "providerName.unknown";
    return t(language, key);
  }

  statusLine(profile, language) {
    const vehicle = profile?.name || t(language, "noProfiles");
    const provider = this.providerLabel(this._state.provider || this._state.result?.provider, language);
    return `${vehicle} · ${provider} · ${t(language, "manualOnly")}`;
  }

  handleCardToggle(details) {
    this._cardExpanded = Boolean(details.open);
    details.querySelector("summary")?.setAttribute("aria-expanded", String(this._cardExpanded));
    if (!this._cardExpanded) return;
    requestAnimationFrame(() => invalidateMapSize(this.shadowRoot?.querySelector(".crp-map")));
  }

  wrapCardContent(profile, language) {
    const card = this.shadowRoot?.querySelector("ha-card");
    const content = card?.querySelector(".content");
    if (!card || !content) return;
    content.querySelector("header")?.remove();
    content.id = "route-planner-content";
    const details = document.createElement("details");
    details.className = "route-planner-shell";
    details.open = this._cardExpanded;
    const summary = document.createElement("summary");
    summary.className = "route-planner-summary";
    summary.setAttribute("aria-controls", content.id);
    summary.setAttribute("aria-expanded", String(this._cardExpanded));
    const copy = document.createElement("span");
    copy.className = "summary-copy";
    const title = document.createElement("h2");
    title.textContent = this._config.title;
    const status = document.createElement("span");
    status.className = "subtle status-line";
    status.textContent = this.statusLine(profile, language);
    copy.append(title, status);
    const actions = document.createElement("span");
    actions.className = "summary-actions";
    const dot = document.createElement("span");
    dot.className = `status-dot ${this._state.loaded ? "ready" : "loading"}`;
    dot.setAttribute("aria-hidden", "true");
    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "▸";
    actions.append(dot, chevron);
    summary.append(copy, actions);
    details.append(summary, content);
    card.replaceChildren(details);
    details.addEventListener("toggle", () => this.handleCardToggle(details));
  }

  onMapPointChange(target, index, latlng) {
    const point = target === "waypoint" ? { ...this._state.waypoints[index] } : { ...this._state[target] };
    point.latitude = latlng.lat; point.longitude = latlng.lng; point.address = "";
    this._inputDrafts.delete(`point:${target}:${index}:latitude`); this._inputDrafts.delete(`point:${target}:${index}:longitude`);
    if (target === "waypoint") this._state.waypoints[index] = point; else { this._state[target] = point; if (target === "origin") this._state.originManual = true; }
    this.render(); this.scheduleReverseGeocode(target, index, point);
  }

  renderPoint(point, target, index = 0) { const address = isValidWaypoint(point) ? (point.address || t(languageOf(this._hass), "addressUnavailable")) : ""; const coordinate = (field) => this._inputDrafts.get(`point:${target}:${index}:${field}`) ?? formatCoordinate(point[field]); return `<div class="point-row"><label>${t(languageOf(this._hass), "latitude")}<input data-point="${target}" data-index="${index}" data-field="latitude" type="number" step="any" value="${escapeHtml(coordinate("latitude"))}"></label><label>${t(languageOf(this._hass), "longitude")}<input data-point="${target}" data-index="${index}" data-field="longitude" type="number" step="any" value="${escapeHtml(coordinate("longitude"))}"></label>${target === "waypoint" ? `<button data-action="up" data-index="${index}" aria-label="${t(languageOf(this._hass), "moveUp")}">↑</button><button data-action="down" data-index="${index}" aria-label="${t(languageOf(this._hass), "moveDown")}">↓</button><button data-action="remove" data-index="${index}">${t(languageOf(this._hass), "remove")}</button>` : ""}</div>${address ? `<small class="point-address">${escapeHtml(address)}</small>` : ""}`; }

  render() {
    const language = languageOf(this._hass); const translate = (key) => t(language, key); const profile = this._state.profiles.find((item) => item.profile_id === this._state.profileId); const result = this._state.result;
    const currentShell = this.shadowRoot?.querySelector("details.route-planner-shell");
    if (currentShell) this._cardExpanded = Boolean(currentShell.open);
    const inputState = this.captureInputState();
    const oldMap = this.shadowRoot?.querySelector(".crp-map");
    const preserveMap = Boolean(oldMap?.classList.contains("leaflet-container") && this._state.mapConfig?.provider === "carto" && this._state.mapConfig?.status === "configured");
    if (preserveMap) oldMap.remove();
    else destroyMap(oldMap);
    if (!this._config.entry_id) { const message = this._state.entryStatus === "multiple" ? translate("multipleEntries") : translate("configMissing"); this.shadowRoot.innerHTML = `<ha-card><div class="content"><p>${message}</p></div></ha-card>`; return; }
    const searchResultButtons = this._state.searchResults.map((item, index) => `<button type="button" data-action="select-search" data-target="${this._state.searchTarget}" data-index="${index}" data-slot="${this._state.searchSlot}">${escapeHtml(item.label)}</button>`).join("");
    const pointEditor = (point, target, index = 0) => {
      const activeResults = target === this._state.searchTarget && index === this._state.searchSlot ? searchResultButtons : "";
      const resultClass = activeResults ? " class=\"search-results\"" : "";
      return `${this.renderPoint(point, target, index)}<div class="search-row"><input data-search-input="${target}" data-index="${index}" placeholder="${translate("searchPlaceholder")}" aria-label="${translate("search")}"><button type="button" data-action="search" data-target="${target}" data-index="${index}">${translate("search")}</button></div><div data-search-results data-target="${target}" data-index="${index}"${resultClass}>${activeResults}</div>`;
    };
    const vehicleKind = profile ? translate(`vehicleKind.${profile.vehicle_kind}`) : "";
    const fuelType = profile ? translate(`fuelType.${profile.fuel_type}`) : "";
    const navigationTarget = result ? buildNavigationLink(result, this._state, navigationPlatform()) : null;
    this.shadowRoot.innerHTML = `<style>${LEAFLET_CSS}${STYLES}${RESPONSIVE_STYLES}</style><ha-card><div class="content"><header><div><h2>${escapeHtml(this._config.title)}</h2><p class="subtle">${translate("manualOnly")}</p></div><span class="status-dot ${this._state.loaded ? "ready" : "loading"}"></span></header><section class="grid"><div class="panel"><h3>${translate("vehicle")}</h3><select data-action="profile" aria-label="${translate("vehicle")}"><option value="">${translate("noProfiles")}</option>${this._state.profiles.map((item) => `<option value="${escapeHtml(item.profile_id)}" ${item.profile_id === this._state.profileId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>${profile ? `<dl class="facts"><div><dt>H × W × L</dt><dd>${profile.height_m} × ${profile.width_m} × ${profile.length_m} m</dd></div><div><dt>kg</dt><dd>${profile.gross_weight_kg}</dd></div><div><dt>${translate("profileDetails")}</dt><dd>${escapeHtml(vehicleKind)} · ${escapeHtml(fuelType)}${profile.emission_class ? ` · ${escapeHtml(profile.emission_class.toUpperCase())}` : ""}</dd></div></dl><button type="button" data-action="tracker">${translate("useVehicleLocation")}</button>` : ""}</div><div class="panel"><h3>${translate("start")}</h3>${pointEditor(this._state.origin, "origin")}${this._state.trackerError ? `<p class="subtle">${translate("trackerUnavailable")}</p>` : ""}</div><div class="panel"><h3>${translate("destination")}</h3>${pointEditor(this._state.destination, "destination")}</div><div class="panel waypoints"><h3>${translate("waypoint")}</h3>${this._state.waypoints.map((point, index) => pointEditor(point, "waypoint", index)).join("")}<button type="button" data-action="add">＋ ${translate("addWaypoint")}</button></div></section><p class="subtle" data-search-error hidden></p><p class="privacy">${translate("geocodingPrivacy")}</p><section class="map-section"><h3>${translate("map")}</h3><div class="map-host"></div></section><div class="actions"><button type="button" class="primary" data-action="calculate" ${this._state.busy ? "disabled" : ""}>${this._state.busy ? translate("calculating") : translate("calculate")}</button>${result ? `<button type="button" data-action="calculate-force" ${this._state.busy ? "disabled" : ""}>${translate("recalculate")}</button>` : ""}<input data-field="routeName" value="${escapeHtml(this._state.routeName)}" aria-label="${translate("save")}"><button type="button" data-action="save" ${!result || this._state.busy ? "disabled" : ""}>${this._state.busy ? translate("saving") : translate("save")}</button></div>${this._state.error ? `<p class="error" role="alert">${escapeHtml(this._state.error)}</p>` : ""}${this._state.mapError ? `<p class="error" role="alert">${escapeHtml(this._state.mapError)}</p>` : ""}<section class="result"><h3>${result ? `${translate("provider")}: ${escapeHtml(result.provider)}` : translate("noRoute")}</h3>${result ? `<div class="metrics"><div><b>${formatDistance(result.distance_m, language)}</b><span>${translate("distance")}</span></div><div><b>${formatDuration(result.duration_s, language)}</b><span>${translate("duration")}</span></div></div>${result.metadata?.cache_hit ? `<p class="notice">${translate("cachedRouteNotice")}</p>` : ""}<div class="export-actions"><button type="button" data-action="export" data-mode="route">${translate("exportRoute")}</button><button type="button" data-action="export" data-mode="track" ${hasTrackGeometry(result) ? "" : "disabled"}>${translate("exportTrack")}</button><button type="button" data-action="export" data-mode="combined" ${hasTrackGeometry(result) ? "" : "disabled"}>${translate("exportCombined")}</button><button type="button" data-action="pdf">${translate("pdfExport")}</button></div><div class="navigation-actions"><button type="button" data-action="navigation" ${navigationTarget ? "" : "disabled"}>🧭 ${translate("openNavigation")}</button>${navigationTarget?.omittedWaypoints ? `<p class="subtle">${translate("navigationWaypointsUnsupported")}</p>` : ""}<p class="notice">${translate("navigationSafety")}</p></div>${result.synthetic ? `<p class="notice">${translate("mockDataNotice")}</p>` : ""}` : ""}</section><section class="saved"><h3>${translate("savedRoutes")}</h3>${this._state.routes.length ? this._state.routes.map((route) => `<div class="saved-row"><span>${escapeHtml(route.name || route.route_id)} · ${formatDistance(route.distance_m, language)}</span><button type="button" data-action="load" data-route-id="${escapeHtml(route.route_id)}">${translate("load")}</button><button type="button" data-action="export" data-mode="route" data-route-id="${escapeHtml(route.route_id)}">${translate("exportRoute")}</button><button type="button" data-action="delete" data-route-id="${escapeHtml(route.route_id)}">${translate("delete")}</button></div>`).join("") : `<p class="subtle">${translate("noRoute")}</p>`}</section></div></ha-card>`;
    const optionAnchor = this.shadowRoot.querySelector(".map-section");
    optionAnchor?.insertAdjacentHTML("beforebegin", `<details class="route-options" open><summary><h3>${translate("routeOptions")}</h3></summary><div class="option-grid"><label>${translate("trafficModeLabel")}<select data-route-option="traffic"><option value="off">${translate("trafficMode.off")}</option><option value="live">${translate("trafficMode.live")}</option><option value="forecast">${translate("trafficMode.forecast")}</option></select></label><label>${translate("routeType")}<select data-route-option="route_type"><option value="fastest">${translate("fastest")}</option><option value="eco">${translate("eco")}</option></select></label><label>${translate("alternatives")}<select data-route-option="alternatives"><option value="0">0</option><option value="1">1</option><option value="2">2</option></select></label><label>${translate("departAt")}<input type="datetime-local" data-route-option="depart_at"></label><label>${translate("arriveAt")}<input type="datetime-local" data-route-option="arrive_at"></label></div><p class="subtle">${translate("plannedRequest")}</p><div class="avoid-options"><label><input type="checkbox" data-route-option="avoid" value="tolls"> <span>${translate("avoidTolls")}</span></label><label><input type="checkbox" data-route-option="avoid" value="motorways"> <span>${translate("avoidMotorways")}</span></label><label><input type="checkbox" data-route-option="avoid" value="ferries"> <span>${translate("avoidFerries")}</span></label><label><input type="checkbox" data-route-option="avoid" value="tunnels"> <span>${translate("avoidTunnels")}</span></label></div></details>`);
    this.shadowRoot.querySelectorAll("[data-route-option]").forEach((input) => { const key = input.dataset.routeOption; if (key === "avoid") input.checked = this._state.routeOptions.avoid.includes(input.value); else input.value = this._state.routeOptions[key] ?? ""; });
    const fuelHost = result ? this.shadowRoot.querySelector(".result") : this.shadowRoot.querySelector(".map-section");
    fuelHost?.insertAdjacentHTML(result ? "beforeend" : "beforebegin", `${result ? renderRestrictions(result, translate) : ""}${renderFuelPlan(result, profile, this._state.fuelValues, translate, language)}`);
    this.shadowRoot.querySelectorAll(".saved-row").forEach((row) => {
      const exportButton = row.querySelector('button[data-action="export"][data-mode="route"]');
      const routeId = exportButton?.dataset.routeId;
      if (!routeId || row.querySelector('button[data-action="pdf"]')) return;
      const pdfButton = document.createElement("button");
      pdfButton.type = "button";
      pdfButton.dataset.action = "pdf";
      pdfButton.dataset.routeId = routeId;
      pdfButton.textContent = translate("pdfExport");
      exportButton.after(pdfButton);
    });
    this.wrapCardContent(profile, language);
    // Replace the rendered control with a real user-activated anchor. This
    // mirrors Mobile Fuel Stations and avoids popup/WebView restrictions from
    // programmatic navigation while keeping the existing button appearance.
    if (navigationTarget) {
      const navigationButton = this.shadowRoot.querySelector('button[data-action="navigation"]');
      if (navigationButton) {
        const navigationLink = document.createElement("a");
        navigationLink.className = "navigation-link";
        navigationLink.dataset.action = "navigation";
        navigationLink.href = navigationTarget.url;
        navigationLink.target = "_blank";
        navigationLink.rel = "noopener noreferrer";
        navigationLink.textContent = navigationButton.textContent;
        navigationLink.style.cssText = "display:flex;align-items:center;justify-content:center;min-height:44px;padding:8px 12px;border:1px solid var(--divider-color,#bbb);border-radius:8px;background:var(--secondary-background-color,#f5f5f5);color:inherit;text-decoration:none;font-weight:600;";
        navigationButton.replaceWith(navigationLink);
      }
    }
    if (result?.provider === "nakordoni_motorhome") {
      const resultPanel = this.shadowRoot.querySelector(".result");
      resultPanel?.insertAdjacentHTML("afterbegin", `<div class="notice beta-notice"><b>${translate("motorhomeBeta")}</b><br>${translate("motorhomeWarning")}<br><a href="${escapeHtml(result.attribution_url || "https://nakordoni.eu")}" target="_blank" rel="noreferrer">${translate("dataByNakordoni")}</a></div>`);
      resultPanel?.insertAdjacentHTML("beforeend", `${renderBorderCrossings(result, translate)}${renderTollDetails(result, translate, language)}`);
    }
    this.shadowRoot.querySelector(".privacy")?.insertAdjacentHTML("beforeend", ` <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">${translate("geocodingAttribution")}</a>`);
    const mapLabels = { noRoute: translate("noRoute"), mapLoading: translate("mapLoading"), mapUnavailable: translate("mapUnavailable"), geometryFallback: translate("geometryFallback"), start: translate("start"), destination: translate("destination"), waypoint: translate("waypoint"), previewLine: translate("previewLine"), borderCrossing: translate("borderName"), borderNoWait: translate("borderNoWait") };
    const mapOptions = { points: this.mapPoints(), route: result, borderCrossings: result?.metadata?.border_crossings || [], restrictionItems: [...(result?.metadata?.restriction_hits || []), ...(result?.metadata?.low_emission_zones_on_route || [])], fitBounds: this._fitMapOnNextRender, onPointChange: (target, index, latlng) => this.onMapPointChange(target, index, latlng), onMapClick: (latlng) => this.onMapPointChange("origin", 0, latlng) };
    const mapHost = this.shadowRoot.querySelector(".map-host");
    if (preserveMap) {
      mapHost.append(oldMap);
      updateMapPoints(oldMap, mapOptions.points, mapLabels, mapOptions);
    } else {
      renderMap(mapHost, result, this._state.mapConfig, mapLabels, () => { this._state.mapError = translate("mapTileError"); this._state.mapConfig = { ...(this._state.mapConfig || {}), status: "invalid" }; this.render(); }, mapOptions);
    }
    // The DOM is rebuilt for the card controls while the Leaflet host is
    // preserved separately. Rebind every control after each render so
    // search, waypoint, and route actions remain usable after DOM updates.
    this.bindEvents();
    this._fitMapOnNextRender = false;
    this.restoreInputState(inputState);
    this._preserveInputDraftKeys.clear();
    if (this._cardExpanded) requestAnimationFrame(() => invalidateMapSize(this.shadowRoot?.querySelector(".crp-map")));
  }

  bindEvents() {
    this.shadowRoot.querySelectorAll("[data-route-option]").forEach((input) => input.addEventListener("change", () => {
      const key = input.dataset.routeOption;
      if (key === "avoid") this._state.routeOptions.avoid = [...this.shadowRoot.querySelectorAll('input[data-route-option="avoid"]:checked')].map((item) => item.value);
      else this._state.routeOptions[key] = key === "alternatives" ? Number(input.value) : input.value;
    }));
    this.shadowRoot.querySelectorAll("input[data-point]").forEach((input) => input.addEventListener("input", (event) => this.updatePoint(event.target.dataset.point, Number(event.target.dataset.index), event.target.dataset.field, event.target.value)));
    this.shadowRoot.querySelector("select[data-action=profile]")?.addEventListener("change", (event) => { this._state.profileId = event.target.value; this._state.fuelValues = readFuelValues(this._config.entry_id, this._state.profiles.find((item) => item.profile_id === this._state.profileId)); this._state.originManual = false; this.useTrackerLocation(false); this.render(); });
    this.shadowRoot.querySelectorAll("input[data-fuel-field]").forEach((input) => input.addEventListener("input", () => this.updateFuelField(input.dataset.fuelField, input.value)));
    this.shadowRoot.querySelector("select[data-fuel-mode]")?.addEventListener("change", (event) => this.updateFuelMode(event.target.value));
    this.shadowRoot.querySelectorAll("button[data-action=tracker]").forEach((button) => button.addEventListener("click", () => this.useTrackerLocation(true)));
    this.shadowRoot.querySelectorAll("button[data-action=search]").forEach((button) => button.addEventListener("click", () => { const input = this.shadowRoot.querySelector(`input[data-search-input="${button.dataset.target}"][data-index="${button.dataset.index}"]`); input?.focus({ preventScroll: true }); this.searchAddress(button.dataset.target, input?.value, Number(button.dataset.index)); }));
    this.shadowRoot.querySelectorAll("input[data-search-input]").forEach((input) => input.addEventListener("input", () => {
      const key = `${input.dataset.searchInput}:${input.dataset.index}`;
      this._inputDrafts.set(key, input.value);
      this._searchRequestIds.set(key, (this._searchRequestIds.get(key) || 0) + 1);
      clearTimeout(input._crpSearchTimer);
      input._crpSearchTimer = setTimeout(() => this.searchAddress(input.dataset.searchInput, input.value, Number(input.dataset.index)), 350);
    }));
    this.shadowRoot.querySelectorAll("button[data-action=select-search]").forEach((button) => button.addEventListener("click", () => this.selectSearchResult(button.dataset.target, Number(button.dataset.index), Number(button.dataset.slot ?? this._state.searchSlot))));
    this.shadowRoot.querySelector("input[data-field=routeName]")?.addEventListener("change", (event) => { this._state.routeName = event.target.value; });
    this.shadowRoot.querySelectorAll("button[data-action]").forEach((button) => button.addEventListener("click", () => { const action = button.dataset.action; const index = Number(button.dataset.index); if (action === "calculate") this.calculate(); if (action === "calculate-force") this.calculate(true); if (action === "save") this.saveCurrent(); if (action === "export") this.exportRoute(button.dataset.mode, this._state.routes.find((route) => route.route_id === button.dataset.routeId)); if (action === "pdf") this.exportPdf(button.dataset.routeId ? this._state.routes.find((route) => route.route_id === button.dataset.routeId) : null); if (action === "navigation") this.openNavigation(); if (action === "add") { this._state.waypoints = addWaypoint(this._state.waypoints); this._fitMapOnNextRender = true; this.render(); } if (action === "remove") { this._state.waypoints = removeWaypoint(this._state.waypoints, index); this._fitMapOnNextRender = true; this.render(); } if (action === "up") { this._state.waypoints = moveWaypoint(this._state.waypoints, index, -1); this._fitMapOnNextRender = true; this.render(); } if (action === "down") { this._state.waypoints = moveWaypoint(this._state.waypoints, index, 1); this._fitMapOnNextRender = true; this.render(); } if (action === "load") this.loadRoute(button.dataset.routeId); if (action === "delete") this.deleteRoute(button.dataset.routeId); }));
  }
}

const STYLES = `:host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif)}ha-card{overflow:hidden}.route-planner-shell{margin:0}.route-planner-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px;padding:12px 16px;cursor:pointer;list-style:none;touch-action:manipulation}.route-planner-summary::-webkit-details-marker{display:none}.route-planner-summary:focus-visible{outline:2px solid var(--primary-color);outline-offset:-2px}.summary-copy{display:grid;gap:3px;min-width:0}.summary-copy h2{margin:0;font-size:1.25rem}.status-line{overflow-wrap:anywhere}.summary-actions{display:flex;align-items:center;gap:12px;flex:0 0 auto}.chevron{font-size:1.35rem;line-height:1;transition:transform .15s ease}.route-planner-shell[open] .chevron{transform:rotate(90deg)}.content{padding:16px;border-top:1px solid var(--divider-color,#ddd)}header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}h2,h3{margin:0 0 8px}h2{font-size:1.25rem}h3{font-size:1rem}.subtle,small,.privacy{color:var(--secondary-text-color);font-size:.82rem}.status-dot{width:10px;height:10px;border-radius:50%;background:var(--disabled-text-color)}.status-dot.ready{background:var(--success-color,#43a047)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.panel{border:1px solid var(--divider-color,#ddd);border-radius:12px;padding:12px}select,input{box-sizing:border-box;max-width:100%;min-height:38px;padding:7px 9px;border:1px solid var(--divider-color,#bbb);border-radius:8px;background:var(--card-background-color,#fff);color:inherit}select{width:100%}.point-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;margin-bottom:8px}.point-row label{display:flex;flex-direction:column;gap:4px;font-size:.8rem}.point-row button{min-height:34px}.search-row{display:flex;gap:6px}.search-row input{flex:1;min-width:0}.search-results{display:grid;gap:4px;margin:8px 0}.search-results button{text-align:left}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0;font-size:.8rem}.facts div{background:var(--secondary-background-color,#f5f5f5);padding:8px;border-radius:8px}.facts dt{color:var(--secondary-text-color)}.facts dd{margin:3px 0 0}.actions,.export-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0}.actions input{flex:1;min-width:120px}.actions button,.export-actions button,button{cursor:pointer;border:1px solid var(--divider-color,#bbb);background:var(--secondary-background-color,#f5f5f5);color:inherit;border-radius:8px;padding:8px 12px;min-height:42px}.actions .primary{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);border:0;font-weight:600}.route-options{margin:12px 0;padding:10px;border:1px solid var(--divider-color,#ddd);border-radius:9px}.route-options summary{cursor:pointer;min-height:28px}.option-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px;margin:10px 0}.option-grid label{display:grid;gap:4px;min-width:0}.avoid-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:8px}.avoid-options label{display:flex;align-items:center;gap:8px;min-height:42px;line-height:1.25;overflow-wrap:anywhere}.avoid-options input{flex:0 0 auto;min-width:22px;min-height:22px}.fuel-profile-facts,.fuel-input-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px;margin:10px 0}.fuel-profile-facts span{display:grid;gap:2px;padding:8px;border-radius:8px;background:var(--secondary-background-color,#f5f5f5)}.fuel-input{display:grid;gap:4px;min-width:0;line-height:1.25}.fuel-input input{width:100%}.error{padding:10px;border-radius:8px;color:var(--error-color,#d32f2f);background:color-mix(in srgb,var(--error-color,#d32f2f) 12%,transparent)}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.metrics div{padding:10px;border-radius:9px;background:var(--secondary-background-color,#f5f5f5)}.metrics b,.metrics span{display:block}.metrics span{font-size:.8rem;color:var(--secondary-text-color)}.crp-map{margin-top:12px;overflow:hidden;border-radius:12px;background:var(--secondary-background-color,#f5f5f5);touch-action:none;min-height:220px}.crp-map>svg{display:block;width:100%;min-height:220px;transition:transform .12s ease}.crp-map small{display:block;padding:6px 10px}.crp-leaflet-map{height:340px}.leaflet-container{font:inherit;background:var(--secondary-background-color,#f5f5f5)}.crp-marker{background:transparent;border:0}.crp-marker span{display:flex;width:28px;height:28px;align-items:center;justify-content:center;border:3px solid #fff;border-radius:50% 50% 50% 0;box-shadow:0 2px 5px #0008;color:#fff;font-size:.8rem;font-weight:700;transform:rotate(-45deg)}.crp-marker span::first-letter{transform:rotate(45deg)}.crp-marker-start span{background:#43a047}.crp-marker-destination span{background:#e53935}.crp-marker-waypoint span{background:#fb8c00}.export-panel{margin-top:12px;padding:10px;border-radius:9px;background:var(--secondary-background-color,#f5f5f5)}.notice,.warnings{padding:9px;border-radius:8px;background:var(--secondary-background-color,#f5f5f5);font-size:.86rem}.warnings ul{margin:6px 0 0;padding-left:20px}.navigation-actions{display:grid;gap:8px;margin-top:12px}.navigation-actions button{min-height:44px;font-weight:600}.navigation-actions p{margin:0}.saved{margin-top:16px}.saved-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--divider-color,#ddd);font-size:.88rem}.saved-row span{flex:1;overflow:hidden;text-overflow:ellipsis}@media(max-width:600px){.content{padding:12px}.grid{grid-template-columns:1fr}.facts,.metrics{grid-template-columns:1fr 1fr}.point-row{grid-template-columns:1fr 1fr}.export-actions button{flex:1;min-width:0}.actions>*{flex:1 1 auto;min-width:0}.saved-row{flex-wrap:wrap}.saved-row span{flex-basis:100%}}`;
const RESPONSIVE_STYLES = `:host{max-width:100%;box-sizing:border-box}ha-card{max-width:100%;box-sizing:border-box}.content{min-width:0;max-width:100%;box-sizing:border-box}.crp-map{contain:paint}.grid,.facts,.metrics,.panel,.saved-row,.actions,.route-details{min-width:0}.route-details{margin-top:12px;padding:10px;border:1px solid var(--divider-color,#ddd);border-radius:9px}.border-crossing{display:grid;gap:4px;padding:8px 0;border-top:1px solid var(--divider-color,#ddd)}.border-crossing:first-of-type{border-top:0}.border-crossing small{display:block}.toll-details{overflow-wrap:anywhere}.toll-total{font-size:1.35rem;font-weight:700;margin-bottom:10px}.toll-countries{display:grid;gap:0}.toll-country{display:grid;gap:4px;padding:9px 0;border-top:1px solid var(--divider-color,#ddd)}.toll-country:first-child{border-top:0}.toll-country-heading{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.toll-country-heading strong{white-space:nowrap}.toll-country-meta{color:var(--secondary-text-color);font-size:.85rem}.toll-known-notes,.toll-objects,.provider-details{margin-top:10px;padding-top:8px;border-top:1px solid var(--divider-color,#ddd)}.toll-known-notes ul,.toll-objects ul,.provider-details ul{margin:6px 0;padding-left:20px}.provider-details summary{cursor:pointer;overflow-wrap:anywhere}.provider-details li{overflow-wrap:anywhere;white-space:pre-wrap}.crp-marker-border span{background:#6a1b9a}.point-row{grid-template-columns:repeat(2,minmax(0,1fr))}.search-row{min-width:0}.search-row button{flex:0 0 auto}.saved-row button{min-width:0;white-space:normal}:host(:not(.crp-narrow)) .grid{grid-template-columns:repeat(2,minmax(0,1fr))}:host(.crp-narrow) .content{padding:12px}:host(.crp-narrow) .grid{grid-template-columns:1fr}:host(.crp-narrow) .facts,:host(.crp-narrow) .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}:host(.crp-narrow) .export-actions button{flex:1;min-width:0}:host(.crp-narrow) .saved-row{flex-wrap:wrap}:host(.crp-narrow) .saved-row span{flex-basis:100%}:host(.crp-tiny) .point-row{grid-template-columns:1fr}:host(.crp-tiny) .facts,:host(.crp-tiny) .metrics{grid-template-columns:1fr}:host(.crp-tiny) .actions{align-items:stretch}:host(.crp-tiny) .actions>*{min-width:0;flex:1 1 100%}`;

if (!customElements.get("camper-route-planner-card-editor")) customElements.define("camper-route-planner-card-editor", CamperRoutePlannerCardEditor);
if (!customElements.get("camper-route-planner-card")) customElements.define("camper-route-planner-card", CamperRoutePlannerCard);
if (globalThis.window && Array.isArray(window.customCards) && !window.customCards.some((card) => card.type === "camper-route-planner-card")) window.customCards.push({ type: "camper-route-planner-card", name: "Camper Route Planner", description: "Manuelle Routenplanung mit Fahrzeugprofilen und automatischer Instanzwahl.", preview: true, documentationURL: "https://github.com/balronu/ha-camper-route-planner" });
