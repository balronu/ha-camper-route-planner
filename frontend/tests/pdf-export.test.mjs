import assert from "node:assert/strict";
import test from "node:test";
import { createTravelPlanPdf, pdfFileName } from "../src/pdf-export.js";

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
