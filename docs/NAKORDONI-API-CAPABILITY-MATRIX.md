# Nakordoni API-Fähigkeitsmatrix – Phase 6B

Stand: 26.10.2026. Grundlage ist die offizielle Nakordoni-Entwicklerdokumentation; es wurden keine Live-API-Aufrufe ausgeführt.

| Funktion | Endpunkt/Feld | Bereits in der Motorhome-Routing-Antwort? | Zusätzlicher Request? | Kontingent | Motorhome |
|---|---|---:|---:|---|---|
| Durchfahrene Länder | `data.route.countries`, `country_split[]` | Ja | Nein | Route | Ja |
| Grenzübergänge | `data.route.border_crossings[]`; Fallback: geordnete `data.route.countries[]`/`country_split[]` | Ja | Nein | Route | Konkrete Daten oder klar als abgeleitete Länderfolge markiert |
| Wartezeit bei Ankunft | `border_crossings[].wait_min`, `wait_at`, `wait_sides[]` | Ja | Nein | Route | Ja; `null` bleibt fehlend |
| Richtung | `from_country`, `to_country`, `wait_sides[].role` | Ja | Nein | Route | Ja |
| Datenstand/Qualität | `wait_at`, `wait_sides[].basis`, Hinweise | Ja | Nein | Route | Ja, soweit geliefert |
| Mautsumme | `data.tolls.total_eur`, `complete`, `currency` | Ja | Nein | Route | Ja, motorhome-Regeln |
| Maut je Land | `data.tolls.by_country[]` | Ja | Nein | Route | Ja; Status/Grundlage aus Antwort |
| Brücken/Tunnel | `data.tolls.objects[]` | Ja | Nein | Route | Ja, soweit vom Anbieter bepreist |
| Vignetten | `data.tolls.by_country[].system` und `reference` | Ja, als Routing-Mautinformation | Nein | Route | Ja; keine Kaufaktion; keine Doppelzählung mit separatem Request |
| Separate Vignetten-Details | `/api/v2/data/vignettes?country=...` | Nein | Möglich, aber in 6B nicht erforderlich | cheap | Nicht als Motorhome-Tarif garantiert |
| Separate Grenzwartezeit | `/api/v4/data/border/{origin}/{destination}/{crossing_type}` | Nicht erforderlich | Nein | heavy | Ein Zielland pro Request; dokumentierte Fahrzeugtypen sind Pkw/Bus/Lkw, nicht Motorhome; DE/FR/CH sind in der dokumentierten Grenz-ID-Tabelle keine überwachten Ursprungsländer |

## Verwendeter Vertrag

Der bestehende Provider ruft bei einer manuellen Berechnung bereits `/api/v2/data/truck-route` mit `vehicle_type=motorhome` und den Fahrzeugmaßen auf. Die offizielle Dokumentation beschreibt dafür `border_crossings`, motorhome-spezifische `tolls`, `country_split` und `restriction_hits` in derselben Antwort. Phase 6B nutzt diese Felder ausschließlich nach erfolgreicher Berechnung.

Die separate Border-API liefert checkpointbezogene Richtungsdaten, ist aber keine routenbezogene Zuordnung für die konkrete Motorhome-Strecke. Sie hat außerdem die Kontingentklasse `heavy`; Beta.4 verwendet sie deshalb nicht. Die offizielle Dokumentation weist ausdrücklich darauf hin, dass Wartezeiten bereits auf der geplanten Ankunftszeit beruhen und lange Grenzwarten in der Zeitachse berücksichtigt werden können. Die Integration addiert Grenzwartezeit deshalb nicht erneut zur bestehenden Fahrzeit.

## Authentifizierung und Kontingente

Alle abgerechneten Requests benötigen `Authorization: Bearer <Schlüssel>`. Die Route-Klasse hat ein eigenes Routen-Kontingent; Standard-/Heavy-Endpunkte haben getrennte Klassen. Phase 6B erzeugt keinen zusätzlichen Request und damit keinen zusätzlichen Kontingentverbrauch.

## Bewusste Grenzen

- Fehlende `wait_min`-Werte werden als „keine aktuellen Wartezeitdaten verfügbar“ dargestellt, niemals als null Minuten.
- `data_quality=low`, `likely` oder ähnliche Anbieterkennzeichnungen werden nicht als bestätigte Daten ausgegeben.
- Die Routing-Antwort ist die Quelle für tatsächliche Übergänge; eine geografische Näherung wird nicht als Grenzübergang erfunden.
- Die getrennte Vignetten-API wird nicht automatisch für jedes Land abgefragt. Offizielle Links und Tarife aus der Routing-Antwort werden angezeigt, wenn vorhanden.
- Die getrennte Border-API wird nicht automatisch abgefragt; für DE → FR → CH fehlt die belastbare Motorhome-/Routen-Zuordnung.

Quellen:

- https://nakordoni.eu/de/developers/docs/truck-route
- https://nakordoni.eu/de/developers/docs/border
- https://nakordoni.eu/de/developers/docs/multi
- https://nakordoni.eu/de/developers/docs/vignettes
