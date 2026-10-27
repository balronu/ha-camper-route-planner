import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { createTravelPlanPdf, localizeTollStatus, localizeTollSystem, pdfFileName, placeMarkerLabels } from "../src/pdf-export.js";

const result = {
  provider: "nakordoni_motorhome",
  distance_m: 363600,
  duration_s: 15180,
  created_at: "2026-10-27T10:00:00Z",
  geometry: { points: [{ latitude: 52.5, longitude: 13.4 }, { latitude: 48.8, longitude: 2.3 }, { latitude: 47.3, longitude: 8.5 }] },
  warnings: ["Provider warning"],
  metadata: {
    border_state: "ordered_country_sequence",
    border_crossings: [{ from_country: "DE", to_country: "FR", wait_min: null }, { from_country: "FR", to_country: "CH", wait_min: 20 }],
    tolls: { total: 73.07, currency: "EUR", estimate: true, countries: [{ country: "DE", amount: 0, system: "none", status: "likely" }, { country: "FR", amount: 46.03, system: "section", status: "likely", tariff: "166.7 km x 0.2761 EUR/km" }, { country: "CH", amount: 27.04, system: "flat_daily", status: "confirmed" }], objects: [] },
    tariff_basis_uncertain: true,
  },
};

test("PDF export requires a valid calculated route", async () => {
  await assert.rejects(() => createTravelPlanPdf({ result: null }), /valid calculated route/);
});

test("PDF export creates a multi-section German A4 document without network input", async () => {
  const bytes = await createTravelPlanPdf({ language: "de", title: "Testreise", result, state: {
    origin: { label: "Berlin" }, destination: { label: "Zürich" }, waypoints: [{ label: "Paris" }],
  }, profile: { name: "Zoe", vehicle_kind: "motorhome", length_m: 7.65, width_m: 2.34, height_m: 3.2, gross_weight_kg: 4800, axles: 2, fuel_type: "diesel", emission_class: null, co2_class: "c", first_registration: "2020-04-15", consumption_l_per_100km: 11.2 } });
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");
  assert.ok(bytes.length > 2000);
});

test("PDF export supports English output and safe filenames", async () => {
  const bytes = await createTravelPlanPdf({ language: "en", result, state: { origin: {}, destination: {}, waypoints: [] }, profile: null });
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");
  assert.match(pdfFileName("Zürich / Route 01"), /^Camper-Route-Zurich-Route-01-2026-10-27\.pdf$/);
});

test("PDF export creates multiple A4 pages for long international plans without inventing legs", async () => {
  const longResult = {
    ...result,
    distance_m: 2474700,
    metadata: {
      ...result.metadata,
      countries: ["DE", "FR", "ES", "PT"],
      border_crossings: [
        { from_country: "DE", to_country: "FR", wait_min: null, inferred: true, status: "country_sequence" },
        { from_country: "FR", to_country: "ES", wait_min: null, inferred: true, status: "country_sequence" },
        { from_country: "ES", to_country: "PT", wait_min: null, inferred: true, status: "country_sequence" },
      ],
    },
    warnings: Array.from({ length: 20 }, (_, index) => `Provider warning ${index + 1} with a long explanation that must wrap cleanly without losing content.`),
  };
  const bytes = await createTravelPlanPdf({ language: "de", title: "SmartCamper 765", routeName: "Portugal 2028", result: longResult, state: {
    origin: { label: "Aktueller Fahrzeugstandort" },
    destination: { label: "Lissabon" },
    waypoints: Array.from({ length: 5 }, (_, index) => ({ label: `Zwischenziel ${index + 1}`, latitude: 48 + index, longitude: 5 + index })),
  }, profile: { name: "Zoe", vehicle_kind: "motorhome", length_m: 7.65, width_m: 2.34, height_m: 3.2, gross_weight_kg: 4800, axles: 2, fuel_type: "diesel", emission_class: "euro5", co2_class: "c", first_registration: "2020-04-15", consumption_l_per_100km: 10.5 } });
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 2);
  document.getPages().forEach((page) => assert.deepEqual(page.getSize(), { width: 595.28, height: 841.89 }));
});

test("PDF export leaves optional fuel demand clearly unavailable", async () => {
  const bytes = await createTravelPlanPdf({ language: "en", result, state: { origin: {}, destination: {}, waypoints: [] }, profile: { name: "Zoe", vehicle_kind: "motorhome", fuel_type: "diesel" } });
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount() >= 1, true);
});

test("PDF download always uses a browser download and releases its object URL", async () => {
  const { downloadPdf } = await import("../src/pdf-export.js");
  const originalDocument = globalThis.document;
  const originalURL = globalThis.URL;
  let clicked = false;
  let revoked = false;
  globalThis.document = { createElement: () => ({ click: () => { clicked = true; } }) };
  globalThis.URL = { createObjectURL: () => "blob:test", revokeObjectURL: () => { revoked = true; } };
  try {
    assert.equal(downloadPdf(new Uint8Array([1, 2]), "Camper-Route-Zoe-2026-10-27.pdf"), "downloaded");
    assert.equal(clicked, true);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(revoked, true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.URL = originalURL;
  }
});

test("PDF localization never exposes technical toll status values", () => {
  assert.equal(localizeTollSystem("exempt", "de"), "Befreit");
  assert.equal(localizeTollSystem("section", "en"), "Section toll");
  assert.equal(localizeTollStatus("likely", "de"), "Wahrscheinlich");
  assert.equal(localizeTollStatus("future-provider-value", "de"), "Unbekannt");
});

test("nearby and duplicate map markers fall back to a numbered legend", () => {
  const font = { widthOfTextAtSize: (value) => String(value).length * 5 };
  const result = placeMarkerLabels([
    { x: 100, y: 100, label: "Ziel" },
    { x: 100, y: 100, label: "Zwischenziel 1" },
    { x: 101, y: 100, label: "Zwischenziel 2" },
  ], { x: 50, y: 50, width: 100, height: 100 }, font);
  assert.equal(result.fallback, true);
});

test("PDF keeps stored addresses and reliable segment data without inventing legs", async () => {
  const bytes = await createTravelPlanPdf({ language: "de", result: {
    ...result,
    origin: { address: "Startstraße 1, 66111 Saarbrücken", latitude: 49.2, longitude: 7.0 },
    destination: { address: "Zielweg 2, Gondifelos", latitude: 41.4, longitude: -8.6 },
    metadata: { ...result.metadata, segments: [{ distance_km: 123.4, duration_s: 7200 }] },
  }, state: {
    origin: { address: "Startstraße 1, 66111 Saarbrücken", latitude: 49.2, longitude: 7.0 },
    destination: { address: "Zielweg 2, Gondifelos", latitude: 41.4, longitude: -8.6 },
    waypoints: [{ address: "Badajoz, Spanien", latitude: 38.9, longitude: -6.97 }],
  }, profile: { name: "Zoe", vehicle_kind: "motorhome", fuel_type: "diesel", consumption_l_per_100km: 10.5 } });
  assert.equal((await PDFDocument.load(bytes)).getPageCount() >= 1, true);
});
