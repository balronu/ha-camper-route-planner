# Camper Route Planner – Phase 2C Validierungsabschluss

Stand: 2026-10-16

## Testzahlen

| Bereich | Ergebnis |
|---|---|
| Python-Unittest/Offline-Suite | PASS – 21/21 |
| Python pytest mit HA-Umgebung | PASS – 21/21 Offline-Tests |
| Echte HA-Fixtures | PASS – 2/2 |
| Frontend-Node-Tests | PASS – 8/8 |
| Frontend-Produktionsbuild | PASS |
| Chromium-Browser-E2E | PASS – Erfolg, 403, 429, Timeout, Desktop/Tablet/Mobil |
| Desktop-/Mobil-Screenshots | PASS – erzeugt |
| WebKit-E2E | BLOCKED – fehlende Host-Bibliotheken |
| Hassfest | BLOCKED – vollständige Validierungsabhängigkeiten konnten wegen Speicherplatz/Dependency-Auflösung nicht bereitgestellt werden |
| Live-CARTO/Nakordoni | NOT RUN – verbindlich ausgeschlossen |

## Korrekturen aus der Validierung

1. Die Browser-E2E-Prüfung zeigte, dass Leaflet selbst ein SVG-Overlay rendert;
   die Assertion wurde auf den echten Fallback-Knoten begrenzt.
2. Nach einem Tile-Fehler wurde der Kartenstatus auf `invalid` gesetzt, damit
   der erneute Card-Render nicht sofort wieder Leaflet startet. Dadurch bleibt
   der SVG-Fallback stabil.
3. Der E2E-Harness wartet nun korrekt auf den lokalen Testserver und prüft
   zusätzlich die explizite Service-Aktion.

## P2C-Abnahmekriterien

| Kriterium | Status | Nachweis |
|---|---|---|
| P2C-01 Projekt-/Berichtslage geprüft | PASS | Phase-2A/2B/Map-Berichte und Bestand geprüft |
| P2C-02 isolierte Testabhängigkeiten | PASS | `/tmp`-Umgebung; keine Systeminstallation |
| P2C-03 Hassfest/offizielle HA-Validierung | BLOCKED | Hassfest-Lauf nicht vollständig ausführbar |
| P2C-04 HA-Config-/Options-/Service-/WS-Fixtures | PASS | 2 echte HA-Fixture-Tests |
| P2C-05 Storage und Wiederanlauf | PASS | Offline-Migration/Store plus HA-Entry-Setup |
| P2C-06 Chromium-Browser-E2E | PASS | lokaler Playwright-Harness |
| P2C-07 CARTO Tile-Mocks | PASS | Erfolg, 403, 429, Timeout und SVG-Fallback |
| P2C-08 Desktop/Tablet/Mobil und Dark-Mode | PASS | E2E-Viewport-/Media-Emulation; Screenshots Desktop/Mobil |
| P2C-09 ausschließlich manuelle Berechnung | PASS | keine Berechnung beim Rendern, Berechnung nur Klick |
| P2C-10 Secret-/URL-/Log-Sicherheit | PASS | Credential- und Live-Endpoint-Scans; nur Browser-safe Mock-Key |
| P2C-11 WebKit/iOS und Resource-Registrierung | WARN/BLOCKED | WebKit-Hostlibs fehlen; automatische Resource-Registrierung nicht Bestandteil der aktuellen Architektur |
| P2C-12 Dokumentation/Abschluss | PASS | drei Phase-2C-Berichte und Screenshots erstellt |

## Risiken und Einschränkungen

- Hassfest muss in CI oder einer vollständigen HA-Core-Entwicklungsumgebung
  nachgeholt werden.
- WebKit/iOS ist lokal wegen fehlender Host-Bibliotheken offen.
- Die Lovelace-Ressource wird derzeit manuell versioniert eingebunden; eine
  automatische HA-Resource-Registrierung wurde nicht eingeführt.
- Ein CARTO-Key ist absichtlich im Browser-Netzwerk sichtbar. Es darf daher
  ausschließlich ein eingeschränkter, browsergeeigneter Basemap-Key verwendet
  werden.
- Es wurden keine Live-Kartenkacheln, Live-Nakordoni-Aufrufe oder produktive
  Secrets verwendet.

## Gesamtentscheidung für Phase 2D

**CONDITIONAL GO**.

Die lokale Funktionalität und die HA-/Chromium-Validierung sind ausreichend
für eine nächste isolierte Phase. Vor einer produktiven Beta-Installation
müssen Hassfest, WebKit/iOS-Kompatibilität und die endgültige Resource-
Registrierungsstrategie separat geschlossen werden. Phase 2D wurde nicht
begonnen.
