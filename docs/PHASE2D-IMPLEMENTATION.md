# Phase 2D – Implementierung

## Ergebnis

Phase 2D ergänzt einen providerunabhängigen GPX-1.1-Export für das vorhandene
normalisierte Routenmodell. Es gibt drei explizit auswählbare Varianten:

- **Route:** Start, Zwischenziele in gespeicherter Reihenfolge und Ziel als
  `<rte>/<rtept>`.
- **Track:** nur die vorhandene Routengeometrie als `<trk>/<trkseg>/<trkpt>`.
- **Kombiniert:** Route und Track in einer GPX-Datei.

Die Implementierung in `custom_components/camper_route_planner/gpx.py` prüft
Koordinaten, begrenzt Punktzahlen, escaped XML, erzeugt deterministische
UTF-8-Ausgabe und schreibt keine Datei. Der HA-WebSocket-Befehl
`camper_route_planner/export_gpx` liefert den GPX-Inhalt erst nach einem
expliziten Kartenklick. Eine neue Routing-Anfrage wird dabei nicht ausgelöst.

Die Karte bietet denselben Export für die aktuelle und gespeicherte Routen.
Auf Geräten mit geeigneter Web Share API wird eine Datei geteilt, sonst wird
ein Browserdownload ausgelöst. Nicht dokumentierte Sygic-Deep-Links werden
nicht verwendet.

## Grenzen

Track-Export wird ohne mindestens zwei vorhandene Geometriepunkte abgelehnt.
Es werden keine Höhen, Zeitstempel, Straßenpunkte oder fehlenden Daten
erfunden. Sygic kann die Route beim Import mit eigenen Kartendaten neu
berechnen; eine unveränderte Navigation wird daher nicht zugesichert.
