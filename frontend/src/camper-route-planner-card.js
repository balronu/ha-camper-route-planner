import { languageOf, t } from "./localization.js";
import { addWaypoint, formatDistance, formatDuration, hasTrackGeometry, isValidWaypoint, moveWaypoint, normalizeConfig, normalizeServiceResponse, removeWaypoint, routeRecordFromResult, selectConfigEntry } from "./card-utils.js";
import { callWebsocket, calculateRoute, deliverGpxExport, exportGpx, geocode, reverseGeocode, trackerPosition } from "./services.js";
import { destroyMap, renderMap, updateMapPoints } from "./map-view.js";
import { LEAFLET_CSS } from "./leaflet-css.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const formatCoordinate = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return number.toFixed(6).replace(/\.?0+$/, "");
};

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
    this._state = { profiles: [], routes: [], mapConfig: null, profileId: "", origin: { latitude: "", longitude: "", label: "" }, destination: { latitude: "", longitude: "", label: "" }, waypoints: [], routeName: "manual route", result: null, error: "", mapError: "", searchError: "", searchResults: [], searchTarget: "origin", searchSlot: 0, originManual: false, busy: false, loaded: false, entryStatus: "missing", entries: [] };
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
      this._state.routes = Array.isArray(routes?.routes) ? routes.routes : [];
      this._state.mapConfig = mapConfig || { provider: "none", status: "not_configured" };
      if (!this._state.profileId && this._state.profiles[0]) this._state.profileId = this._state.profiles[0].profile_id;
      if (this._state.profileId && !this._state.originManual) this.useTrackerLocation(false);
    } catch (error) { this._state.error = error.message || t(languageOf(this._hass), "providerUnavailable"); }
    this._state.loaded = true;
    this.render();
  }

  async calculate() {
    if (this._state.busy) return;
    const language = languageOf(this._hass);
    if (!isValidWaypoint(this._state.origin) || !isValidWaypoint(this._state.destination) || this._state.waypoints.some((point) => !isValidWaypoint(point))) { this._state.error = t(language, "invalidCoordinates"); this.render(); return; }
    if (!this._state.profileId) { this._state.error = t(language, "noProfiles"); this.render(); return; }
    this._state.busy = true; this._state.error = ""; this.render();
    try {
      const payload = await calculateRoute(this._hass, { entry_id: this._config.entry_id, profile_id: this._state.profileId, origin: this._state.origin, destination: this._state.destination, via: this._state.waypoints, route_name: this._state.routeName });
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
      button.textContent = item.label || "";
      button.addEventListener("click", () => this.selectSearchResult(target, index));
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

  selectSearchResult(target, index, value) {
    const rawPoint = this._state.searchResults[index];
    const point = rawPoint && {
      ...rawPoint,
      address: rawPoint.address || rawPoint.label || "",
      latitude: Number(rawPoint.latitude ?? rawPoint.lat),
      longitude: Number(rawPoint.longitude ?? rawPoint.lon),
    };
    if (!point || !isValidWaypoint(point)) return;
    const slot = this._state.searchSlot;
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
    } else input = this.shadowRoot?.querySelector(`input[data-field="${state.activeKey}"]`);
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
    try { const response = await callWebsocket(this._hass, { type: "camper_route_planner/load_route", entry_id: this._config.entry_id, route_id: routeId }); const route = response.route; this._state.origin = route.origin || this._state.origin; this._state.destination = route.destination || this._state.destination; this._state.waypoints = route.waypoints || []; this._state.profileId = route.profile_id || this._state.profileId; this._state.result = normalizeServiceResponse(route); this.render(); }
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

  updatePoint(target, index, field, value) { const list = target === "waypoint" ? [...this._state.waypoints] : [{ ...this._state[target] }]; const point = target === "waypoint" ? { ...list[index] } : list[0]; point[field] = value; point.address = ""; if (target === "waypoint") list[index] = point; else { this._state[target] = point; if (target === "origin") this._state.originManual = true; } if (target === "waypoint") this._state.waypoints = list; this.render(); this.scheduleReverseGeocode(target, index, point); }

  mapPoints() { return [{ ...this._state.origin, target: "origin" }, ...this._state.waypoints.map((point, index) => ({ ...point, target: "waypoint", index })), { ...this._state.destination, target: "destination" }].filter((point) => isValidWaypoint(point)); }

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
    const inputState = this.captureInputState();
    const oldMap = this.shadowRoot?.querySelector(".crp-map");
    const preserveMap = Boolean(oldMap?.classList.contains("leaflet-container") && this._state.mapConfig?.provider === "carto" && this._state.mapConfig?.status === "configured");
    if (preserveMap) oldMap.remove();
    else destroyMap(oldMap);
    if (!this._config.entry_id) { const message = this._state.entryStatus === "multiple" ? translate("multipleEntries") : translate("configMissing"); this.shadowRoot.innerHTML = `<ha-card><div class="content"><p>${message}</p></div></ha-card>`; return; }
    const searchResultButtons = this._state.searchResults.map((item, index) => `<button type="button" data-action="select-search" data-target="${this._state.searchTarget}" data-index="${index}">${escapeHtml(item.label)}</button>`).join("");
    const pointEditor = (point, target, index = 0) => {
      const activeResults = target === this._state.searchTarget && index === this._state.searchSlot ? searchResultButtons : "";
      const resultClass = activeResults ? " class=\"search-results\"" : "";
      return `${this.renderPoint(point, target, index)}<div class="search-row"><input data-search-input="${target}" data-index="${index}" placeholder="${translate("searchPlaceholder")}" aria-label="${translate("search")}"><button type="button" data-action="search" data-target="${target}" data-index="${index}">${translate("search")}</button></div><div data-search-results data-target="${target}" data-index="${index}"${resultClass}>${activeResults}</div>`;
    };
    const vehicleKind = profile ? translate(`vehicleKind.${profile.vehicle_kind}`) : "";
    const fuelType = profile ? translate(`fuelType.${profile.fuel_type}`) : "";
    this.shadowRoot.innerHTML = `<style>${LEAFLET_CSS}${STYLES}${RESPONSIVE_STYLES}</style><ha-card><div class="content"><header><div><h2>${escapeHtml(this._config.title)}</h2><p class="subtle">${translate("manualOnly")}</p></div><span class="status-dot ${this._state.loaded ? "ready" : "loading"}"></span></header><section class="grid"><div class="panel"><h3>${translate("vehicle")}</h3><select data-action="profile" aria-label="${translate("vehicle")}"><option value="">${translate("noProfiles")}</option>${this._state.profiles.map((item) => `<option value="${escapeHtml(item.profile_id)}" ${item.profile_id === this._state.profileId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>${profile ? `<dl class="facts"><div><dt>H × W × L</dt><dd>${profile.height_m} × ${profile.width_m} × ${profile.length_m} m</dd></div><div><dt>kg</dt><dd>${profile.gross_weight_kg}</dd></div><div><dt>${translate("profileDetails")}</dt><dd>${escapeHtml(vehicleKind)} · ${escapeHtml(fuelType)}</dd></div></dl><button type="button" data-action="tracker">${translate("useVehicleLocation")}</button>` : ""}</div><div class="panel"><h3>${translate("start")}</h3>${pointEditor(this._state.origin, "origin")}${this._state.trackerError ? `<p class="subtle">${translate("trackerUnavailable")}</p>` : ""}</div><div class="panel"><h3>${translate("destination")}</h3>${pointEditor(this._state.destination, "destination")}</div><div class="panel waypoints"><h3>${translate("waypoint")}</h3>${this._state.waypoints.map((point, index) => pointEditor(point, "waypoint", index)).join("")}<button type="button" data-action="add">＋ ${translate("addWaypoint")}</button></div></section><p class="subtle" data-search-error hidden></p><p class="privacy">${translate("geocodingPrivacy")}</p><section class="map-section"><h3>${translate("map")}</h3><div class="map-host"></div></section><div class="actions"><button type="button" class="primary" data-action="calculate" ${this._state.busy ? "disabled" : ""}>${this._state.busy ? translate("calculating") : translate("calculate")}</button><input data-field="routeName" value="${escapeHtml(this._state.routeName)}" aria-label="${translate("save")}"><button type="button" data-action="save" ${!result || this._state.busy ? "disabled" : ""}>${this._state.busy ? translate("saving") : translate("save")}</button></div>${this._state.error ? `<p class="error" role="alert">${escapeHtml(this._state.error)}</p>` : ""}${this._state.mapError ? `<p class="error" role="alert">${escapeHtml(this._state.mapError)}</p>` : ""}<section class="result"><h3>${result ? escapeHtml(result.provider) : translate("noRoute")}</h3>${result ? `<div class="metrics"><div><b>${formatDistance(result.distance_m, language)}</b><span>${translate("distance")}</span></div><div><b>${formatDuration(result.duration_s, language)}</b><span>${translate("duration")}</span></div></div><div class="export-actions"><button type="button" data-action="export" data-mode="route">${translate("exportRoute")}</button><button type="button" data-action="export" data-mode="track" ${hasTrackGeometry(result) ? "" : "disabled"}>${translate("exportTrack")}</button><button type="button" data-action="export" data-mode="combined" ${hasTrackGeometry(result) ? "" : "disabled"}>${translate("exportCombined")}</button></div>${result.synthetic ? `<p class="notice">${translate("mockDataNotice")}</p>` : ""}` : ""}</section><section class="saved"><h3>${translate("savedRoutes")}</h3>${this._state.routes.length ? this._state.routes.map((route) => `<div class="saved-row"><span>${escapeHtml(route.name || route.route_id)} · ${formatDistance(route.distance_m, language)}</span><button type="button" data-action="load" data-route-id="${escapeHtml(route.route_id)}">${translate("load")}</button><button type="button" data-action="export" data-mode="route" data-route-id="${escapeHtml(route.route_id)}">${translate("exportRoute")}</button><button type="button" data-action="delete" data-route-id="${escapeHtml(route.route_id)}">${translate("delete")}</button></div>`).join("") : `<p class="subtle">${translate("noRoute")}</p>`}</section></div></ha-card>`;
    if (result?.provider === "nakordoni_motorhome") {
      const resultPanel = this.shadowRoot.querySelector(".result");
      resultPanel?.insertAdjacentHTML("afterbegin", `<div class="notice beta-notice"><b>${translate("motorhomeBeta")}</b><br>${translate("motorhomeWarning")}<br><a href="${escapeHtml(result.attribution_url || "https://nakordoni.eu")}" target="_blank" rel="noreferrer">${translate("dataByNakordoni")}</a></div>`);
      const tolls = result.metadata?.tolls;
      resultPanel?.insertAdjacentHTML("beforeend", `<div class="notice"><b>${translate("tolls")}</b>: ${tolls?.total != null ? `${escapeHtml(tolls.total)} ${escapeHtml(tolls.currency || "")}${tolls.estimate ? ` (${translate("tollEstimate")})` : ""}` : tolls?.complete === false ? translate("tollIncomplete") : translate("tollUnavailable")}</div>`);
    }
    this.shadowRoot.querySelector(".privacy")?.insertAdjacentHTML("beforeend", ` <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">${translate("geocodingAttribution")}</a>`);
    const mapLabels = { noRoute: translate("noRoute"), mapLoading: translate("mapLoading"), mapUnavailable: translate("mapUnavailable"), geometryFallback: translate("geometryFallback"), start: translate("start"), destination: translate("destination"), waypoint: translate("waypoint"), previewLine: translate("previewLine") };
    const mapOptions = { points: this.mapPoints(), route: result, fitBounds: this._fitMapOnNextRender, onPointChange: (target, index, latlng) => this.onMapPointChange(target, index, latlng), onMapClick: (latlng) => this.onMapPointChange("origin", 0, latlng) };
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
  }

  bindEvents() {
    this.shadowRoot.querySelectorAll("input[data-point]").forEach((input) => input.addEventListener("input", (event) => this.updatePoint(event.target.dataset.point, Number(event.target.dataset.index), event.target.dataset.field, event.target.value)));
    this.shadowRoot.querySelector("select[data-action=profile]")?.addEventListener("change", (event) => { this._state.profileId = event.target.value; this._state.originManual = false; this.useTrackerLocation(false); this.render(); });
    this.shadowRoot.querySelectorAll("button[data-action=tracker]").forEach((button) => button.addEventListener("click", () => this.useTrackerLocation(true)));
    this.shadowRoot.querySelectorAll("button[data-action=search]").forEach((button) => button.addEventListener("click", () => { const input = this.shadowRoot.querySelector(`input[data-search-input="${button.dataset.target}"][data-index="${button.dataset.index}"]`); input?.focus({ preventScroll: true }); this.searchAddress(button.dataset.target, input?.value, Number(button.dataset.index)); }));
    this.shadowRoot.querySelectorAll("input[data-search-input]").forEach((input) => input.addEventListener("input", () => {
      const key = `${input.dataset.searchInput}:${input.dataset.index}`;
      this._inputDrafts.set(key, input.value);
      this._searchRequestIds.set(key, (this._searchRequestIds.get(key) || 0) + 1);
      clearTimeout(input._crpSearchTimer);
      input._crpSearchTimer = setTimeout(() => this.searchAddress(input.dataset.searchInput, input.value, Number(input.dataset.index)), 350);
    }));
    this.shadowRoot.querySelectorAll("button[data-action=select-search]").forEach((button) => button.addEventListener("click", () => this.selectSearchResult(button.dataset.target, Number(button.dataset.index))));
    this.shadowRoot.querySelector("input[data-field=routeName]")?.addEventListener("change", (event) => { this._state.routeName = event.target.value; });
    this.shadowRoot.querySelectorAll("button[data-action]").forEach((button) => button.addEventListener("click", () => { const action = button.dataset.action; const index = Number(button.dataset.index); if (action === "calculate") this.calculate(); if (action === "save") this.saveCurrent(); if (action === "export") this.exportRoute(button.dataset.mode, this._state.routes.find((route) => route.route_id === button.dataset.routeId)); if (action === "add") { this._state.waypoints = addWaypoint(this._state.waypoints); this._fitMapOnNextRender = true; this.render(); } if (action === "remove") { this._state.waypoints = removeWaypoint(this._state.waypoints, index); this._fitMapOnNextRender = true; this.render(); } if (action === "up") { this._state.waypoints = moveWaypoint(this._state.waypoints, index, -1); this._fitMapOnNextRender = true; this.render(); } if (action === "down") { this._state.waypoints = moveWaypoint(this._state.waypoints, index, 1); this._fitMapOnNextRender = true; this.render(); } if (action === "load") this.loadRoute(button.dataset.routeId); if (action === "delete") this.deleteRoute(button.dataset.routeId); }));
  }
}

const STYLES = `:host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif)}ha-card{overflow:hidden}.content{padding:16px}header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}h2,h3{margin:0 0 8px}h2{font-size:1.25rem}h3{font-size:1rem}.subtle,small,.privacy{color:var(--secondary-text-color);font-size:.82rem}.status-dot{width:10px;height:10px;border-radius:50%;background:var(--disabled-text-color)}.status-dot.ready{background:var(--success-color,#43a047)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.panel{border:1px solid var(--divider-color,#ddd);border-radius:12px;padding:12px}select,input{box-sizing:border-box;max-width:100%;min-height:38px;padding:7px 9px;border:1px solid var(--divider-color,#bbb);border-radius:8px;background:var(--card-background-color,#fff);color:inherit}select{width:100%}.point-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;margin-bottom:8px}.point-row label{display:flex;flex-direction:column;gap:4px;font-size:.8rem}.point-row button{min-height:34px}.search-row{display:flex;gap:6px}.search-row input{flex:1;min-width:0}.search-results{display:grid;gap:4px;margin:8px 0}.search-results button{text-align:left}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0;font-size:.8rem}.facts div{background:var(--secondary-background-color,#f5f5f5);padding:8px;border-radius:8px}.facts dt{color:var(--secondary-text-color)}.facts dd{margin:3px 0 0}.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0}.actions input{flex:1;min-width:120px}.actions button,button{cursor:pointer;border:1px solid var(--divider-color,#bbb);background:var(--secondary-background-color,#f5f5f5);color:inherit;border-radius:8px;padding:8px 12px}.actions .primary{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);border:0;font-weight:600}.error{padding:10px;border-radius:8px;color:var(--error-color,#d32f2f);background:color-mix(in srgb,var(--error-color,#d32f2f) 12%,transparent)}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.metrics div{padding:10px;border-radius:9px;background:var(--secondary-background-color,#f5f5f5)}.metrics b,.metrics span{display:block}.metrics span{font-size:.8rem;color:var(--secondary-text-color)}.crp-map{margin-top:12px;overflow:hidden;border-radius:12px;background:var(--secondary-background-color,#f5f5f5);touch-action:none;min-height:220px}.crp-map>svg{display:block;width:100%;min-height:220px;transition:transform .12s ease}.crp-map small{display:block;padding:6px 10px}.crp-leaflet-map{height:340px}.leaflet-container{font:inherit;background:var(--secondary-background-color,#f5f5f5)}.crp-marker{background:transparent;border:0}.crp-marker span{display:flex;width:28px;height:28px;align-items:center;justify-content:center;border:3px solid #fff;border-radius:50% 50% 50% 0;box-shadow:0 2px 5px #0008;color:#fff;font-size:.8rem;font-weight:700;transform:rotate(-45deg)}.crp-marker span::first-letter{transform:rotate(45deg)}.crp-marker-start span{background:#43a047}.crp-marker-destination span{background:#e53935}.crp-marker-waypoint span{background:#fb8c00}.export-panel{margin-top:12px;padding:10px;border-radius:9px;background:var(--secondary-background-color,#f5f5f5)}.notice,.warnings{padding:9px;border-radius:8px;background:var(--secondary-background-color,#f5f5f5);font-size:.86rem}.warnings ul{margin:6px 0 0;padding-left:20px}.saved{margin-top:16px}.saved-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--divider-color,#ddd);font-size:.88rem}.saved-row span{flex:1;overflow:hidden;text-overflow:ellipsis}@media(max-width:600px){.content{padding:12px}.grid{grid-template-columns:1fr}.facts,.metrics{grid-template-columns:1fr 1fr}.point-row{grid-template-columns:1fr 1fr}.export-actions button{flex:1}.saved-row{flex-wrap:wrap}.saved-row span{flex-basis:100%}}`;
const RESPONSIVE_STYLES = `:host{max-width:100%;box-sizing:border-box}ha-card{max-width:100%;box-sizing:border-box}.content{min-width:0;max-width:100%;box-sizing:border-box}.crp-map{contain:paint}.grid,.facts,.metrics,.panel,.saved-row,.actions{min-width:0}.point-row{grid-template-columns:repeat(2,minmax(0,1fr))}.search-row{min-width:0}.search-row button{flex:0 0 auto}.saved-row button{min-width:0;white-space:normal}:host(:not(.crp-narrow)) .grid{grid-template-columns:repeat(2,minmax(0,1fr))}:host(.crp-narrow) .content{padding:12px}:host(.crp-narrow) .grid{grid-template-columns:1fr}:host(.crp-narrow) .facts,:host(.crp-narrow) .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}:host(.crp-narrow) .export-actions button{flex:1;min-width:0}:host(.crp-narrow) .saved-row{flex-wrap:wrap}:host(.crp-narrow) .saved-row span{flex-basis:100%}:host(.crp-tiny) .point-row{grid-template-columns:1fr}:host(.crp-tiny) .facts,:host(.crp-tiny) .metrics{grid-template-columns:1fr}:host(.crp-tiny) .actions{align-items:stretch}:host(.crp-tiny) .actions>*{min-width:0;flex:1 1 100%}`;

if (!customElements.get("camper-route-planner-card-editor")) customElements.define("camper-route-planner-card-editor", CamperRoutePlannerCardEditor);
if (!customElements.get("camper-route-planner-card")) customElements.define("camper-route-planner-card", CamperRoutePlannerCard);
if (globalThis.window && Array.isArray(window.customCards) && !window.customCards.some((card) => card.type === "camper-route-planner-card")) window.customCards.push({ type: "camper-route-planner-card", name: "Camper Route Planner", description: "Manuelle Routenplanung mit Fahrzeugprofilen und automatischer Instanzwahl.", preview: true, documentationURL: "https://github.com/balronu/ha-camper-route-planner" });
