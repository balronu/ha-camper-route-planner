# Phase-1-Abschlussbericht

**Stand:** 16.10.2026
**Projekt:** `camper-route-planner-phase1`
**Prüfumfang:** ausschließlich vorhandene Dokumentation, Offline-Prototyp und synthetische Tests. Keine Live-API, keine Secrets, keine HA-/VM-/Proxmox-Änderung und keine externe Veröffentlichung.

## 1. Gesamturteil

**Empfehlung: CONDITIONAL GO für `v0.1.0-alpha.1` als offline-/feature-gated Alpha.**

Die provideragnostische Architektur, Fahrzeugprofile, Fehlernormalisierung und der GPX-Prototyp sind als Phase-1-Grundlage geeignet. Ein produktiver Truck-Route-Aufruf darf in `v0.1.0-alpha.1` jedoch nur hinter einer expliziten manuellen Aktion und einem unabhängigen Verifikationsstatus stehen.

**NO-GO** besteht für die Aussagen „rechtssicheres Wohnmobilrouting“, „Truck-Route für den vorhandenen Key freigeschaltet“ und „Sygic übernimmt die Nakordoni-Strecke unverändert“. Diese Punkte sind vor produktiver Nutzung zu klären bzw. zu testen.

## 2. Prüfkriterien P1-01 bis P1-12

| Kriterium | Ergebnis | Nachweis / Restpunkt |
|---|---|---|
| P1-01 Isolierter Scope | **PASS** | Prüfung und Bericht beschränken sich auf dieses Projekt; produktive Systeme und andere Camper-Projekte blieben unangetastet. |
| P1-02 Primärquellen-Audit | **PASS** | Truck-Route-Referenz, zentrale API-Doku, Changelog und Developer Terms sind in `docs/NAKORDONI-API-AUDIT.md` vermerkt. |
| P1-03 Authentifizierung/Secrets | **PASS** | Bearer-Mechanismus dokumentiert; kein Secret gelesen, verwendet, protokolliert oder in das Projekt übernommen. |
| P1-04 Parameter/Einheiten | **PASS** | SI-Einheiten, Koordinaten, Via-/Alternativenlimits und Geometrieformate dokumentiert und im Modell validiert. |
| P1-05 Limits/Abrechnung | **WARN** | Truck Route ist eine eigene `route`-Kontingentklasse; Explorer-10/Tag und Sandbox-50/Tag widersprechen sich. Fuel Stations ist `standard`/`cheap` widersprüchlich. Plan- und Accountgrenzen offen. |
| P1-06 Wohnmobil-Eignung | **BLOCKED** | Kein dokumentierter `motorhome`-Typ und keine Providerbestätigung. Das 4,8-t-Profil passt technisch in die Parametergrenzen, beweist aber keine fachliche oder rechtliche Eignung. |
| P1-07 Recht/Maut/Ruhezeiten | **WARN** | HGV-Fahrverbote, HGV-Maut und EU-561-Ruheplanung sind höchstens Hinweise. Sie dürfen nicht als Wohnmobil-Rechtsauskunft oder Wohnmobilkosten dargestellt werden. |
| P1-08 Architektur/Storage/Manuell | **PASS (Design)** | Providergrenze, versionierter Storage, Cache-/Quota-Schutz und ausschließlich explizite Berechnung sind festgelegt; produktive HA-Wiring-Implementierung ist Phase 2. |
| P1-09 Optionale Integrationen | **PASS (Design)** | Mobile Fuel Stations und Camper Travel Journal sind getrennte, deaktivierbare Read-only-Verträge ohne Datenbankzugriff. |
| P1-10 GPX/Sygic | **WARN** | Sygic-Import ist dokumentiert; Sygic kann anhand aktueller Karten neu berechnen. Gerät, Dateifreigabe, Deep Link, Zwischenziele und Streckentreue wurden nicht getestet. |
| P1-11 Offline-Prototyp/Tests | **PASS** | 7/7 Offline-Unit-Tests bestanden; Compileall und Credential-Pattern-Scan bestanden. |
| P1-12 Produktiv-/Änderungssicherheit | **PASS** | Keine VM 104, Proxmox, HA, Secrets, Live-API, GitHub-, Merge-, Tag- oder Release-Aktion. |

## 3. Nakordoni Truck Route und das 4,8-t-Wohnmobil

Das Referenzfahrzeug ist als `motorhome` modelliert: 3,20 m Höhe, 2,34 m Breite, 7,65 m Länge und 4,8 t zulässige Gesamtmasse. Diese Werte liegen in den dokumentierten Modellgrenzen und können für eine konservative HGV-Näherung übersetzt werden.

Die Eignung bleibt dennoch **nicht verifiziert**:

- Nakordoni dokumentiert Truck/HGV-Routing, keinen eigenen Wohnmobiltyp.
- HGV-Regeln können für ein privat genutztes Wohnmobil zu streng, unvollständig oder rechtlich falsch sein.
- Länderfreigaben, lokale Beschilderung, Umweltzonen, Mautklassen und wohnmobilspezifische Ausnahmen sind nicht als vollständige Zusicherung belegt.
- `include=rest` ist Lkw-Planungshilfe und keine Aussage über die Pflicht eines privaten Wohnmobils.
- HGV-Mautwerte dürfen nicht als Wohnmobilkosten erscheinen.

UI und Datenmodell müssen deshalb sichtbar „HGV approximation; motorhome suitability unverified“ führen. Fehlende oder uneindeutige Daten bleiben `unknown`; sie werden nicht als freie Strecke interpretiert.

### API-Key, Freischaltung und Quota

Der vorhandene Mobile-Fuel-Stations-Zugang verwendet technisch denselben Bearer-Key-Mechanismus wie Truck Route. Eine Wiederverwendung ist daher technisch plausibel, aber **die konkrete Truck-Route-Freischaltung des Keys ist nicht nachgewiesen**. Es wurden weder Secrets gelesen noch ein kontingentverbrauchender Probeaufruf ausgeführt.

Die Truck-Route-Quota ist als eigene `route`-Klasse dokumentiert; die zentrale Doku nennt für Explorer 10 Aufrufe/Tag bei 2 QPS. Eine Truck-Route-Referenz nennt zusätzlich 50 Sandbox-Aufrufe/Tag. Die Fuel-Stations-Quota ist zwischen `standard` und `cheap` widersprüchlich dokumentiert. Vor Phase 2 sind Portal- oder schriftliche Accountbestätigung und die Zielmarktfreigaben erforderlich.

Camper Route Planner muss deshalb einen eigenen Credential-Slot, eigenen Verifikationsstatus (`stored` ist nicht `verified`), eigenen Quota-Guard, Cache und Fehlerstatus erhalten. Er darf weder Config Entry noch Storage der Mobile-Fuel-Stations-Integration lesen.

## 4. GPX-Übergabe an Sygic

Der Offline-Exporter erzeugt GPX 1.1 mit `rte/rtept` und zusätzlich `trk/trkseg`. Das erhöht die Importchancen; es garantiert keine identische Navigation. Sygic kann die Route nach dem Import anhand aktueller Kartendaten neu berechnen, und ein reiner Track ist laut dokumentierter Sygic-Hilfe nicht gleichbedeutend mit einer navigierbaren Route.

Für Phase 2 sind auf einem realen Zielgerät zu messen:

1. Importweg und sichtbare Route;
2. Erhalt von Start, Ziel und Zwischenzielen;
3. Differenz zwischen exportierter und neu berechneter Strecke;
4. Verhalten bei Höhen-/Gewichtsprofilen und Alternativen;
5. Abbruch-/Warnhinweis, wenn Sygic die Strecke verändert.

Bis dahin ist GPX eine Übergabehilfe, keine beweissichere Übertragung der Providerroute. Ein offizieller Deep Link ist nicht belegt.

## 5. Architektur- und Integrationsprüfung

- **Mehrere Fahrzeugprofile:** unabhängige, versionierte IDs; Maße und Gewicht werden vor dem Provideraufruf validiert. Das Carthago-Profil ist `motorhome`, die Nakordoni-Übersetzung erhält ein sichtbares Unsicherheitsflag.
- **Nur manuelle Berechnung:** nur Button/Service darf später den Provider aufrufen. Kein GPS-Listener, kein HA-Start, kein Reload, keine Kartenöffnung und kein Sensor-Refresh dürfen Routing auslösen.
- **Cache und Quota:** Schlüssel müssen Route, Profil, Provider und relevante Optionen einschließen; identische laufende Anfragen werden dedupliziert. Ein echter produktiver Cache/Coordinator ist noch nicht implementiert.
- **Optionale Schnittstellen:** Fuel- und Travel-Journal-Adapter bleiben deaktiviert, wenn die Partnerintegration fehlt; nur minimale versionierte DTOs, reversible Verknüpfung, keine Fremd-Datenbank.
- **Datenschutz:** Credentials gehören ausschließlich in einen HA-Secret- bzw. Config-Entry-Token; GPX und Diagnosen enthalten keine Header oder Secrets.

Damit ist die Architektur für die nächste Implementierungsstufe geeignet, aber noch kein produktionsfähiger HA-Adapter.

## 6. Wiederholte Offline-Verifikation

Ausgeführt im Projektverzeichnis am 16.10.2026:

```text
PYTHONPATH=src python3 -m unittest discover -s tests -v
Ran 7 tests ... OK
python3 -m compileall -q src tests
PASS
Credential-Pattern-Scan über Projektdokumente und Quelltext
PASS: kein credential-artiger Wert gefunden
```

Der im README genannte unittest-Befehl ohne `PYTHONPATH=src` scheitert in der aktuellen, nicht installierten `src`-Layout-Umgebung mit `ModuleNotFoundError: camper_route_planner`. Das ist ein reproduzierbares Umgebungsproblem; mit dem für dieses Layout erforderlichen `PYTHONPATH=src` bestanden alle sieben Tests.

Die Tests decken synthetisch ab: zwei Profile, Eingabevalidierung, Via-Limit, timezone-aware Abfahrt, deterministische Mock-Wiederholung, 401/403/429/500, ungültige Providerantworten, begrenztes Timeout sowie GPX-Route/Track ohne Bearer-Daten. Nicht ausgeführt wurden bewusst HA/Hassfest, Live-API, Sygic-Gerätetest, Kartenvisualisierung und kostenpflichtige Aufrufe.

## 7. Offene Risiken und technische Einschränkungen

1. Truck/HGV-Routing kann für das 4,8-t-Wohnmobil konservativ oder fachlich falsch sein.
2. Providerfreischaltung, Länderabdeckung, Planlimits und Overuse-Verhalten sind nicht bestätigt.
3. API-Beispiele und Feldnamen (`distance_m`/`distance_km`, `fuel`/`fuel_stations`, `parking`/`parkings`) sind nicht vollständig konsistent.
4. Lizenz-/Caching-Grenzen für langfristige Geometriespeicherung und Kartenvisualisierung müssen vor Implementierung bestätigt werden.
5. Sygic-Neuberechnung kann Zwischenziele oder Streckenführung verändern.
6. Der Prototyp enthält noch keinen echten Nakordoni-Adapter, keinen HA Config-/Options-Flow, keinen produktiven Cache und keine Geräteintegration.
7. Route- und GPS-Daten sind sensible Bewegungsdaten; lokale Speicherung, Export und Löschung brauchen ein explizites Konzept.

## 8. Voraussetzungen für Phase 2

Phase 2 darf erst nach ausdrücklicher Freigabe und nach diesen Vorbedingungen starten:

- schriftliche Nakordoni-Klärung zu Wohnmobilnutzung, Truck-Route-Freigabe, Zielmärkten, Quota und Terms;
- Entscheidung, welche HGV-Warnungen, Maut- und Ruheplaninformationen im UI überhaupt sichtbar sein dürfen;
- fachlicher Vertrag für `RouteRequest`/`RouteResult`, Fehler, Quota-Header, Versionierung, Cache-TTL und Löschung;
- HA-Domain, Config-/Options-Flow, Secret-Speicher und Statusmodell;
- vollständige Offline-Contract-Tests inklusive Cache-/Deduplizierung und Secret-Redaction;
- separat autorisierter Sygic-Test auf dem Zielgerät;
- Datenschutz- und Rückfallkonzept bei API-Ausfall, Neuberechnung und widersprüchlichen Restriktionen.

## Abschluss und Freigabestatus

Die Phase-1-Abschlussprüfung ist dokumentiert. `v0.1.0-alpha.1` ist als **CONDITIONAL GO** für isolierte, manuelle, offline-/feature-gated Entwicklung vertretbar; produktives Routing bleibt bis zur Klärung der BLOCKED-/WARN-Punkte gesperrt. Phase 2 wurde nicht begonnen. Nach diesem Bericht wird auf ausdrückliche Freigabe gewartet.
