# Machbarkeitsprüfung Phase 6C–6E

Stand: 27.10.2026, Ausgangspunkt `v0.1.1-beta.10`. Diese Prüfung ist **read-only**. Es wurden keine produktiven Schlüssel gelesen, keine Nakordoni-API-Anfragen ausgeführt und keine Phase-6C–6E-Funktion implementiert.

## Bewertungsmaßstab

- **GO** – mit dem dokumentierten Vertrag und belastbaren Daten umsetzbar.
- **CONDITIONAL** – nur mit klaren Eingaben, Datenqualitätskennzeichnung oder einer zusätzlichen, ausdrücklich freigegebenen Anfrage sinnvoll.
- **NO-GO** – für private Wohnmobile oder den aktuellen Vertrag nicht sicher genug.
- **UNKNOWN** – die öffentliche Dokumentation reicht für eine belastbare Entscheidung nicht aus.

Die offizielle `truck-route`-Dokumentation beschreibt für `vehicle_type=motorhome` strenge Höhen-, Breiten-, Längen-, Gewichts- und Achslastprüfung, Umweltzonen, Wohnmobil-Tempolimits und länderspezifische Maut. Güterverkehrsverbote werden für Wohnmobile ausdrücklich anders behandelt. [Truck Route API](https://nakordoni.eu/de/developers/docs/truck-route)

## Bestandsbefund im Repository

Der bestehende Motorhome-Adapter verwendet ausschließlich den manuellen `GET /api/v2/data/truck-route`-Vertrag und übergibt bereits `vehicle_type`, Abmessungen, Gewicht, Achsen, `traffic`, `alternatives`, Geometrie und optionale Zwischenziele. Die Normalisierung übernimmt vorhandene Route-, Länder-, Grenz-, Maut-, Warn- und `restriction_hits`-Felder. Es gibt keinen separaten Produktivpfad für 6C–6E, keine automatische Wiederholung und keinen Hintergrund-Request.

Die gespeicherte Antwort ist damit die einzige kostenfreie Quelle für bereits berechnete Werte. Fehlende Felder bleiben fehlend; insbesondere werden keine Etappen, Tankstopps, Preise oder Fahrzeugtauglichkeiten aus Gesamtwerten abgeleitet.

## Entscheidungsmatrix

| Funktion | Technisch möglich | Wohnmobilgeeignet | Zusätzliche Requests | Einschränkungen | Empfehlung |
|---|---|---|---|---|---|
| Live-Verkehr | Ja, `traffic=live` | Conditional | Neue Route | Route-Kontingent; Zeitpunkt kennzeichnen | CONDITIONAL |
| Verkehrsprognose | Ja, `traffic=forecast` | Conditional | Neue Route | Abfahrts-/Durchfahrtszeit und Aktualität anzeigen | CONDITIONAL |
| Baustellen/Sperrungen | Ja, Warn-/Restriction-Felder | Conditional | Nein bei gespeicherter Antwort | Vollständigkeit nicht garantieren | CONDITIONAL |
| Zeitabhängige Einschränkungen | Ja, soweit Antwort sie liefert | Conditional | Nein bei gespeicherter Antwort | `applies` und Gültigkeitszeit prüfen | CONDITIONAL |
| Höhe/Breite/Gewicht/Länge | Ja, Routing berücksichtigt sie | Ja, bei vollständigem Profil | Nein zusätzlich | Falsche Profilwerte erzeugen falsche Route | GO |
| Umweltzonen | Ja | Conditional | Nein bei gespeicherter Antwort | Nur gemeldete/vermiedene Zonen anzeigen | CONDITIONAL |
| Warnungen problematischer Abschnitte | Ja, falls geliefert | Conditional | Nein | Warncode, Text und Datenstand kennzeichnen | CONDITIONAL |
| Kartendarstellung Einschränkungen | Technisch ja | Conditional | Nein | Nur Antwort-Geometrie/Koordinaten verwenden | CONDITIONAL |
| Lkw- vs. Wohnmobilregeln | Ja, `vehicle_type=motorhome` | Conditional | Nein | Regeln nicht vermischen | GO |
| Alternative Routen | Ja, `alternatives=0..2` | Conditional | Neue Route | Laut Doku nur ohne `via`; zeitabhängige Verbote nicht vollständig geprüft | CONDITIONAL |
| Maut vermeiden | Ja, `avoid=tolls` | Conditional | Neue Route | Mautabdeckung kann unvollständig sein | CONDITIONAL |
| Autobahnen vermeiden | Ja, `avoid=motorways` | Conditional | Neue Route | Länge/Befahrbarkeit/Maut vergleichen | CONDITIONAL |
| Fähren vermeiden | Ja, `avoid=ferries` | Conditional | Neue Route | Lokale Ausnahmen möglich | CONDITIONAL |
| Tunnel vermeiden | Ja, `avoid=tunnels` | Conditional | Neue Route | ADR und normale Tunnel unterscheiden | CONDITIONAL |
| ECO-Routing | Ja, `route_type=eco` | Conditional | Neue Route | ECO-Ziel und Vergleichswerte erklären | CONDITIONAL |
| Geplante Abfahrt | Ja, `depart_at` | Conditional | Neue Route | Zeitdaten veralten | CONDITIONAL |
| Geplante Ankunft | Ja, `arrive_at` | Conditional | Neue Route | Rückwärtsplanung und Timestamp nötig | CONDITIONAL |
| Verkehrseinfluss Fahrzeit | Ja | Conditional | Neue Route je Modus | Freiflussdauer und Verkehrsmodell trennen | CONDITIONAL |
| Distanz-/Dauer-/Mautvergleich | Ja, mehrere Antworten | Conditional | Je Vergleich eine Route | Kontingent und gleiche Eingaben sichern | CONDITIONAL |
| Zwischenziele bei Alternativen | Nein im Vertrag | Nein | — | Alternativen nur ohne `via` dokumentiert | NO-GO |
| Sicherheitsprüfung Alternativen | Teilweise | Nein als Zusicherung | Neue Route | Keine vollständige Prüfung zeitabhängiger Verbote | NO-GO |
| Tankstellen entlang Route | Ja, `include=fuel`/Korridor | Conditional | Neue Route | Zugang, Öffnung und Preisaktualität prüfen | CONDITIONAL |
| Kraftstoffpreise | Ja, sofern geliefert | Conditional | Route bzw. Fuel-Endpoint | Zeitstempel und Währung anzeigen | CONDITIONAL |
| Parkplätze/Rastmöglichkeiten | Ja, `include=parking` | Conditional | Neue Route | Lkw-Parkplatz ist nicht automatisch Wohnmobil-geeignet | CONDITIONAL |
| Parkplatz-Ausstattung | Ja, sofern geliefert | Conditional | Neue Route | Ausstattung kann veraltet sein | CONDITIONAL |
| Pausenplanung private Wohnmobile | Nein über EU-561-Lkw-Regeln | Nein | — | Motorhome bietet keinen Ruhezeitenplan | NO-GO |
| Tankplanung | Lokal möglich | Conditional | Nein mit Nutzerdaten | Tankinhalt/Füllstand/Reserve erforderlich | GO |
| Entfernung Versorgungsstelle zur Route | Ja, Korridor-/Detour-Felder | Conditional | Neue Route | Korridor und Umweg anzeigen | CONDITIONAL |
| Fahrzeuggeeignetheit Stopps | Teilweise | Nein als Zusicherung | Neue Route | Höhe/Gewicht/Zufahrt evtl. unbekannt | NO-GO |
| Mobile Fuel Stations | Separater Adapter möglich | Conditional | Eigene Fuel-Abfragen | Eigene Credentials, Quota und Cache | CONDITIONAL |
| Camper Travel Journal | Lokal vorbereitbar | Conditional | Nein | Kein aktueller Übergabevertrag | UNKNOWN |

## Phase 6C – Verkehr und Beschränkungen

`truck-route` dokumentiert `traffic=forecast|live|off`. Forecast kombiniert wiederkehrende Muster, Live-Verkehr am Abfahrtsort sowie Baustellen, Sperrungen und Wetter zum Durchfahrtszeitpunkt; `live` ist kein Zukunftsmodell. Die Antwort kann Route-Dauer, Länderfolge, `legal`, `avoid`, `restriction_hits`/Warnungen sowie vermiedene Umweltzonen oder Tunnelereignisse liefern. Das ist für Anzeige und Prüfhinweise brauchbar, aber kein rechtlicher Befahrbarkeitsnachweis.

Für Motorhomes werden Höhen-, Breiten-, Längen-, Gewichts- und Achslastgrenzen streng angewandt. Güterverkehrs- sowie Lenk-/Ruhezeitlogik darf nicht übernommen werden: Die Doku sagt ausdrücklich, dass Güterverkehrsverbote für Motorhomes anders gelten, `include=rest` und `include=weigh` nicht angeboten werden und Umweltzonen dennoch gelten.

**Empfehlung 6C:** Zuerst read-only Anzeige bereits gespeicherter Restriction-/Warning-Felder mit Datenstand und `applies`-Semantik. Danach kann manuelle Neuberechnung mit sichtbarer Verbrauchswarnung folgen. Keine Hintergrundaktualisierung und keine automatische „befahrbar“-Aussage.

## Phase 6D – Erweiterte Routenplanung

Die Parameter `alternatives`, `avoid`, `depart_at`, `arrive_at` und `route_type=eco` sind dokumentiert. Jede Variante ist eine neue `route`-Anfrage. Alternativen sind auf Routen ohne `via` begrenzt; damit ist ein Vergleich für die Portugal-Route mit Zwischenzielen nicht abgesichert. Zusätzlich müssen Alternativen wegen der unvollständigen Prüfung zeitabhängiger Fahrverbote als unsicher gekennzeichnet werden.

**Empfehlung 6D:** Zuerst manueller Einzelvergleich ohne Zwischenziele, mit identischem Fahrzeugprofil, Timestamp, Kontingentwarnung und Sicherheitsstatus. ECO, zeitabhängige Planung und Alternativen mit `via` bleiben zurückgestellt.

## Phase 6E – Reise- und Versorgungsplanung

`truck-route` kann mit `include=fuel,parking` und `corridor_km` Tankstellen, Preise, Parkplätze und Ausstattung entlang eines Korridors liefern. Das ist für private Wohnmobile nur eine Vorschlagsquelle. Fahrzeuggeeignetheit, Reservierbarkeit, Öffnung, Verfügbarkeit, Tankgröße und Reserve sind nicht automatisch bestätigt.

Der separate `route-plan`-Endpoint ist für eine Zeitachse mit Grenzen und Stopps dokumentiert, hat die Kontingentklasse `heavy` und nimmt `vehicle=car|bus|truck`. Er darf daher nicht als private-Motorhome-Pausenplan oder EU-561-Regelwerk verwendet werden. Die dokumentierten `stop_places`, `stops[].places[]` und Tank-/Parkplatzkandidaten sind eine spätere Untersuchungsoption, kein aktueller Motorhome-Vertrag.

**Empfehlung 6E:** Zuerst lokale Tankplanung aus Verbrauch, Tankinhalt, Füllstand und Reserve. Danach optional ein manuell angeforderter Tankstellen-/Parkplatzkorridor mit Kennzeichnung „Vorschlag, nicht bestätigt“. Mobile Fuel Stations bleibt unabhängig. Camper Travel Journal bleibt ein späterer Übergabepunkt.

## API-, Kontingent- und Lizenzrisiken

| Funktion | Endpoint/Parameter | Antwortfelder | Request/Quota | Risiko |
|---|---|---|---|---|
| Bestehende Route | `GET /api/v2/data/truck-route`; Profil, `traffic`, `alternatives`, `avoid`, `include`, Zeit, `route_type` | `route`, `country_split`, `tolls`, Grenzen, Warnungen/Restrictions, optional fuel/parking | `route`; zentrale Doku: Explorer 10/Tag, QPS 2; Truck-Route-Seite nennt zusätzlich 50 Sandbox-Aufrufe | Motorhome Beta; Felder können fehlen |
| Vignetten | `GET /api/v2/data/vignettes?country=&lang=` | `required`, `info`, `prices`, `note`, `more_info_url` | Zusätzlicher `cheap`-Request | Zeitabhängige Preise; keine automatische Abfrage je Land |
| Reiseplan | `GET /api/v2/data/route-plan`; `vehicle`, `depart`, `forecast`, `stop_places` | `borders`, `stops`, `places`, `summary`, `model` | `heavy` | `car|bus|truck`, kein Motorhome-Modell |
| Account-Nutzung | `GET /api/v2/account/usage` | Usage-/Reset-/Quota-Daten | Eigener Request | Nur explizit und gedrosselt; Account-Freigabe offen |

Die zentrale Doku nennt außerdem 1.000 Standard-Datenaufrufe/Tag, 200 Prognose-/Statistikaufrufe/Tag und QPS 2. Die Abweichung zwischen 10 Route-Aufrufen in der Übersicht und 50 Sandbox-Tests auf der Truck-Route-Seite ist vor jeder Entwicklung zu klären, nicht als Testfreigabe zu interpretieren. Keine automatischen Wiederholungen, Polling-Schleifen oder Hintergrundberechnungen einführen.

Vor öffentlicher Anzeige müssen Attribution sowie Daten-/Weitergabebedingungen je neuem Produkt erneut geprüft werden. Diese Studie ersetzt keine Lizenzfreigabe.

## Priorisierter Entwicklungsplan

1. **Beta 6C.1:** gespeicherte Restriction-/Warning-Anzeige ohne Requests, mit Datenstand und Unsicherheitslabels.
2. **Beta 6C.2:** manuelle Verkehrsanzeige bei expliziter Neuberechnung, mit Quota- und Timestamp-Anzeige.
3. **Beta 6D.1:** Alternativen/`avoid` nur ohne `via`, manuell gestartet und ohne Sicherheitszusicherung.
4. **Beta 6E.1:** lokale Tankplanung mit Tankgröße, Füllstand und Reserve, ohne API.
5. **Beta 6E.2:** optionaler Versorgungsstellenkorridor nach Account-/Lizenz-/Quota-Prüfung.
6. **Zurückgestellt:** route-plan-Pausenlogik, automatische Fahrzeuggeeignetheit, Alternativen mit Zwischenzielen, Hintergrundverkehr, Mobile-Fuel-Stations-Kopplung und Travel-Journal-Übergabe.

## Quellen

- [Truck Route API](https://nakordoni.eu/de/developers/docs/truck-route)
- [API-Dokumentation und Kontingente](https://nakordoni.eu/de/developers/docs)
- [Vignetten- und Straßenmaut-API](https://nakordoni.eu/de/developers/docs/vignettes)
- [Routenplaner-API](https://nakordoni.eu/de/developers/docs/route-plan)
- Lokaler Bestand: `docs/NAKORDONI-API-AUDIT.md`, `docs/NAKORDONI-API-CAPABILITY-MATRIX.md`, `custom_components/camper_route_planner/providers/nakordoni_motorhome.py`.

**Entscheidung:** 6C und 6D nur schrittweise und manuell als CONDITIONAL vorbereiten; 6E zunächst lokal ohne Requests. Die Umsetzung dieser Phasen wartet auf eine ausdrückliche Freigabe nach dem Beta.11-Praxistest.
