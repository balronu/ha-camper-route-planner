# Phase 2G – Testbericht

## Offline-Abdeckung

Die Phase testet synthetisch: vollständiges Profil, Pflichtfeldfehler, Achszahl, explizites `vehicle_type`, Ausschluss der Lkw-Fahrerzeiten, Mock-Provider-Erhalt, manuelle Berechnung, PKCE/State, Tokenfehler, Quoten-Normalisierung, sichere Links, Mautstatus und Providerfehler.

Auszuführen sind außerdem die bestehenden Python-, Frontend-, Build-, HA-Fixture-, Chromium-, Compileall-, JSON-, Übersetzungs- und Secret-Scans. Nicht ausgeführte Hassfest-/WebKit-/Live-/Installationsprüfungen werden als BLOCKED oder NOT RUN ausgewiesen.

## Tatsächlicher Lauf auf Phase-2G-Branch

- Python unittest: **37/37 PASS**
- JSON und `compileall`: **PASS**
- `git diff --check`: **PASS**
- Frontend Node tests: **10/10 PASS**
- Frontend build: **PASS**
- Chromium-E2E: **PASS**
- Frontend-Secret-/Endpoint-Schranke: **PASS**
- Hassfest lokal: **BLOCKED** (`hassfest` nicht installiert)
- HA-Fixtures via pytest: **BLOCKED** (`pytest` nicht installiert)
- WebKit/iOS: **NOT RUN**
- Live-Nakordoni, Installations-, Update- und Deinstallationstests: **NOT RUN**

## Freigabegrenze

Ein grüner Offline-Test ist kein Nachweis für sichere oder rechtlich zulässige Wohnmobilnavigation. Phase 2G endet vor Live-Routing und vor einer Veröffentlichung.
