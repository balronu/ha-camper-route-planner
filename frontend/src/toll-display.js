import { t } from "./localization.js";

const COUNTRY_NAMES = {
  AT: { de: "Österreich", en: "Austria" },
  BE: { de: "Belgien", en: "Belgium" },
  BG: { de: "Bulgarien", en: "Bulgaria" },
  CH: { de: "Schweiz", en: "Switzerland" },
  CZ: { de: "Tschechien", en: "Czechia" },
  DE: { de: "Deutschland", en: "Germany" },
  DK: { de: "Dänemark", en: "Denmark" },
  ES: { de: "Spanien", en: "Spain" },
  FR: { de: "Frankreich", en: "France" },
  HR: { de: "Kroatien", en: "Croatia" },
  HU: { de: "Ungarn", en: "Hungary" },
  IT: { de: "Italien", en: "Italy" },
  LI: { de: "Liechtenstein", en: "Liechtenstein" },
  LU: { de: "Luxemburg", en: "Luxembourg" },
  NL: { de: "Niederlande", en: "Netherlands" },
  PL: { de: "Polen", en: "Poland" },
  PT: { de: "Portugal", en: "Portugal" },
  RO: { de: "Rumänien", en: "Romania" },
  SE: { de: "Schweden", en: "Sweden" },
  SI: { de: "Slowenien", en: "Slovenia" },
  SK: { de: "Slowakei", en: "Slovakia" },
};

const KNOWN_PROVIDER_HINTS = [
  { pattern: /emission\s+class\s+not\s+given/i, key: "providerEmissionAssumed" },
  { pattern: /euro\s*6\s+assumed/i, key: "providerEmissionAssumed" },
  { pattern: /(?:includes?|incl\.?|including)\s+(?:the\s+)?(?:vat|value\s+added\s+tax)/i, key: "providerVatIncluded" },
  { pattern: /converted\s+to\s+(?:eur|euro)/i, key: "providerConvertedToEur" },
  { pattern: /(?:vignette|daily fee|daily charge).*(?:valid|period|day)/i, key: "providerPeriodCharge" },
  { pattern: /(?:city|urban)\s+(?:access|entry)\s+(?:fee|charge)/i, key: "providerCityAccess" },
  { pattern: /truck\s+tariff.*(?:motorhome|camper|rv)/i, key: "providerTruckTariff" },
  { pattern: /truck\s*\(hgv\)\s+toll\s+rates.*motorhome/i, key: "providerTruckTariff" },
  { pattern: /(?:average\s+)?network\s+(?:price|average)|network\s+average/i, key: "providerNetworkAverage" },
];

export function formatTollAmount(value, currency = "EUR", language = "en") {
  if (value == null || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${value} ${currency}`;
  try {
    return new Intl.NumberFormat(language === "de" ? "de-DE" : "en-US", {
      style: "currency",
      currency: String(currency || "EUR").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch (_error) {
    return `${numeric.toFixed(2)} ${currency || "EUR"}`;
  }
}

export function tollCountryName(value, language = "en") {
  const code = String(value ?? "").trim().toUpperCase();
  return COUNTRY_NAMES[code]?.[language] || value || "—";
}

function knownProviderHint(raw, language) {
  const note = String(raw ?? "").trim();
  if (!note) return null;
  const match = KNOWN_PROVIDER_HINTS.find((item) => item.pattern.test(note));
  if (!match) return null;
  const remainder = note
    .replace(match.pattern, "")
    .replace(/^[\s:;,.()-]+|[\s:;,.()-]+$/g, "")
    .trim();
  return { text: t(language, match.key), original: remainder };
}

export function classifyProviderText(raw, language = "en") {
  const note = String(raw ?? "").trim();
  if (!note) return { known: [], unknown: [] };
  const known = knownProviderHint(note, language);
  return known ? { known: [known], unknown: [] } : { known: [], unknown: [note] };
}

export function tollCalculationText(item, language = "en") {
  let distance = item?.distance_km ?? item?.kilometers ?? item?.km;
  let rate = item?.rate_eur_per_km ?? item?.rate_per_km ?? item?.price_per_km;
  if ((distance == null || rate == null) && typeof item?.tariff === "string") {
    const match = item.tariff.match(/([\d.,]+)\s*km\s*x\s*([\d.,]+)\s*(?:EUR|€)\s*\/\s*km/i);
    if (match) {
      distance = Number(match[1].replace(/,/g, ""));
      rate = Number(match[2].replace(",", "."));
    }
  }
  if (distance == null || rate == null) return "";
  const distanceText = new Intl.NumberFormat(language === "de" ? "de-DE" : "en-US", { maximumFractionDigits: 1 }).format(Number(distance));
  const rateText = formatTollAmount(rate, "EUR", language);
  return `${t(language, "tollCalculationBasis")}: ${distanceText} km × ${rateText}/km`;
}
