# Phase 2Q – Lovelace-Kartenkatalog-Diagnose

## Live-Befund auf VM 104

Die read-only Abfragen wurden am 21.10.2026 gegen die produktive Home-Assistant-
Instanz ausgeführt:

- Home Assistant: `2026.10.2`, Zustand `RUNNING`
- HACS: Camper Route Planner `v0.1.0-beta.5`, installiert; `pending_update=true`
  auf dem verfügbaren Main-Commit `c1c27e1`
- Config Entry `camper_route_planner`: geladen; Provider `mock`, Kartenanbieter
  `none`
- Der Kartenkatalog hat keinen separaten HACS-Lovelace-Eintrag für Camper Route
  Planner. Das ist korrekt: Die Karte wird vom Integration-Static-Path
  `/camper_route_planner/camper-route-planner-card.js?v=0.1.0-beta.5` registriert.
- Die HACS-/Dashboard-Resource-Liste enthält zusätzlich die unabhängige lokale
  Ressource `/flightradar24/flightradar24-card.js?v=v2.3.0`.

Der exakte Inhalt der produktiv ausgelieferten JavaScript-Datei konnte über den
unterstützten read-only HA-Zugriff nicht als Datei-Download bezogen werden. Die
installierte Version und der zugehörige Beta-5-Bundle-Inhalt wurden daher gegen
das veröffentlichte Beta-5-Artefakt geprüft: Release-ZIP SHA-256
`3da19eb13065dc1632fd850e6e9f05ee053c7d643d6c3e1e540a8c2bb4d0e24b`; der darin
enthaltene Frontend-Bundle-Hash ist `76dacfa6541145fb0f68e7a019f03415334c75c3314387559cfeceb64d087145`.

## Nachgewiesene Browser-Ursache

Home Assistant hat sechs echte Browserfehler aus Chrome 155 protokolliert. Die
Fehler traten in den Leaflet-Implementierungen von Camper Travel Journal und
Camper Route Planner auf, während der Aufrufer die Resize-/Viewport-Logik der
separaten Flightradar24-Karte war:

```text
TypeError: Cannot read properties of undefined (reading '_leaflet_pos')
getPosition (.../camper_route_planner/camper-route-planner-card.js:1594:21)
NewClass._getMapPanePos (...:3013:20)
NewClass._rawPanBy (...:2855:45)
NewClass.invalidateSize (...:2367:22)
Flightradar24Card._applyAreaViewport (.../flightradar24-card.js:1643:9)
```

Die Ursache ist damit ein Karten-Interop-Konflikt: Beta.5 speicherte den
Leaflet-Handle unter dem generischen DOM-Eigenschaftsnamen `_leafletMap` und
verwendete die generische Klasse `leaflet-map`. Die lokale Flightradar24-
Ressource behandelte dadurch die Camper-Karte beim eigenen Viewport-Resize wie
ihre eigene Karte. Nach einem Destroy/Neuaufbau blieb ein fremder Resize-Aufruf
auf einer bereits entfernten Leaflet-Map möglich; dadurch entstand der
`_leaflet_pos`-Fehler und die Vorschau blieb im Katalog hängen.

Es handelt sich **nicht** um einen fehlenden HACS-Katalogeintrag, einen Fehler
in `getStubConfig()`, `getConfigElement()`, `setConfig()` oder der automatischen
Config-Entry-Erkennung.

## Lokaler Fix

- Leaflet-Handle auf ein internes `Symbol` gekapselt; `_leafletMap` wird nicht
  mehr am DOM-Container veröffentlicht.
- Generische Klasse `leaflet-map` durch `crp-leaflet-map` ersetzt.
- Camper Travel Journal, Flightradar24, YAML, Config Entries und VM 104 wurden
  nicht verändert.
- Browser-Regressionstest prüft explizit, dass Handle und generische Klasse
  nicht mehr für Fremdkarten sichtbar sind.

## Validierung

- Python-Unittest: **PASS – 40/40**
- Frontend-Tests: **PASS – 12/12**
- Frontend-Build und synchronisiertes Installations-Bundle: **PASS**
- Chromium Desktop/Mobile einschließlich erfolgreicher Kacheln, 403, 429 und
  Timeout-Fallback: **PASS**
- JSON, `compileall`, `git diff --check`: **PASS**
- HA-Fixture pytest: **NOT RUN/BLOCKED** – isolierte pytest-/HA-Abhängigkeiten
  waren in dieser Arbeitskopie nicht installiert; VM 104 wurde dafür nicht
  verwendet.
- Hassfest, HACS-Gate und Gitleaks: **NOT RUN** – kein CI-Lauf ohne Push/PR.
- Direkte interaktive Browsersteuerung der produktiven HA-Oberfläche:
  **NOT TESTED** – die vorhandene Browserinstanz war nicht mit einer
  authentifizierten HA-Seite verbunden. Die produktiven Chrome-Fehler stammen
  jedoch aus HA-Systemlog und sind real erfasst.

Dieser Fix ist ein lokaler, noch nicht veröffentlichter Kandidat. Kein Push,
Merge, Tag, GitHub-Release, HACS-Update, HA-Neustart oder Dashboard-Update
wurde durchgeführt.
