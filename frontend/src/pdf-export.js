import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const BODY_SIZE = 9.5;
const LINE_HEIGHT = 13;

const pdfText = (value) => String(value ?? "—")
  .replaceAll("→", "->")
  .replaceAll("•", "-")
  .replaceAll("…", "...")
  .replaceAll("–", "-")
  .replaceAll("—", "-");

const formatDate = (value, language) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? pdfText(value) : new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(date);
};

const formatNumber = (value, language, digits = 1) => Number.isFinite(Number(value))
  ? new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(Number(value))
  : "-";

class PdfWriter {
  constructor(document, fonts, language) {
    this.document = document;
    this.font = fonts.regular;
    this.bold = fonts.bold;
    this.language = language;
    this.pages = [];
    this.newPage();
  }

  newPage() {
    this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(this.page);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensure(height = LINE_HEIGHT) {
    if (this.y - height < MARGIN + 24) this.newPage();
  }

  text(value, { size = BODY_SIZE, bold = false, color = rgb(0.12, 0.12, 0.12), indent = 0 } = {}) {
    const words = pdfText(value).split(/\s+/);
    let line = "";
    const maxWidth = PAGE_WIDTH - (MARGIN * 2) - indent;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = (bold ? this.bold : this.font).widthOfTextAtSize(candidate, size);
      if (line && width > maxWidth) {
        this.ensure(size + 4);
        this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font: bold ? this.bold : this.font, color });
        this.y -= size + 4;
        line = word;
      } else line = candidate;
    }
    if (line) {
      this.ensure(size + 4);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font: bold ? this.bold : this.font, color });
      this.y -= size + 4;
    }
  }

  heading(value, level = 2) {
    this.ensure(level === 1 ? 34 : 25);
    this.y -= level === 1 ? 8 : 5;
    this.text(value, { size: level === 1 ? 18 : 12, bold: true, color: rgb(0.05, 0.25, 0.42) });
    this.y -= 3;
  }

  row(label, value) {
    this.text(`${label}: ${value}`, { indent: 4 });
  }

  bullet(value) {
    this.text(`- ${value}`, { indent: 8 });
  }

  rule() {
    this.ensure(10);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    this.y -= 8;
  }

  footer(pageNumber) {
    this.page.drawText(`${pageNumber}`, { x: PAGE_WIDTH - MARGIN, y: 20, size: 8, font: this.font, color: rgb(0.4, 0.4, 0.4) });
  }
}

function drawRouteMap(writer, result) {
  const points = result?.geometry?.points;
  if (!Array.isArray(points) || points.length < 2) return;
  writer.heading(writer.language === "de" ? "Routenübersicht" : "Route overview", 2);
  writer.ensure(190);
  const box = { x: MARGIN, y: writer.y - 170, width: PAGE_WIDTH - MARGIN * 2, height: 160 };
  const lats = points.map((point) => Number(point.latitude)).filter(Number.isFinite);
  const lons = points.map((point) => Number(point.longitude)).filter(Number.isFinite);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const scale = (value, min, max, start, length) => start + (max === min ? 0.5 : (value - min) / (max - min)) * length;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    writer.page.drawLine({
      start: { x: scale(Number(previous.longitude), minLon, maxLon, box.x + 8, box.width - 16), y: scale(Number(previous.latitude), minLat, maxLat, box.y + 8, box.height - 16) },
      end: { x: scale(Number(current.longitude), minLon, maxLon, box.x + 8, box.width - 16), y: scale(Number(current.latitude), minLat, maxLat, box.y + 8, box.height - 16) },
      thickness: 1.5, color: rgb(0.05, 0.45, 0.75),
    });
  }
  writer.page.drawRectangle({ x: box.x, y: box.y, width: box.width, height: box.height, borderWidth: 0.5, borderColor: rgb(0.65, 0.65, 0.65) });
  writer.y = box.y - 12;
}

function renderTolls(writer, result) {
  const language = writer.language;
  const countryNames = new Intl.DisplayNames([language], { type: "region" });
  const tolls = result?.metadata?.tolls;
  writer.heading(language === "de" ? "Maut und Vignetten" : "Tolls and vignettes", 2);
  if (!tolls) { writer.text(language === "de" ? "Keine Mautdaten in der Routing-Antwort." : "No toll data was returned by the routing response."); return; }
  const money = (amount, currency = tolls.currency || "EUR") => amount == null ? (language === "de" ? "nicht verfügbar" : "not available") : new Intl.NumberFormat(language, { style: "currency", currency }).format(Number(amount));
  writer.row(language === "de" ? "Geschätzte Gesamtkosten" : "Estimated total", money(tolls.total));
  for (const item of Array.isArray(tolls.countries) ? tolls.countries : []) {
    const country = item.country ? countryNames.of(String(item.country)) || item.country : "-";
    writer.bullet(`${country}: ${money(item.total ?? item.amount, item.currency || tolls.currency)} | ${item.system || "-"} | ${item.status || "-"}`);
    if (item.tariff) writer.text(item.tariff, { indent: 18, size: 8.5, color: rgb(0.3, 0.3, 0.3) });
  }
  for (const item of Array.isArray(tolls.objects) ? tolls.objects : []) writer.bullet(`${item.name || item.type || "-"}: ${money(item.cost_eur)}${item.country ? ` (${countryNames.of(String(item.country)) || item.country})` : ""}`);
  if (tolls.coverage_note) writer.text(`${language === "de" ? "Datenhinweis" : "Data note"}: ${tolls.coverage_note}`, { size: 8.5 });
  if (result.metadata.tariff_basis_uncertain) writer.text(language === "de" ? "Tarifannahme: Emissionsklasse nicht bestätigt; Beträge sind Schätzungen." : "Tariff assumption: emission class not confirmed; amounts are estimates.", { size: 8.5 });
}

export async function createTravelPlanPdf({ language = "en", profile = null, state = {}, result = null, title = "Camper Route Planner" }) {
  if (!result || !result.geometry || !Array.isArray(result.geometry.points) || result.geometry.points.length < 2) throw new Error("A valid calculated route is required");
  const document = await PDFDocument.create();
  const fonts = { regular: await document.embedFont(StandardFonts.Helvetica), bold: await document.embedFont(StandardFonts.HelveticaBold) };
  const writer = new PdfWriter(document, fonts, language);
  const de = language === "de";
  writer.heading("SmartCamper 765", 1);
  writer.text(title, { size: 14, bold: true });
  writer.text(de ? "Reiseplan" : "Travel plan", { size: 12 });
  writer.rule();
  writer.row(de ? "Erstellt" : "Created", formatDate(result.created_at, language));
  writer.row(de ? "Start" : "Start", state.origin?.label || state.origin?.address || `${formatNumber(Number(state.origin?.latitude), language, 5)}, ${formatNumber(Number(state.origin?.longitude), language, 5)}`);
  writer.row(de ? "Ziel" : "Destination", state.destination?.label || state.destination?.address || `${formatNumber(Number(state.destination?.latitude), language, 5)}, ${formatNumber(Number(state.destination?.longitude), language, 5)}`);
  writer.row(de ? "Provider" : "Provider", result.provider);
  writer.row(de ? "Entfernung" : "Distance", `${formatNumber(Number(result.distance_m) / 1000, language, 1)} km`);
  writer.row(de ? "Fahrzeit" : "Travel time", `${Math.floor(Number(result.duration_s) / 3600)} h ${Math.round((Number(result.duration_s) % 3600) / 60)} min`);
  const waypoints = Array.isArray(state.waypoints) ? state.waypoints : [];
  if (waypoints.length) writer.row(de ? "Zwischenziele" : "Waypoints", waypoints.map((point) => point.label || point.address || `${point.latitude}, ${point.longitude}`).join("; "));
  writer.heading(de ? "Fahrzeugdaten" : "Vehicle details", 2);
  if (profile) {
    writer.row(de ? "Name" : "Name", profile.name);
    writer.row(de ? "Typ" : "Type", profile.vehicle_kind);
    writer.row(de ? "Maße" : "Dimensions", `${profile.length_m} x ${profile.width_m} x ${profile.height_m} m`);
    writer.row(de ? "Zulässiges Gesamtgewicht" : "Gross weight", `${profile.gross_weight_kg} kg`);
    writer.row(de ? "Achsen" : "Axles", profile.axles);
    writer.row(de ? "Kraftstoff" : "Fuel", profile.fuel_type);
    if (profile.emission_class) writer.row(de ? "Euro-Schadstoffklasse" : "Emission class", profile.emission_class.toUpperCase());
    if (profile.co2_class) writer.row(de ? "CO2-Klasse" : "CO2 class", profile.co2_class.toUpperCase());
    if (profile.first_registration) writer.row(de ? "Erstzulassung" : "First registration", profile.first_registration);
    if (profile.consumption_l_per_100km != null) writer.row(de ? "Verbrauch" : "Consumption", `${profile.consumption_l_per_100km} l/100 km`);
  }
  drawRouteMap(writer, result);
  writer.heading(de ? "Grenzübergänge" : "Border crossings", 2);
  const crossings = result.metadata?.border_crossings;
  if (Array.isArray(crossings) && crossings.length) for (const crossing of crossings) writer.bullet(`${crossing.from_country || "?"} -> ${crossing.to_country || "?"}: ${crossing.name || (de ? "konkreter Übergang nicht verfügbar" : "specific crossing unavailable")}; ${crossing.wait_min == null ? (de ? "keine aktuellen Wartezeitdaten" : "no current wait-time data") : `${crossing.wait_min} min`}`);
  else writer.text(result.metadata?.border_state === "unordered_international" ? (de ? "Internationale Route erkannt; Reihenfolge nicht eindeutig." : "International route detected; order is not unambiguous.") : (de ? "Keine Grenzübergänge auf dieser Route." : "No border crossings on this route."));
  renderTolls(writer, result);
  writer.heading(de ? "Weitere Reiseinformationen" : "Additional travel information", 2);
  writer.text(de ? "Verkehr, Baustellen, Umweltzonen, Rastplätze und Kraftstoffbedarf werden nur ausgegeben, wenn die Routing-Antwort diese Daten enthält." : "Traffic, roadworks, low-emission zones, rest areas and fuel demand are shown only when returned by the routing response.");
  if (Array.isArray(result.warnings) && result.warnings.length) {
    writer.heading(de ? "Warnungen" : "Warnings", 2);
    result.warnings.forEach((warning) => writer.bullet(warning));
  }
  writer.pages.forEach((page, index) => {
    page.drawText(`${de ? "Camper Route Planner - Reiseplan" : "Camper Route Planner - Travel plan"} | ${index + 1}/${writer.pages.length}`, { x: MARGIN, y: 20, size: 8, font: fonts.regular, color: rgb(0.4, 0.4, 0.4) });
  });
  return document.save();
}

export function pdfFileName(routeName = "reiseplan") {
  const safe = String(routeName || "Camper").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "Camper";
  const date = new Date().toISOString().slice(0, 10);
  return `Camper-Route-${safe}-${date}.pdf`;
}

export function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return "downloaded";
}
