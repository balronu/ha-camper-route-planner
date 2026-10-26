import { t } from "./localization.js";

export function providerNoteText(raw, language = "en") {
  const note = String(raw ?? "").trim();
  if (!note) return "";
  const knownEmission = /^emission class\s+not\s+given\s*:\s*euro\s*6\s+assumed\b/i;
  if (knownEmission.test(note)) {
    const remainder = note.replace(knownEmission, "").trim();
    return `${t(language, "providerEmissionAssumed")}${remainder ? ` ${t(language, "providerOriginal")}: ${remainder}` : ""}`;
  }
  return `${t(language, "providerHint")}: ${note}`;
}
