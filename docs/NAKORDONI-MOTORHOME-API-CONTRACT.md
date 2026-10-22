# Nakordoni Motorhome API-Vertrag (Phase 2G)

## Status

Der Provider `nakordoni_motorhome` ist lokal vorbereitet, aber im Runtime-Betrieb deaktiviert. Phase 2G verwendet ausschließlich synthetische Fixtures. Es werden keine API-Schlüssel, OAuth-Tokens oder Live-Routenabfragen verwendet.

Die aktuelle offizielle Dokumentation bestätigt `https://nakordoni.eu/api/v2/data/truck-route` für Routing. OAuth und Account Usage liegen separat unter `api.nakordoni.dev`; die vollständige Zuordnung steht in [NAKORDONI-API-HOSTS.md](NAKORDONI-API-HOSTS.md).

## Request

Der Provider erzeugt für ein gültiges Wohnmobilprofil:

```text
from=<lat>,<lon>
to=<lat>,<lon>
vehicle_type=motorhome
length=<m>
width=<m>
height=<m>
weight=<t>
axles=<integer>
```

`via`, `traffic`, `alternatives` und `geometry` werden nur aus dem Benutzerauftrag übernommen. `vehicle_type=motorhome` ist immer explizit. Länge, Breite, Höhe und zulässige Gesamtmasse sind Pflichtfelder; es gibt keine stillschweigenden Ersatzwerte. Gewicht wird in Tonnen übertragen.

Nicht übertragen werden `crew`, `driven_*`, `reduced_*`, `extended_*` oder `last_weekly_rest_end`. Diese Lkw-Lenk- und Ruhezeitparameter sind für Motorhome-Anfragen unzulässig.

## Response-Normalisierung

Die Fixture-Normalisierung erwartet eine Route mit positiver Distanz, Fahrzeit und mindestens zwei Geometriepunkten. Sie bewahrt Warnungen, Länder- und Einschränkungsinformationen sowie Mautdaten in `RouteResult.metadata`.

Mautbeträge bleiben `null`, wenn die Antwort keinen Betrag liefert. `complete=false` oder `estimate=true` werden nicht in eine verbindliche Gesamtsumme umgedeutet.

## Attribution und Beta

Routendaten erhalten `https://nakordoni.eu` als vertrauenswürdige Attribution. Die Oberfläche zeigt `Nakordoni – Beta`; intern bleibt die Provider-ID `nakordoni_motorhome` erhalten. Verkehrszeichen und geltende Vorschriften haben Vorrang.
