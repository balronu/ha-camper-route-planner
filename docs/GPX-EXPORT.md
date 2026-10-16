# GPX-Export

Der Export arbeitet ausschließlich auf dem normalisierten Routendatensatz. Er führt keine Berechnung aus und kennt weder Nakordoni-Credentials noch andere Provider-Geheimnisse.

## Varianten

### GPX-Route

`<rte>`/`<rtept>` enthält Start, vorhandene Zwischenziele in gespeicherter Reihenfolge und Ziel. Namen/Beschreibungen werden nur aus vorhandenen Waypoint-Feldern übernommen; es werden keine Höhen oder Zeitstempel erfunden.

### GPX-Track

`<trk>`/`<trkseg>` enthält ausschließlich `geometry.points`. Eine fehlende oder zu kurze Geometrie führt zu einer verständlichen Ablehnung. Es gibt keine Interpolation und keine zusätzlichen Straßenpunkte.

### Kombiniert

Die kombinierte Datei enthält beide Strukturen. Sie ist sinnvoll für externe Programme, die bevorzugt Route- oder Trackdaten lesen. Das Zielprogramm kann trotzdem eine eigene Route berechnen.

## Sicherheit und Grenzen

- UTF-8 und GPX-1.1-Namespace.
- XML-Escaping durch den Standard-XML-Serializer.
- Koordinaten werden validiert.
- Track-Export ist auf 100.000 Geometriepunkte begrenzt; Routepunkte auf 100.
- Dateinamen sind bereinigt und enthalten keine Pfade, Steuerzeichen oder Credentials.
- Kein unkontrolliertes Dateisystemschreiben: HA liefert den XML-Inhalt per WebSocket, der Browser erzeugt den Download erst nach Klick.
- iOS kann statt eines zuverlässigen Direktdownloads die Web Share API nutzen, sofern das Gerät Dateien teilen kann.

WebSocket-Kommando: `camper_route_planner/export_gpx` mit `mode: route|track|combined` und entweder einem aktuellen `route`-Objekt oder einer gespeicherten `route_id`.
