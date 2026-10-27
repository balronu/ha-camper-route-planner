import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const BODY_SIZE = 9.2;
const LINE_HEIGHT = 13;
const COLORS = {
  ink: rgb(0.12, 0.14, 0.16), muted: rgb(0.35, 0.39, 0.42), blue: rgb(0.04, 0.28, 0.48),
  lightBlue: rgb(0.88, 0.94, 0.97), line: rgb(0.76, 0.8, 0.82), route: rgb(0.04, 0.42, 0.72),
  start: rgb(0.08, 0.52, 0.29), destination: rgb(0.72, 0.12, 0.13), waypoint: rgb(0.82, 0.48, 0.08),
};

const pdfText = (value) => String(value ?? "—")
  .replaceAll("→", "->").replaceAll("•", "-").replaceAll("…", "...").replaceAll("–", "-").replaceAll("—", "-");

const formatDate = (value, language, includeTime = false) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return pdfText(value);
  return new Intl.DateTimeFormat(language, includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
};
const formatNumber = (value, language, digits = 1) => Number.isFinite(Number(value)) ? new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(Number(value)) : "-";
const formatMoney = (value, language, currency = "EUR") => value == null || !Number.isFinite(Number(value)) ? (language === "de" ? "nicht verfügbar" : "not available") : new Intl.NumberFormat(language, { style: "currency", currency }).format(Number(value));
const countryName = (value, language) => { if (!value) return "-"; try { return new Intl.DisplayNames([language], { type: "region" }).of(String(value)) || String(value); } catch (_error) { return String(value); } };
const valueOr = (value, fallback) => value == null || value === "" ? fallback : value;
const localizedVehicle = (value, language) => {
  const labels = language === "de" ? { motorhome: "Wohnmobil", truck: "Lkw", car: "Pkw", diesel: "Diesel", petrol: "Benzin", electric: "Elektro", hybrid: "Hybrid", other: "Sonstige" } : { motorhome: "Motorhome", truck: "Truck", car: "Car", diesel: "Diesel", petrol: "Petrol", electric: "Electric", hybrid: "Hybrid", other: "Other" };
  return labels[value] || pdfText(value);
};
const coordinateLabel = (point, language) => {
  if (!point) return language === "de" ? "Nicht verfügbar" : "Unavailable";
  const label = point.label || point.address;
  if (label && !/^([a-z_]+\.)+[a-z0-9_]+$/i.test(String(label))) return label;
  if (Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))) return `${formatNumber(point.latitude, language, 5)}, ${formatNumber(point.longitude, language, 5)}`;
  return language === "de" ? "Aktueller Fahrzeugstandort" : "Current vehicle location";
};
const routeCountries = (result, language) => {
  const values = result?.metadata?.country_sequence || result?.metadata?.countries || result?.metadata?.country_split;
  if (!Array.isArray(values)) return [];
  return values.map((item) => typeof item === "string" ? item : item?.country).filter(Boolean).map((item) => countryName(item, language));
};
const routePoints = (result) => Array.isArray(result?.geometry?.points) ? result.geometry.points.filter((point) => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))) : [];

class PdfWriter {
  constructor(document, fonts, language, title) { this.document = document; this.font = fonts.regular; this.bold = fonts.bold; this.language = language; this.title = title; this.pages = []; this.newPage(); }
  newPage() { this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]); this.pages.push(this.page); this.y = PAGE_HEIGHT - MARGIN - 16; }
  ensure(height = LINE_HEIGHT) { if (this.y - height < MARGIN + 28) this.newPage(); }
  text(value, { size = BODY_SIZE, bold = false, color = COLORS.ink, indent = 0, keepTogether = false } = {}) {
    const words = pdfText(value).split(/\s+/); const lines = []; let line = ""; const maxWidth = PAGE_WIDTH - MARGIN * 2 - indent; const font = bold ? this.bold : this.font;
    for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) { lines.push(line); line = word; } else line = candidate; }
    if (line) lines.push(line); if (keepTogether && this.y - lines.length * (size + 3) < MARGIN + 28) this.newPage();
    for (const current of lines) { this.ensure(size + 4); this.page.drawText(current, { x: MARGIN + indent, y: this.y, size, font, color }); this.y -= size + 3; }
  }
  heading(value, level = 2) { this.ensure(level === 1 ? 34 : 95); this.y -= level === 1 ? 8 : 5; this.text(value, { size: level === 1 ? 18 : 12, bold: true, color: COLORS.blue, keepTogether: true }); this.y -= 3; }
  row(label, value, options = {}) { this.text(`${label}: ${value}`, { indent: 4, ...options }); }
  bullet(value, options = {}) { this.text(`- ${value}`, { indent: 8, ...options }); }
  rule() { this.ensure(10); this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.5, color: COLORS.line }); this.y -= 8; }
  table(headers, rows, widths) {
    const totalWidth = PAGE_WIDTH - MARGIN * 2; const normalized = widths || headers.map(() => totalWidth / headers.length); const drawCell = (value, width, bold = false) => { const words = pdfText(value).split(/\s+/); const lines = []; let line = ""; const font = bold ? this.bold : this.font; for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (line && font.widthOfTextAtSize(candidate, 8) > width - 8) { lines.push(line); line = word; } else line = candidate; } if (line) lines.push(line); return { lines, font, color: bold ? COLORS.blue : COLORS.ink }; };
    const drawRow = (values, bold = false, fill = null) => { const cells = values.map((value, index) => drawCell(value, normalized[index], bold)); const height = Math.max(18, ...cells.map((cell) => cell.lines.length * 10 + 8)); if (this.y - height < MARGIN + 28) this.newPage(); if (fill) this.page.drawRectangle({ x: MARGIN, y: this.y - height + 2, width: totalWidth, height, color: fill }); let x = MARGIN; cells.forEach((cell, index) => { cell.lines.forEach((line, lineIndex) => this.page.drawText(line, { x: x + 4, y: this.y - 11 - lineIndex * 10, size: 8, font: cell.font, color: cell.color })); x += normalized[index]; }); this.page.drawLine({ start: { x: MARGIN, y: this.y - height }, end: { x: MARGIN + totalWidth, y: this.y - height }, thickness: 0.35, color: COLORS.line }); this.y -= height; };
    drawRow(headers, true, COLORS.lightBlue); rows.forEach((row) => drawRow(row));
  }
  finish() { this.pages.forEach((page, index) => { page.drawText("SmartCamper 765 - Reiseplan", { x: MARGIN, y: PAGE_HEIGHT - 22, size: 8, font: this.bold, color: COLORS.blue }); page.drawText(this.title, { x: PAGE_WIDTH - MARGIN - this.font.widthOfTextAtSize(this.title, 8), y: PAGE_HEIGHT - 22, size: 8, font: this.font, color: COLORS.muted }); page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 28 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 28 }, thickness: 0.35, color: COLORS.line }); page.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_WIDTH - MARGIN, y: 30 }, thickness: 0.35, color: COLORS.line }); const footer = `${this.language === "de" ? "Reiseplan" : "Travel plan"} | ${index + 1}/${this.pages.length}`; page.drawText(footer, { x: PAGE_WIDTH - MARGIN - this.font.widthOfTextAtSize(footer, 8), y: 18, size: 8, font: this.font, color: COLORS.muted }); }); }
}

function drawMarker(page, x, y, color, label, font) { page.drawCircle({ x, y, size: 4, color, borderColor: rgb(1, 1, 1), borderWidth: 1 }); page.drawText(label, { x: x + 7, y: y - 3, size: 7.5, font, color: COLORS.ink }); }
function drawRouteMap(writer, result, state, language) {
  const points = routePoints(result); if (points.length < 2) return; const de = language === "de";
  writer.heading(de ? "Übersichtskarte" : "Overview map", 2); writer.text(de ? "Schematische Routenübersicht aus der gespeicherten Geometrie; keine Straßenkarte und keine neue Netzwerkabfrage." : "Schematic route overview from the stored geometry; not a street map and no new network request.", { size: 8, color: COLORS.muted }); writer.ensure(205);
  const box = { x: MARGIN, y: writer.y - 176, width: PAGE_WIDTH - MARGIN * 2, height: 166 }; const lats = points.map((point) => Number(point.latitude)); const lons = points.map((point) => Number(point.longitude)); const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons); const latSpan = Math.max(maxLat - minLat, 0.0001); const lonSpan = Math.max(maxLon - minLon, 0.0001); const routeAspect = lonSpan / latSpan; let drawWidth = box.width - 24; let drawHeight = drawWidth / routeAspect; if (drawHeight > box.height - 24) { drawHeight = box.height - 24; drawWidth = drawHeight * routeAspect; } const offsetX = box.x + (box.width - drawWidth) / 2; const offsetY = box.y + (box.height - drawHeight) / 2; const x = (lon) => offsetX + ((lon - minLon) / lonSpan) * drawWidth; const y = (lat) => offsetY + ((lat - minLat) / latSpan) * drawHeight;
  writer.page.drawRectangle({ x: box.x, y: box.y, width: box.width, height: box.height, color: rgb(0.97, 0.98, 0.98), borderWidth: 0.5, borderColor: COLORS.line }); for (let index = 1; index < 4; index += 1) { const gx = box.x + box.width * index / 4; const gy = box.y + box.height * index / 4; writer.page.drawLine({ start: { x: gx, y: box.y }, end: { x: gx, y: box.y + box.height }, thickness: 0.25, color: COLORS.line }); writer.page.drawLine({ start: { x: box.x, y: gy }, end: { x: box.x + box.width, y: gy }, thickness: 0.25, color: COLORS.line }); }
  for (let index = 1; index < points.length; index += 1) { const previous = points[index - 1]; const current = points[index]; writer.page.drawLine({ start: { x: x(Number(previous.longitude)), y: y(Number(previous.latitude)) }, end: { x: x(Number(current.longitude)), y: y(Number(current.latitude)) }, thickness: 2, color: COLORS.route }); }
  const start = points[0]; const end = points[points.length - 1]; drawMarker(writer.page, x(Number(start.longitude)), y(Number(start.latitude)), COLORS.start, "Start", writer.font); drawMarker(writer.page, x(Number(end.longitude)), y(Number(end.latitude)), COLORS.destination, de ? "Ziel" : "Destination", writer.font); (Array.isArray(state?.waypoints) ? state.waypoints : []).forEach((point, index) => { if (Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))) drawMarker(writer.page, x(Number(point.longitude)), y(Number(point.latitude)), COLORS.waypoint, `${de ? "Zwischenziel" : "Waypoint"} ${index + 1}`, writer.font); });
  writer.y = box.y - 12; const countries = routeCountries(result, language); writer.text(`${de ? "Legende" : "Legend"}: Start · ${de ? "Ziel" : "Destination"} · ${de ? "Zwischenziele" : "Waypoints"}${countries.length ? ` | ${de ? "Länderfolge" : "Country sequence"}: ${countries.join(" -> ")}` : ""}`, { size: 8, color: COLORS.muted });
}

function renderFuel(writer, result, profile, language) {
  const de = language === "de"; writer.heading(de ? "Kraftstoffplanung" : "Fuel planning", 2); const consumption = Number(profile?.consumption_l_per_100km); const distanceKm = Number(result?.distance_m) / 1000;
  if (!Number.isFinite(consumption) || consumption <= 0 || !Number.isFinite(distanceKm)) { writer.text(de ? "Kein Verbrauchswert im Fahrzeugprofil vorhanden; der Kraftstoffbedarf wird nicht erfunden." : "No vehicle consumption value is available; fuel demand is not invented.", { color: COLORS.muted }); return; }
  const liters = distanceKm * consumption / 100; writer.row(de ? "Verbrauchsannahme" : "Consumption assumption", `${formatNumber(consumption, language, 1)} l/100 km`); writer.row(de ? "Gesamtstrecke" : "Total distance", `${formatNumber(distanceKm, language, 1)} km`); writer.row(de ? "Geschätzter Gesamtbedarf" : "Estimated total demand", `${formatNumber(liters, language, 1)} l`, { bold: true }); writer.text(de ? "Rechnerische Schätzung ohne Tankinhalt, Startfüllstand oder Sicherheitsreserve. Tankstopps werden deshalb nicht erfunden." : "Calculated estimate without tank capacity, starting level or safety reserve. Refuelling stops are therefore not invented.", { size: 8, color: COLORS.muted }); const price = Number(result?.metadata?.fuel_price_eur_per_l); if (Number.isFinite(price) && price > 0) writer.row(de ? "Planungskosten (Nutzerwert)" : "Planning cost (user value)", formatMoney(liters * price, language));
}

function renderBorders(writer, result, language) {
  const de = language === "de"; writer.heading(de ? "Grenzübergänge" : "Border crossings", 2); const crossings = result?.metadata?.border_crossings;
  if (Array.isArray(crossings) && crossings.length) writer.table([de ? "Übergang" : "Crossing", de ? "Wartezeit" : "Wait", de ? "Datenqualität" : "Data quality"], crossings.map((crossing) => [`${countryName(crossing.from_country, language)} -> ${countryName(crossing.to_country, language)}${crossing.name ? `: ${crossing.name}` : ` (${de ? "konkreter Übergang nicht verfügbar" : "specific crossing unavailable"})`}`, crossing.wait_min == null ? (de ? "keine Daten" : "no data") : `${formatNumber(crossing.wait_min, language, 0)} min`, crossing.inferred ? (de ? "abgeleitete Länderfolge" : "inferred country sequence") : valueOr(crossing.status, de ? "unbekannt" : "unknown")]), [235, 120, 156]);
  else writer.text(result?.metadata?.border_state === "unordered_international" ? (de ? "Internationale Route erkannt; konkrete Grenzübergänge konnten nicht zuverlässig zugeordnet werden." : "International route detected; specific border crossings could not be assigned reliably.") : (de ? "Keine Grenzübergänge in der Routing-Antwort." : "No border crossings were returned by the routing response."), { color: COLORS.muted });
}

function renderTolls(writer, result, language) {
  const de = language === "de"; writer.heading(de ? "Maut und Vignetten" : "Tolls and vignettes", 2); const tolls = result?.metadata?.tolls; if (!tolls) { writer.text(de ? "Keine Mautdaten in der Routing-Antwort." : "No toll data was returned by the routing response.", { color: COLORS.muted }); return; }
  const currency = tolls.currency || "EUR"; const rows = (Array.isArray(tolls.countries) ? tolls.countries : []).map((item) => [countryName(item.country, language), formatMoney(item.total ?? item.amount, language, item.currency || currency), valueOr(item.system, de ? "nicht angegeben" : "not specified"), valueOr(item.status, de ? "unbekannt" : "unknown")]); if (rows.length) writer.table([de ? "Land" : "Country", de ? "Betrag" : "Amount", de ? "Tarifart" : "Tariff", "Status"], rows, [160, 105, 130, 116]); writer.row(de ? "Gesamtsumme" : "Total", formatMoney(tolls.total, language, currency), { bold: true }); if (tolls.complete === false || tolls.coverage_note) writer.text(`${de ? "Datenhinweis" : "Data note"}: ${valueOr(tolls.coverage_note, de ? "Mautdaten sind möglicherweise unvollständig." : "Toll data may be incomplete.")}`, { size: 8, color: COLORS.muted }); if (result?.metadata?.tariff_basis_uncertain) writer.text(de ? "Tarifgrundlage unsicher: Die Beträge sind Schätzungen und nicht rechtsverbindlich." : "Tariff basis uncertain: amounts are estimates and not legally binding.", { size: 8, color: COLORS.muted });
}

function renderVehicle(writer, profile, language) {
  if (!profile) return; const de = language === "de"; writer.heading(de ? "Fahrzeugübersicht" : "Vehicle overview", 2); const rows = [[de ? "Fahrzeugname" : "Vehicle name", profile.name], [de ? "Fahrzeugart" : "Vehicle type", localizedVehicle(profile.vehicle_kind, language)], [de ? "Maße" : "Dimensions", `${profile.length_m} x ${profile.width_m} x ${profile.height_m} m`], [de ? "Zulässige Gesamtmasse" : "Gross vehicle mass", `${profile.gross_weight_kg} kg`], [de ? "Achsen" : "Axles", profile.axles], [de ? "Kraftstoffart" : "Fuel type", localizedVehicle(profile.fuel_type, language)], [de ? "Euro-Schadstoffklasse" : "Euro emission class", profile.emission_class ? profile.emission_class.toUpperCase() : (de ? "nicht angegeben" : "not specified")], [de ? "CO2-Klasse" : "CO2 class", profile.co2_class ? profile.co2_class.toUpperCase() : (de ? "nicht angegeben" : "not specified")], [de ? "Erstzulassung" : "First registration", valueOr(profile.first_registration, de ? "nicht angegeben" : "not specified")], [de ? "Durchschnittsverbrauch" : "Average consumption", profile.consumption_l_per_100km == null ? (de ? "nicht angegeben" : "not specified") : `${formatNumber(profile.consumption_l_per_100km, language, 1)} l/100 km`]]; writer.table([de ? "Angabe" : "Field", de ? "Wert" : "Value"], rows, [220, 291]);
}

function renderRouteOverview(writer, result, state, language) {
  const de = language === "de"; writer.heading(de ? "Reiseübersicht" : "Trip overview", 2); writer.row(de ? "Start" : "Start", coordinateLabel(state.origin || result.origin, language)); writer.row(de ? "Ziel" : "Destination", coordinateLabel(state.destination || result.destination, language)); const waypoints = Array.isArray(state.waypoints) ? state.waypoints : (Array.isArray(result.waypoints) ? result.waypoints : []); writer.row(de ? "Zwischenziele" : "Waypoints", waypoints.length ? waypoints.map((point) => coordinateLabel(point, language)).join("; ") : (de ? "Keine" : "None")); const countries = routeCountries(result, language); if (countries.length) writer.row(de ? "Länderfolge" : "Country sequence", countries.join(" -> ")); writer.row(de ? "Gesamtdistanz" : "Total distance", `${formatNumber(Number(result.distance_m) / 1000, language, 1)} km`); writer.row(de ? "Reine Fahrzeit" : "Driving time", `${Math.floor(Number(result.duration_s) / 3600)} h ${Math.round((Number(result.duration_s) % 3600) / 60)} min`); writer.row(de ? "Geschätzte Maut" : "Estimated tolls", result.metadata?.tolls ? formatMoney(result.metadata.tolls.total, language, result.metadata.tolls.currency || "EUR") : (de ? "nicht verfügbar" : "not available")); writer.row(de ? "Erstellt" : "Created", formatDate(result.created_at, language, true));
}

function renderWarnings(writer, result, language) {
  const de = language === "de"; writer.heading(de ? "Reisehinweise und Datenqualität" : "Travel notes and data quality", 2); const notes = de ? ["Wohnmobil-Routing ist eine Planungshilfe; Verkehrszeichen und geltende Vorschriften haben Vorrang.", "Mautbeträge und Grenzwartedaten können unvollständig oder veraltet sein.", "Die Navigation kann die Strecke neu berechnen; Befahrbarkeit wird nicht rechtsverbindlich zugesichert."] : ["Motorhome routing is a planning aid; traffic signs and applicable rules take precedence.", "Toll amounts and border-wait data may be incomplete or out of date.", "Navigation may recalculate the route; passability is not legally guaranteed."]; notes.forEach((note) => writer.bullet(note, { keepTogether: true })); if (Array.isArray(result.warnings) && result.warnings.length) { writer.text(de ? "Anbieterhinweise (Original)" : "Provider notes (original)", { bold: true, size: 9, keepTogether: true }); result.warnings.forEach((warning) => writer.bullet(warning, { size: 8.5, color: COLORS.muted, keepTogether: true })); }
}

export async function createTravelPlanPdf({ language = "en", profile = null, state = {}, result = null, title = "Camper Route Planner", routeName = "" }) {
  if (!result || !result.geometry || !Array.isArray(result.geometry.points) || result.geometry.points.length < 2) throw new Error("A valid calculated route is required");
  const document = await PDFDocument.create(); const fonts = { regular: await document.embedFont(StandardFonts.Helvetica), bold: await document.embedFont(StandardFonts.HelveticaBold) }; const de = language === "de"; const planTitle = pdfText(routeName || title || (de ? "Reiseplan" : "Travel plan")); const writer = new PdfWriter(document, fonts, language, planTitle);
  writer.heading("SmartCamper 765", 1); writer.text(de ? "Reiseplan" : "Travel plan", { size: 14, bold: true }); writer.text(planTitle, { size: 12, bold: true, color: COLORS.muted }); writer.rule(); renderRouteOverview(writer, result, state, language); renderVehicle(writer, profile, language); drawRouteMap(writer, result, state, language); writer.heading(de ? "Reiseverlauf" : "Itinerary", 2); const waypoints = Array.isArray(state.waypoints) ? state.waypoints : (Array.isArray(result.waypoints) ? result.waypoints : []); writer.row(de ? "Start" : "Start", coordinateLabel(state.origin || result.origin, language)); waypoints.forEach((point, index) => writer.row(`${de ? "Zwischenziel" : "Waypoint"} ${index + 1}`, coordinateLabel(point, language))); writer.row(de ? "Ziel" : "Destination", coordinateLabel(state.destination || result.destination, language)); writer.text(de ? "Etappenwerte werden nur ausgewiesen, wenn die Routing-Antwort belastbare Segmentdaten liefert; eine freie Aufteilung der Gesamtdistanz findet nicht statt." : "Leg values are shown only when the routing response provides reliable segment data; the total route is not divided arbitrarily.", { size: 8, color: COLORS.muted }); renderFuel(writer, result, profile, language); renderTolls(writer, result, language); renderBorders(writer, result, language); renderWarnings(writer, result, language); writer.finish(); return document.save();
}

export function pdfFileName(routeName = "reiseplan") { const safe = String(routeName || "Camper").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "Camper"; const date = new Date().toISOString().slice(0, 10); return `Camper-Route-${safe}-${date}.pdf`; }
export function downloadPdf(bytes, filename) { const blob = new Blob([bytes], { type: "application/pdf" }); const url = URL.createObjectURL(blob); try { const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.rel = "noopener"; anchor.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 0); } return "downloaded"; }
