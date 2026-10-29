# Nakordoni API Audit

Stand: 16.10.2026. Quellen: [Truck Route API](https://nakordoni.eu/en/developers/truck-route), [Referenz](https://nakordoni.eu/de/developers/docs/truck-route), [API-Dokumentation](https://nakordoni.eu/en/developers/docs), [Changelog](https://nakordoni.eu/en/developers/changelog), [Developer API Terms](https://nakordoni.eu/en/p/developer_api_terms).

> **Historischer Planungsstand:** Dieser Audit hält die damalige API- und
> Freigabesituation fest. Für das aktuelle Verhalten von Stable `v0.1.5` sind
> die [Stable-Notes](releases/v0.1.5.md), die
> [HACS-Anleitung](HACS-INSTALLATION.md) und der aktuelle Quellcode maßgeblich.
> Die historischen Aussagen „docs-only“ und „noch nicht implementiert“ sind
> nicht als aktuelle Produktbeschreibung zu lesen.

## Dokumentierte Fakten

| Bereich | Ergebnis |
|---|---|
| Auth | Bearer-Key im `Authorization`-Header; OAuth PKCE ist für genehmigte Integrationsclients beschrieben. |
| Methode/Endpoint | `GET /api/v2/data/truck-route`; Kontingentklasse `route`. |
| Einheiten | Höhe/Breite/Länge in m; Gewicht/Achslast in t; Koordinaten `lat,lon`. |
| Punkte | `via` bis 5 Punkte, `alternatives` 0–2. |
| Geometrie | `polyline5`, `polyline6`, `geojson`; Standard laut Referenz `polyline5`. |
| Zeit/Verkehr | `depart_at`, `arrive_at`, `traffic=forecast|live|off`; Abfahrt bis 14 Tage voraus. |
| Einschränkungen | Gewichts-/Maßparameter, ADR-Tunnel, Maut/Fähren/Autobahn/Grenzen/Tunnel/unbefestigt/Umweltzonen, Emissionsklasse. |
| Antwort | Strecke, Restriktionen, Lkw-Fahrverbote, Warnungen, Baustellen/Sperrungen, Alternativen, Grenzwartezeiten, Tankstellen, Truck-Parkplätze, Wiegestationen, Verkehr. |
| Ruheplan | `include=rest`: EU-561/2006-Lkw-Pausen und -Ruhezeiten; laut Anbieter ausdrücklich Planungshilfe, kein Tachograph und keine Rechtsberatung. |
| Auth-/Fehler | JSON-Umschlag mit `ok`; dokumentierte Fehler u. a. 400, 401, 403, 404, 429, 500, 503, 504; Quota-Header und `usage`. |
| Quota | Explorer: 10 Truck-Route-Aufrufe/Tag, 2 QPS; tägliche Zähler UTC. Die Referenzseite nennt zusätzlich 50 kostenlose Sandbox-Aufrufe/Tag – Geltungsbereich muss vor Nutzung geklärt werden. |
| Preise | Explorer kostenlos; auf Entwicklerseite zusätzlich Student €20, Starter €29, Pro €99, Pro MAX €299/Monat. Truck-Route-Planlimits sind nicht in jedem Planabschnitt separat ausgewiesen. Keine kostenpflichtige Nutzung in Phase 1. |

## Support-Ticket #230 – Planungsnachtrag vom 16.10.2026

Die folgenden Angaben stammen aus dem Nakordoni-Support und haben für die
weitere Planung Vorrang vor älteren, allgemeinen oder widersprüchlichen
Webseitenangaben:

- `GET /api/v2/data/truck-route` ist mit dem vorhandenen API-Schlüssel laut
  Support zugänglich. Das Projekt hat dies nicht durch einen Request geprüft.
- Das Truck-Routing besitzt ein separates Tageskontingent: Explorer 10,
  Starter 300 Routen/Tag; Zusatzkontingente sind möglich.
- `vehicle_type=motorhome` ist noch nicht verfügbar. Eine erste Beta wurde
  unverbindlich für ungefähr den 26.10.2026 prognostiziert.
- Das geplante Motorhome-Profil soll Abmessungen, Gewichtsbegrenzungen,
  Wohnmobilverbote und Mautregeln berücksichtigen; Lkw-Lenk- und Ruhezeiten
  sollen nicht gelten.
- Bis zur tatsächlichen Freigabe ist Truck-Routing keine sichere
  Wohnmobilnavigation.
- Nakordoni möchte nach Erhalt der öffentlichen Repository-URL einen eigenen
  OAuth-Client für Camper Route Planner registrieren. Der OAuth-Client von
  Mobile Fuel Stations wird nicht übernommen.
- Jeder Benutzer verwendet seinen eigenen Nakordoni-Zugang und sein eigenes
  Routing-Kontingent.

Diese Support-Angaben sind eine Planungsgrundlage, aber kein Live-
Connectivity-, Quota- oder Motorhome-Schema-Nachweis. Die Umsetzung bleibt
gemäß [Phase-2F-2I-Plan](PHASE2F-2I-PLAN.md) feature-gated und
dokumentations-only.

## Beispiel-/Schemaabweichungen

Die Dokumentation zeigt an einer Stelle `data.route.distance_m/duration_s`, an anderer Stelle ein verkürztes Beispiel mit `route.distance_km/driving_time_min`, sowie unterschiedliche Felder für `fuel`/`fuel_stations` und `parking`/`parkings`. Das Projekt übernimmt deshalb ausschließlich das dokumentierte Referenzschema als Adaptervertrag und behandelt fehlende/alternative Felder als explizite Normalisierungsfälle, nicht als stillschweigende Annahme.

## Nutzungsrechte und Caching

Die API Terms erlauben Live-Daten-Caching bis 24 Stunden ab `updated_at`, Verzeichnisdaten bis 30 Tage, jeweils mit Zeitstempel/Qualitätsflag. Bei Accountende oder Key-Widerruf sind gecachte Daten innerhalb von 30 Tagen zu löschen. Free Explorer benötigt sichtbare, klickbare Attribution. Nicht verwenden als sicherheitskritisches/Vehicle-Control-System oder alleinige Rechts-/Zollentscheidung.

## Nachtrag: API-Key-Audit für Camper Route Planner

Stand dieses Nachtrags: 16.10.2026. Dieser Abschnitt ergänzt den ursprünglichen
Audit und beantwortet ausdrücklich die Wiederverwendung des für Mobile Fuel
Stations konfigurierten Nakordoni-Zugangs. Es wurden keine Secrets gelesen,
ausgegeben oder protokolliert, keine Produktivkonfiguration verändert und kein
Truck-Route-Aufruf ausgeführt.

### 1. Authentifizierung beider Endpunkte

| Endpunkt | Dokumentierter Aufruf | Authentifizierung | Befund |
|---|---|---|---|
| Mobile Fuel Stations | `GET https://nakordoni.eu/api/v2/data/fuel-stations` | `Authorization: Bearer <Developer-API-Key>`; alternativ dokumentiert als `?key=` | Der Provider im separaten Mobile-Fuel-Stations-Repository verwendet genau diesen Bearer-Header. |
| Camper Route Planner | `GET https://nakordoni.eu/api/v2/data/truck-route` | `Authorization: Bearer <Developer-API-Key>` | Die offizielle Truck-Route-Referenz zeigt denselben Bearer-Mechanismus. |

Die Nakordoni-Dokumentation beschreibt einen Developer-Key kontoübergreifend
für die dokumentierten API-Produkte; sie beschreibt keinen besonderen,
produktgebundenen Schlüsseltyp für `fuel-stations` gegenüber `truck-route`.
Daraus folgt: **Wiederverwendung desselben Keys ist technisch plausibel und
vom Authentifizierungsmodell vorgesehen.** Das bedeutet jedoch nicht, dass
jeder Key für jedes Produkt, jeden Markt oder jeden Plan freigeschaltet ist.

Quelle: [API-Dokumentation – Authentication und Endpunkte](https://nakordoni.eu/en/developers/docs),
[Fuel Stations API](https://nakordoni.eu/en/developers/docs/fuel-stations),
[Truck Route API](https://nakordoni.eu/en/developers/docs/truck-route).

### 2. Ist der vorhandene Mobile-Fuel-Stations-Key für Truck Route freigeschaltet?

**Ergebnis: BLOCKED / nicht nachgewiesen.**

Read-only-Quellprüfung:

- Mobile Fuel Stations besitzt eine eigene Nakordoni-Credential-Konfiguration
  und sendet sie als Bearer-Key an `fuel-stations`.
- Im lokalen Workspace liegt kein sicherer, verifizierbarer Nachweis vor, dass
  der konkrete Key im Nakordoni-Portal für `truck-route` aktiviert ist.
- Ein gespeicherter Key oder ein erfolgreicher Fuel-Station-Zugang beweist nur
  die Existenz bzw. mögliche Nutzung des Developer-Zugangs; er beweist nicht
  die Truck-Route-Produktfreigabe, genehmigte Märkte oder das aktuelle
  Kontingent.
- Die Dokumentation nennt für Fehler unter anderem `product_unavailable`,
  `not_approved`, `market_not_allowed`, `invalid_api_key` und
  `quota_exceeded`. Diese Fehler würden bei einem authentifizierten Test die
  Ursache unterscheiden, aber ein solcher Truck-Route-Request wäre eine
  externe und potenziell kontingentverbrauchende Aktion.

Eine Freischaltung darf daher erst als **VERIFIED** markiert werden, wenn der
Accountinhaber im Nakordoni-Developer-Portal die Truck-Route-Funktion und die
Märkte prüft oder einen ausdrücklich freigegebenen, synthetischen Probeaufruf
durchführt. Ein späterer Probeaufruf muss ausschließlich synthetische Orte,
keine Nutzer-GPS-Daten, keine echten Navigationsziele und keine automatischen
Wiederholungen verwenden; die Response darf nur als redigierter Statuscode,
Fehlerklasse und Quota-Metadaten dokumentiert werden.

### 3. Gemeinsame oder getrennte Nutzungslimits

Die offiziellen Quellen sprechen ausdrücklich für **getrennte Kontingentklassen**:

| Nutzung | Dokumentierter Stand |
|---|---|
| Standard-Daten-APIs, zu denen die zentrale Produktübersicht auch Fuel Stations zählt | Explorer: 1.000 Aufrufe/Tag |
| Forecast-/Statistics-APIs | Explorer: 200 Aufrufe/Tag |
| Truck Route | Eigene `route`-Klasse; Explorer: 10 Aufrufe/Tag, höhere Paid-Plan-Limits und ein Extra-Call-Add-on werden genannt |
| QPS | Explorer: 2; laut Dokumentation gelten höhere Paid-Plan-Limits planabhängig |

Die Fuel-Stations-Einzelseite bezeichnet ihren Endpunkt zusätzlich als
Quota-Klasse `cheap`, während die zentrale Produktübersicht ihn als
`Standard` aufführt. Das ist eine **Dokumentationsabweichung**. Sie ändert
nicht den belastbaren Befund, dass Truck Route eine eigene `route`-Klasse hat;
die exakte Fuel-Station-Grenze des konkreten Accounts muss im Developer-Portal
über `usage`/Billing geprüft werden.

Die Antworten liefern laut zentraler Dokumentation `usage` sowie die Header
`X-Devapi-Limit` und `X-Devapi-Remaining`. Diese Metadaten gehören zur
Kontrolle, dürfen aber nicht mit einem gemeinsamen globalen Zähler gleichgesetzt
werden. Tägliche Zähler resetten laut Dokumentation um Mitternacht UTC.

Quellen: [API-Dokumentation – Quotas](https://nakordoni.eu/en/developers/docs),
[API-Changelog – Truck Route und separate allowance](https://nakordoni.eu/en/developers/changelog),
[Fuel Stations API – dokumentierte quota class](https://nakordoni.eu/en/developers/docs/fuel-stations).

### 4. Gilt das kostenlose Routing-Kontingent unabhängig vom Tankstellen-Kontingent?

**Ja, nach dem dokumentierten Kontingentmodell.** Das kostenlose Explorer-
Truck-Route-Kontingent ist als separate `route`-Allowance ausgewiesen und wird
nicht aus dem Standard-/Fuel-Kontingent abgezogen. Umgekehrt verbrauchen
Fuel-Station-Anfragen nicht automatisch Truck-Route-Aufrufe.

Zwei Einschränkungen bleiben ausdrücklich bestehen:

1. Die konkrete Zahl für Fuel Stations ist wegen der `Standard`/`cheap`-
   Abweichung und planabhängiger Limits nicht aus den öffentlichen Seiten für
   diesen Account abzuleiten.
2. Die Truck-Route-Referenzseite nennt zusätzlich 50 kostenlose Sandbox-
   Testaufrufe pro Tag, während die zentrale Quota-Tabelle und der Changelog
   10 Truck-Route-Aufrufe pro Tag für Explorer nennen. Das ist als
   **ungeklärter Sandbox-/Explorer-Scope-Konflikt** zu behandeln, nicht als
   Freigabe für Tests.

### 5. Eigenständige API-Key-Konfiguration für Camper Route Planner

Camper Route Planner erhält eine eigene Credential-Grenze, auch wenn zunächst
derselbe Nakordoni-Key eingetragen wird:

- eigener Home-Assistant-Config-Entry bzw. eigener Secret-/Token-Slot im
  Camper-Route-Domain-Kontext;
- kein Lesen von `mobile_fuel_stations`-Config-Entries, HA-Storage oder
  Partnerdatenbanken;
- keine direkte Laufzeitabhängigkeit von Mobile Fuel Stations;
- optionaler manueller „Existing Nakordoni Developer-Key verwenden“-Eintrag,
  der den Wert kopiert/übernimmt, ohne die andere Integration als Provider zu
  importieren;
- unabhängiger Auth-Status (`not_configured`, `stored`, `verified`, `denied`,
  `quota_exhausted`) ohne Annahme, dass „stored“ gleich „verified“ ist;
- eigener Provider-Client, eigener Route-Cache, eigener Quota-Guard und eigene
  Fehler-/Statusmetadaten;
- API-Key niemals in Logs, Diagnostics, GPX, Exporten, Tests oder
  Fehlermeldungen; nur maskierter Status wie `configured=true`;
- manuelle Route-Berechnung als einzige Stelle, an der der Route-Provider
  kontingentverbrauchend aufgerufen werden darf;
- GPS-Änderung, HA-Start, Reload, Optionsdialog und Kartenöffnung bleiben
  strikt ohne Truck-Route-Aufruf.

Empfohlene Zustandslogik:

```text
stored -> portal/explicit probe -> verified
stored -> auth/permission/quota response -> denied or quota_exhausted
stored -> no probe -> unverified
```

Der Adapter darf denselben Bearer-Key verwenden, muss aber die Antwortfelder
und Quota-Header selbst auswerten. Eine spätere Änderung oder Löschung des
Keys in Mobile Fuel Stations darf Camper Route Planner weder automatisch
aktivieren noch deaktivieren; die beiden Einträge bleiben lebenszyklisch
unabhängig.

### Nachtragsergebnis

**CONDITIONAL GO für Wiederverwendung, NO-GO für ungeprüfte Aktivitätsannahme.**
Der vorhandene Key kann voraussichtlich wiederverwendet werden, sofern das
Nakordoni-Konto Truck Route und die benötigten Märkte freigibt. Die konkrete
Freischaltung wurde in dieser Phase nicht verifiziert, weil dafür ein
authentifizierter externer Probeaufruf oder Portalzugriff erforderlich wäre
und kein Live-Routing freigegeben ist. Die Architektur muss deshalb einen
eigenständigen Camper-Konfigurations- und Verifikationsstatus vorsehen.

## Nachtrag: Support-Ticket #230 und Planungsstand

Stand: 16.10.2026. Die folgenden Punkte stammen aus den offiziellen
Supportinformationen zu Ticket #230 und ersetzen ältere, vorsichtigere
Annahmen, soweit sie ihnen widersprechen. Es wurde für diesen Nachtrag kein
Live-Request ausgeführt und kein Secret gelesen.

### Bestätigte bzw. ausdrücklich angekündigte Punkte

| Thema | Aktueller Stand | Verbindlichkeit für dieses Projekt |
|---|---|---|
| Truck-Route-Zugriff | `GET /api/v2/data/truck-route` ist mit dem vorhandenen API-Schlüssel laut Support bereits zugänglich. | Support-Bestätigung; kein lokaler Laufzeitnachweis, bis ein separat freigegebener Probeaufruf erfolgt. |
| Routing-Kontingent | Explorer: 10, Starter: 300 Routen pro Tag; Zusatzkontingente sind möglich. | Planungswert; Reset, Zählerdefinition, Overuse und Add-on-Vertrag offen. |
| Motorhome-API | `vehicle_type=motorhome` ist in Entwicklung und noch nicht verfügbar. | **Nicht implementieren/aktivieren.** |
| Motorhome-Beta | Unverbindliche Prognose ungefähr 26.10.2026. | Kein Release- oder Aktivierungsdatum. |
| Motorhome-Semantik | Geplant sind Abmessungen, Gewichtsbeschränkungen, wohnmobilspezifische Verbote und Mautregeln; Lkw-Lenk-/Ruhezeiten sollen nicht gelten. | Zielbild, noch kein verbindlicher API-Vertrag. |
| OAuth | Nakordoni möchte nach Übermittlung der öffentlichen Repository-URL einen eigenen OAuth-Client für das Projekt registrieren. | Separater Projektclient; Mobile-Fuel-Stations-Client wird nicht übernommen. |
| Benutzer/Kontingent | Jeder Benutzer verwendet seinen eigenen Nakordoni-Zugang und sein individuelles Routing-Kontingent. | Architekturvorgabe; kein gemeinsames Projektkonto. |

### Konsequenzen

1. Die bisherige Aussage „Truck-Route-Freischaltung nicht nachgewiesen“ wird
   für den konkreten Zugang durch Ticket #230 zu **Support-bestätigt, lokal
   nicht ausgeführt** präzisiert. Die Sicherheitsgrenze gegen Live-Aufrufe bleibt
   unverändert.
2. Truck-Route und Fuel Stations bleiben getrennte Produkt-/Credential-
   Kontexte. Ein technisch gleicher Bearer-Mechanismus oder ein möglicher
   gemeinsamer Account bedeutet keine gemeinsame Integration, kein gemeinsames
   Storage und kein gemeinsames Benutzerkontingent.
3. Die dokumentierten 10/300 Werte werden für die Planung verwendet. Die
   früheren öffentlichen Abweichungen (z. B. Sandbox-Angabe) bleiben als
   Rückfrage bestehen und dürfen nicht zu einem höheren zulässigen Limit
   führen.
4. Die geplante Motorhome-Beta darf nicht vorweggenommen werden. Bis zur
   tatsächlichen Veröffentlichung bleibt Truck-Routing eine getrennte HGV-
   Funktion und darf nicht als sichere Wohnmobilnavigation dargestellt werden.

## Offene Fragen / BLOCKED

1. Verbindliche Truck-Route-Quota pro Plan, Reset-Zeitzone, Overuse-Verhalten,
   Zusatzkontingente und die genaue Bedeutung von „Route pro Tag“.
2. Schriftliche Bestätigung, ob ein privat genutztes Wohnmobilprofil über HGV-Parameter zulässig und fachlich repräsentativ ist.
3. Marktabdeckung/Marktfreigaben für alle Länder einer Route.
4. Vollständiges, versioniertes Response-Schema und Stabilitätsgarantie der v2-Felder.
5. Exakte Lizenz für langfristige Speicherung normalisierter Route-Geometrien und Kartenvisualisierung.
6. Schriftliche Bestätigung, welche Märkte und Nutzerkonten von der Ticket-
   Aussage zur Zugänglichkeit umfasst sind; ein lokaler Probeaufruf bleibt
   separat freigabepflichtig.
7. Verbindliche Zuordnung des Fuel-Stations-Endpunkts zur `standard`- oder
   `cheap`-Quota-Klasse für den konkreten Plan.
8. Auflösung des Widerspruchs zwischen 10 Explorer-Truck-Routen/Tag in der
   zentralen Quota-Tabelle und 50 Sandbox-Testaufrufen/Tag auf der Truck-
   Route-Referenzseite.
9. OAuth2-Grant/PKCE, Scopes, Redirect-URI, Tokenlaufzeit, Refresh und
   Revocation für den projektspezifischen OAuth-Client.
10. Vollständiger Motorhome-Request-/Response-Vertrag und verbindlicher
    Rollouttermin nach der angekündigten Beta.
