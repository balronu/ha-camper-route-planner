# Phase 2B – Implementierungsbericht

**Stand:** 16.10.2026
**Version:** `v0.1.0-alpha.1`, lokaler Kandidat
**Scope:** Lovelace-Karte und editor-sichere Backend-Schnittstellen, lokal/staged.

## Implementiert

- `frontend/src/camper-route-planner-card.js`: responsive Shadow-DOM-Karte
  `custom:camper-route-planner-card` mit Fahrzeugauswahl, Koordinaten,
  Waypoints, manueller Berechnung, Ergebnis, Speichern/Laden/Löschen.
- `frontend/src/map-view.js`: interaktive SVG-Geometrieansicht mit Fit-to-
  bounds, Start/Ziel/Waypoints, Wheel-Zoom und Pointer-Pan.
- `frontend/src/localization.js`: deutsche und englische Oberfläche anhand der
  HA-Sprache.
- `frontend/src/services.js`: ausschließlich authentifizierte HA-WebSocket-
  Kommandos und den HA-WebSocket-Serviceaufruf, kein direkter Browser-HTTP-Code.
- `custom_components/.../websocket_api.py`: Profile, Routenliste, Laden,
  Löschen und explizites Speichern ohne `.storage`-Zugriff im Browser.
- `frontend/scripts/build.mjs`: reproduzierbarer Bundle-Build ohne
  Laufzeit-CDN und ohne externe Produktionsabhängigkeit.
- Backend-Storage erweitert um request-/geometry-bezogene Routendaten und
  explizite Save/Delete-Operationen.

## Bewusste Grenzen

- Die Karte zeigt keine echten Hintergrundkacheln; dadurch gibt es keine
  unzulässige Nutzung öffentlicher Tile-Server und keine Drittanbieter-
  Standortübertragung. Der SVG-Fallback ist funktionsfähig.
- Mock-Ergebnisse sind sichtbar als synthetisch/nicht geprüfte Straßenroute
  markiert.
- Kein Geocoding, kein GPS-Autofill und keine automatische Berechnung.
- Keine produktive Lovelace-Ressource wurde registriert.
- Browser-E2E, HA-Fixtures, Hassfest und echtes HA-Laden wurden nicht
  durchgeführt, sofern die lokale Umgebung sie nicht bereitstellt.
