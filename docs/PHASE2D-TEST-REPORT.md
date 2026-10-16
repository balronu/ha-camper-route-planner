# Phase 2D – Test- und Abschlussbericht

## Umfang

Lokale Prüfung von GPX-Export, Lovelace-Anbindung und Regressionen. Es wurden
keine produktiven Systeme, Secrets, Live-Nakordoni-/CARTO-Endpunkte oder
fremde Repositories verwendet.

## Testergebnisse

| Prüfung | Ergebnis |
|---|---:|
| Python-Offline-Tests | **26/26 PASS** |
| Frontend Unit-/Static-Tests | **10/10 PASS** |
| Frontend Build | **PASS** |
| Compileall | **PASS** |
| Chromium-E2E | **PASS** – Export, Mock-Tiles 200/403/429/Timeout, Desktop/Mobil/Dark |
| HA-Fixture-Regression | **2/2 PASS** aus Phase 2C; Export-Code zusätzlich offline geprüft |
| Hassfest | **BLOCKED** – lokale vollständige Abhängigkeiten nicht vertretbar installierbar |
| WebKit/iOS-E2E | **BLOCKED** – Browser/Host-Abhängigkeiten fehlen |
| Sygic-Gerätetest | **NOT RUN** – keine Geräte-/Produktivinstallation |
| Secret-Scan | **PASS** – keine Schlüssel in Code, Bundle oder Testdaten |

## Abnahmematrix

| Kriterium | Status | Nachweis / Einschränkung |
|---|---|---|
| P2D-01 GPX-1.1-Route | PASS | `rte/rtept`, XML-Tests |
| P2D-02 GPX-1.1-Track | PASS | vorhandene Geometrie, fehlende Geometrie abgelehnt |
| P2D-03 Kombiniert | PASS | Route und Track in einer Datei |
| P2D-04 Zwischenzielreihenfolge | PASS | Start → Via → Ziel |
| P2D-05 Providerunabhängigkeit | PASS | nur normalisiertes Modell |
| P2D-06 XML/Dateiname | PASS | Escaping, Koordinaten- und Größenprüfung |
| P2D-07 Lovelace-Export | PASS | expliziter Klick, Chromium geprüft |
| P2D-08 Gespeicherte Routen | PASS | WebSocket-/Backend-Pfad vorhanden; mobiles Gerät offen |
| P2D-09 Chromium-E2E | PASS | lokale Mock-Umgebung |
| P2D-10 HA-Fixture-Regression | WARN | Phase-2C-Fixtures PASS; vollständiger Phase-2D-HA-Lauf offen |
| P2D-11 Sygic dokumentiert | WARN | offizieller GPS-Import belegt, Truck-&-Caravan-GPX offen |
| P2D-12 keine Routing-Aufrufe | PASS | Export nutzt keinen Provider |
| P2D-13 CARTO/SVG-Regression | PASS | bestehende Browser-Mocks PASS |
| P2D-14 Beta-Readiness | PASS | `BETA-READINESS.md` |
| P2D-15 keine produktiven Änderungen | PASS | lokal, kein Push/Release |

## Sygic und nächste Entscheidung

Die offizielle GPS-Navigation-Dokumentation beschreibt GPX-Import, weist aber
auf eine Neuberechnung mit aktuellen Kartendaten hin. Für Sygic Truck &
Caravan sind Fahrzeugprofile und ein separater Route-Sender dokumentiert;
eine identische GPX-Unterstützung ist nicht verifiziert. Details stehen in
`docs/SYGIC-COMPATIBILITY.md`.

**Gesamtentscheidung: CONDITIONAL GO für eine weitere technische Validierung,
NO-GO für Beta-Veröffentlichung oder produktive Installation.** Phase 2E wird
nicht begonnen.
