# Phase 6B.6 – Fahrzeugprofil und PDF-Reiseplan

## API-Fähigkeit

Die offizielle Nakordoni-Truck-Route-Dokumentation wurde am 27.10.2026 geprüft:

- `axles` und `emission_class` sind dokumentierte Motorhome-Routingparameter.
- `vehicle_type=motorhome` bleibt der bestehende Providervertrag.
- CO₂-Klasse, Erstzulassungsdatum und Durchschnittsverbrauch sind dort nicht als Routingparameter dokumentiert und werden deshalb nicht übertragen.
- Nakordoni liefert Maut-, Länder-, Grenz- und Routendaten weiterhin in der bestehenden Antwort; der PDF-Export erzeugt keine weitere Anfrage.

Quelle: [Nakordoni Truck Route API](https://nakordoni.eu/de/developers/docs/truck-route).

## Fahrzeugprofile

Die optionalen lokalen Felder sind:

- Euro-Schadstoffklasse (`euro0`–`euro6`)
- CO₂-Klasse (`a`–`g`)
- Erstzulassung als ISO-Datum (`YYYY-MM-DD`)
- Durchschnittsverbrauch in `l/100 km`

Beim Bearbeiten bleibt die Profil-ID erhalten. Nicht ausgefüllte Felder bleiben leer. Bestehende Profile, Maße, Gewichte, Tracker und gespeicherte Routen werden nicht migriert, ersetzt oder zurückgesetzt. Die Euro-Klasse wird nicht automatisch ergänzt; Nakordoni erhält nur `emission_class`, wenn der Nutzer sie ausdrücklich speichert.

## PDF-Export

Der Button **Reiseplan als PDF** steht nur nach einer gültigen Berechnung zur Verfügung. `pdf-lib` 1.17.1 (MIT) erzeugt clientseitig ein mehrseitiges A4-Dokument. Enthalten sind Fahrzeug, Start/Ziel, Zwischenziele, Provider, Entfernung, Fahrzeit, eine einfache Routengeometrie, Grenzübergänge, Mautdaten, Warnungen und Datenqualitäts-/Annahmehinweise.

Die Karte ist eine lokale Geometrieübersicht; es werden keine Kartendienste, Nakordoni-Endpunkte oder PDF-Dienste für den Export aufgerufen. Auf iOS wird die Datei über `navigator.share` geteilt, sofern Dateifreigabe verfügbar ist, sonst als Download bereitgestellt. Reisedaten werden nicht serverseitig gespeichert.

Nicht vorhandene Verkehrs-, Baustellen-, Umweltzonen-, Rastplatz- oder Kraftstoffdaten werden nicht erfunden, sondern als nicht vom Routing geliefert behandelt.
