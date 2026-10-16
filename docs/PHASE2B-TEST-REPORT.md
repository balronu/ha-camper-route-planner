# Phase 2B – Testbericht

## Lokale Ergebnisse

| Prüfung | Ergebnis |
|---|---|
| Frontend-Build (`npm run build` in `frontend/`) | **PASS** |
| Frontend-Node-Tests | **PASS – 6/6** |
| Frontend-Bundle Syntax (`node --check`) | **PASS** |
| Python-Suite | **PASS – 17/17** |
| Python Compileall | **PASS** |
| JSON-Prüfungen | **PASS** |
| Secret-/Private-Value-Scan | **PASS** |
| Direkter HTTP-/Nakordoni-Scan im Frontend | **PASS – nicht vorhanden** |
| Pytest | **BLOCKED – nicht installiert** |
| Playwright/Browser-E2E | **BLOCKED – nicht installiert** |
| HA-Testfixtures/Hassfest | **BLOCKED / NOT RUN – HA-Umgebung nicht installiert** |
| PyYAML/services.yaml | **BLOCKED – PyYAML nicht installiert** |
| Produktive HA-/Dashboard-/VM-/Proxmox-Prüfung | **NOT RUN – ausdrücklich verboten** |

Ausführung:

```text
cd frontend && npm run build && npm test
6 tests ... pass
node --check frontend/dist/camper-route-planner-card.js
PYTHONPATH=src:. python3 -m unittest discover -s tests -v
Ran 17 tests ... OK
```

Die Frontend-Tests sind bewusst DOM-frei und prüfen Utils, Lokalisierung,
Registrierungsvertrag, Editor-API, Secret-/Endpoint-Abwesenheit und die
manuelle Action-Grenze. Ein echter Browserlauf ist damit nicht bewiesen.

Ein isolierter Chromium-Preview mit synthetischem HA-Objekt wurde lokal erzeugt:

![Lokaler Karten-Preview](phase2b-card-preview.png)

Das ist ein visueller Render-Check, kein HA-Integrationstest und kein
produktiver Dashboard-Screenshot.

## Abnahme Phase 2B

| Kriterium | Status | Begründung |
|---|---|---|
| Karte gebaut/ladefähig | **PASS (lokal)** | Bundle wird reproduzierbar erzeugt; echte HA-Ressource nicht registriert. |
| Desktop/Mobil | **PASS (Design/Code)** | Responsive CSS und Touch-Pan/Zoom vorhanden; E2E offen. |
| Mehrere Profile | **PASS (Vertrag)** | Profile werden per WebSocket gelesen und auswählbar dargestellt. |
| Mock-Routen interaktiv | **PASS (lokal)** | SVG-Geometrie, Marker, Zoom/Pan und Mock-Hinweis vorhanden. |
| Nur manuelle Berechnung | **PASS** | Nur Button-Handler ruft den HA-Service auf. |
| Gespeicherte Routen | **PASS (Vertrag/Offline)** | WS-Liste/Laden/Speichern/Löschen; echte HA-Ausführung offen. |
| DE/EN | **PASS** | Dictionary und HA-Locale-Erkennung getestet. |
| Build/Tests | **PASS** | 6 Frontend- und 17 Backend-Tests bestanden. |
| Keine Live-API | **PASS** | Kein HTTP-Client, keine Nakordoni-URL, keine Secrets im Bundle. |
| Produktivsysteme unverändert | **PASS** | Keine HA-/VM-/Dashboard-/Proxmox-/Repo-Änderung. |

## Empfehlung Phase 2C

**CONDITIONAL GO für eine isolierte HA-Fixture-/Browser-Validierungsphase.**
Vor Phase 2C müssen HA 2026.10.x, Hassfest, PyYAML und ein Browser-Testlauf
verfügbar sein. Eine produktive Installation, Tile-Quelle oder Live-Nakordoni-
Freischaltung ist nicht Bestandteil dieser Empfehlung.
