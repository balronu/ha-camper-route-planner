import { languageOf, t } from "./localization.js";
import { addWaypoint, formatDistance, formatDuration, hasTrackGeometry, isValidWaypoint, moveWaypoint, normalizeConfig, normalizeServiceResponse, removeWaypoint, routeRecordFromResult, selectConfigEntry } from "./card-utils.js";
import { callWebsocket, calculateRoute, deliverGpxExport, exportGpx } from "./services.js";
import { renderMap } from "./map-view.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

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
  static getStubConfig() { return { type: "custom:camper-route-planner-card", entry_id: "" }; }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig();
    this._state = { profiles: [], routes: [], mapConfig: null, profileId: "", origin: { latitude: "", longitude: "", label: "" }, destination: { latitude: "", longitude: "", label: "" }, waypoints: [], routeName: "manual route", result: null, error: "", mapError: "", busy: false, loaded: false, entryStatus: "missing", entries: [] };
    this._connection = null;
    this._entryDiscoveryConnection = null;
    this._entryDiscoveryPromise = null;
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

  updatePoint(target, index, field, value) { const list = target === "waypoint" ? [...this._state.waypoints] : [{ ...this._state[target] }]; const point = target === "waypoint" ? { ...list[index] } : list[0]; point[field] = value; if (target === "waypoint") list[index] = point; else this._state[target] = point; if (target === "waypoint") this._state.waypoints = list; this.render(); }

  renderPoint(point, target, index = 0) { return `<div class="point-row"><label>${t(languageOf(this._hass), "latitude")}<input data-point="${target}" data-index="${index}" data-field="latitude" type="number" step="any" value="${escapeHtml(point.latitude)}"></label><label>${t(languageOf(this._hass), "longitude")}<input data-point="${target}" data-index="${index}" data-field="longitude" type="number" step="any" value="${escapeHtml(point.longitude)}"></label>${target === "waypoint" ? `<button data-action="up" data-index="${index}" aria-label="${t(languageOf(this._hass), "moveUp")}">↑</button><button data-action="down" data-index="${index}" aria-label="${t(languageOf(this._hass), "moveDown")}">↓</button><button data-action="remove" data-index="${index}">${t(languageOf(this._hass), "remove")}</button>` : ""}</div>`; }

  render() {
    const language = languageOf(this._hass); const translate = (key) => t(language, key); const profile = this._state.profiles.find((item) => item.profile_id === this._state.profileId); const result = this._state.result;
    if (!this._config.entry_id) { const message = this._state.entryStatus === "multiple" ? translate("multipleEntries") : translate("configMissing"); this.shadowRoot.innerHTML = `<ha-card><div class="content"><p>${message}</p></div></ha-card>`; return; }
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card><div class="content"><header><div><h2>${escapeHtml(this._config.title)}</h2><p class="subtle">${translate("manualOnly")}</p></div><span class="status-dot ${this._state.loaded ? "ready" : "loading"}" aria-label="${this._state.loaded ? "ready" : "loading"}"></span></header><section class="grid"><div class="panel"><h3>${translate("vehicle")}</h3><select data-action="profile" aria-label="${translate("vehicle")}"><option value="">${translate("noProfiles")}</option>${this._state.profiles.map((item) => `<option value="${escapeHtml(item.profile_id)}" ${item.profile_id === this._state.profileId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>${profile ? `<dl class="facts"><div><dt>H × W × L</dt><dd>${profile.height_m} × ${profile.width_m} × ${profile.length_m} m</dd></div><div><dt>kg</dt><dd>${profile.gross_weight_kg}</dd></div><div><dt>${translate("profileDetails")}</dt><dd>${escapeHtml(profile.vehicle_kind)} · ${escapeHtml(profile.fuel_type)}</dd></div></dl>` : ""}</div><div class="panel"><h3>${translate("start")}</h3>${this.renderPoint(this._state.origin, "origin")}</div><div class="panel"><h3>${translate("destination")}</h3>${this.renderPoint(this._state.destination, "destination")}</div><div class="panel waypoints"><h3>${translate("waypoint")}</h3>${this._state.waypoints.map((point, index) => this.renderPoint(point, "waypoint", index)).join("")}<button data-action="add">＋ ${translate("addWaypoint")}</button></div></section><div class="actions"><button class="primary" data-action="calculate" ${this._state.busy ? "disabled" : ""}>${this._state.busy ? translate("calculating") : translate("calculate")}</button><input data-field="routeName" value="${escapeHtml(this._state.routeName)}" aria-label="${translate("save")}"><button data-action="save" ${!result || this._state.busy ? "disabled" : ""}>${this._state.busy ? translate("saving") : translate("save")}</button></div>${this._state.error ? `<p class="error" role="alert">${escapeHtml(this._state.error)}</p>` : ""}${this._state.mapError ? `<p class="error" role="alert">${escapeHtml(this._state.mapError)}</p>` : ""}<section class="result"><h3>${translate("mockRoute") === (result?.synthetic ? translate("mockRoute") : "") ? translate("mockRoute") : result ? escapeHtml(result.provider) : translate("noRoute")}</h3>${result ? `<div class="metrics"><div><b>${formatDistance(result.distance_m, language)}</b><span>${translate("distance")}</span></div><div><b>${formatDuration(result.duration_s, language)}</b><span>${translate("duration")}</span></div><div><b>${escapeHtml(result.provider)}</b><span>${translate("provider")}</span></div></div><div class="map-host"></div><div class="export-panel"><b>${translate("navigationExport")}</b><div class="export-actions"><button data-action="export" data-mode="route">${translate("exportRoute")}</button><button data-action="export" data-mode="track" ${hasTrackGeometry(this._state.result) ? "" : "disabled"}>${translate("exportTrack")}</button><button data-action="export" data-mode="combined" ${hasTrackGeometry(this._state.result) ? "" : "disabled"}>${translate("exportCombined")}</button></div></div>${result.synthetic ? `<p class="notice">${translate("mockDataNotice")}</p>` : ""}${result.warnings.length ? `<div class="warnings"><b>${translate("warnings")}</b><ul>${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>` : ""}` : ""}</section><section class="saved"><h3>${translate("savedRoutes")}</h3>${this._state.routes.length ? this._state.routes.map((route) => `<div class="saved-row"><span>${escapeHtml(route.name || route.route_id)} · ${formatDistance(route.distance_m, language)}</span><button data-action="load" data-route-id="${escapeHtml(route.route_id)}">${translate("load")}</button><button data-action="export" data-mode="route" data-route-id="${escapeHtml(route.route_id)}">${translate("exportRoute")}</button><button data-action="export" data-mode="track" data-route-id="${escapeHtml(route.route_id)}" ${hasTrackGeometry(route) ? "" : "disabled"}>${translate("exportTrack")}</button><button data-action="export" data-mode="combined" data-route-id="${escapeHtml(route.route_id)}" ${hasTrackGeometry(route) ? "" : "disabled"}>${translate("exportCombined")}</button><button data-action="delete" data-route-id="${escapeHtml(route.route_id)}">${translate("delete")}</button></div>`).join("") : `<p class="subtle">${translate("noRoute")}</p>`}</section></div></ha-card>`;
    if (result?.provider === "nakordoni_motorhome") {
      const resultPanel = this.shadowRoot.querySelector(".result");
      resultPanel?.insertAdjacentHTML("afterbegin", `<div class="notice beta-notice"><b>${translate("motorhomeBeta")}</b><br>${translate("motorhomeWarning")}<br><a href="${escapeHtml(result.attribution_url || "https://nakordoni.eu")}" target="_blank" rel="noreferrer">${translate("dataByNakordoni")}</a></div>`);
      const tolls = result.metadata?.tolls;
      resultPanel?.insertAdjacentHTML("beforeend", `<div class="notice"><b>${translate("tolls")}</b>: ${tolls?.total != null ? `${escapeHtml(tolls.total)} ${escapeHtml(tolls.currency || "")}${tolls.estimate ? ` (${translate("tollEstimate")})` : ""}` : tolls?.complete === false ? translate("tollIncomplete") : translate("tollUnavailable")}</div>`);
    }
    this.bindEvents(); if (result) renderMap(this.shadowRoot.querySelector(".map-host"), result, this._state.mapConfig, { noRoute: translate("noRoute"), geometryFallback: translate("geometryFallback"), start: translate("start"), destination: translate("destination"), waypoint: translate("waypoint") }, () => { this._state.mapError = translate("mapTileError"); this._state.mapConfig = { ...(this._state.mapConfig || {}), status: "invalid" }; this.render(); });
  }

  bindEvents() {
    this.shadowRoot.querySelectorAll("input[data-point]").forEach((input) => input.addEventListener("change", (event) => this.updatePoint(event.target.dataset.point, Number(event.target.dataset.index), event.target.dataset.field, event.target.value)));
    this.shadowRoot.querySelector("select[data-action=profile]")?.addEventListener("change", (event) => { this._state.profileId = event.target.value; this.render(); });
    this.shadowRoot.querySelector("input[data-field=routeName]")?.addEventListener("change", (event) => { this._state.routeName = event.target.value; });
    this.shadowRoot.querySelectorAll("button[data-action]").forEach((button) => button.addEventListener("click", () => { const action = button.dataset.action; const index = Number(button.dataset.index); if (action === "calculate") this.calculate(); if (action === "save") this.saveCurrent(); if (action === "export") this.exportRoute(button.dataset.mode, this._state.routes.find((route) => route.route_id === button.dataset.routeId)); if (action === "add") { this._state.waypoints = addWaypoint(this._state.waypoints); this.render(); } if (action === "remove") { this._state.waypoints = removeWaypoint(this._state.waypoints, index); this.render(); } if (action === "up") { this._state.waypoints = moveWaypoint(this._state.waypoints, index, -1); this.render(); } if (action === "down") { this._state.waypoints = moveWaypoint(this._state.waypoints, index, 1); this.render(); } if (action === "load") this.loadRoute(button.dataset.routeId); if (action === "delete") this.deleteRoute(button.dataset.routeId); }));
  }
}

const STYLES = `:host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif)}ha-card{overflow:hidden}.content{padding:16px}header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}h2,h3{margin:0 0 8px}h2{font-size:1.25rem}h3{font-size:1rem}.subtle,small{color:var(--secondary-text-color);font-size:.82rem}.status-dot{width:10px;height:10px;border-radius:50%;background:var(--disabled-text-color)}.status-dot.ready{background:var(--success-color,#43a047)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.panel{border:1px solid var(--divider-color,#ddd);border-radius:12px;padding:12px}select,input{box-sizing:border-box;max-width:100%;min-height:38px;padding:7px 9px;border:1px solid var(--divider-color,#bbb);border-radius:8px;background:var(--card-background-color,#fff);color:inherit}select{width:100%}.point-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;margin-bottom:8px}.point-row label{display:flex;flex-direction:column;gap:4px;font-size:.8rem}.point-row button{min-height:34px}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 0;font-size:.8rem}.facts div{background:var(--secondary-background-color,#f5f5f5);padding:8px;border-radius:8px}.facts dt{color:var(--secondary-text-color)}.facts dd{margin:3px 0 0}.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0}.actions input{flex:1;min-width:120px}.actions button,button{cursor:pointer;border:1px solid var(--divider-color,#bbb);background:var(--secondary-background-color,#f5f5f5);color:inherit;border-radius:8px;padding:8px 12px}.actions .primary{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);border:0;font-weight:600}.error{padding:10px;border-radius:8px;color:var(--error-color,#d32f2f);background:color-mix(in srgb,var(--error-color,#d32f2f) 12%,transparent)}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.metrics div{padding:10px;border-radius:9px;background:var(--secondary-background-color,#f5f5f5)}.metrics b,.metrics span{display:block}.metrics span{font-size:.8rem;color:var(--secondary-text-color)}.crp-map{margin-top:12px;overflow:hidden;border-radius:12px;background:var(--secondary-background-color,#f5f5f5);touch-action:none;min-height:220px}.crp-map svg{display:block;width:100%;min-height:220px;transition:transform .12s ease}.crp-map small{display:block;padding:6px 10px}.leaflet-map{height:340px}.leaflet-container{font:inherit;background:var(--secondary-background-color,#f5f5f5)}.export-panel{margin-top:12px;padding:10px;border-radius:9px;background:var(--secondary-background-color,#f5f5f5)}.export-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.export-actions button{min-height:38px}.notice,.warnings{padding:9px;border-radius:8px;background:var(--secondary-background-color,#f5f5f5);font-size:.86rem}.warnings ul{margin:6px 0 0;padding-left:20px}.saved{margin-top:16px}.saved-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--divider-color,#ddd);font-size:.88rem}.saved-row span{flex:1;overflow:hidden;text-overflow:ellipsis}@media(max-width:600px){.content{padding:12px}.grid{grid-template-columns:1fr}.facts,.metrics{grid-template-columns:1fr 1fr}.point-row{grid-template-columns:1fr 1fr}.export-actions button{flex:1}.saved-row{flex-wrap:wrap}.saved-row span{flex-basis:100%}}`;

if (!customElements.get("camper-route-planner-card-editor")) customElements.define("camper-route-planner-card-editor", CamperRoutePlannerCardEditor);
if (!customElements.get("camper-route-planner-card")) customElements.define("camper-route-planner-card", CamperRoutePlannerCard);
if (globalThis.window && Array.isArray(window.customCards) && !window.customCards.some((card) => card.type === "custom:camper-route-planner-card")) window.customCards.push({ type: "custom:camper-route-planner-card", name: "Camper Route Planner", description: "Manuelle Routenplanung mit Fahrzeugprofilen und automatischer Instanzwahl.", preview: true, documentationURL: "https://github.com/balronu/ha-camper-route-planner" });
