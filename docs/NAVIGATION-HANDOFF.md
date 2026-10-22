# Navigationsübergabe / Navigation handoff

## Deutsch

Nach einer berechneten Route bietet die Lovelace-Karte **🧭 Im Navi öffnen**
an. Die Schaltfläche wird nur bei einer gültigen Route mit Ziel aktiviert. Die
Übergabe verwendet ausschließlich die bereits vorliegenden Koordinaten und
löst keine neue Nakordoni- oder Home-Assistant-Anfrage aus.

- iOS/iPadOS: `maps://` mit Ziel und, wenn vorhanden, Startpunkt
- Android: `geo:` mit Ziel; das Betriebssystem kann eine kompatible Karten-App
  auswählen
- Desktop: OpenStreetMap-Directions als Browser-Fallback

iOS- und Android-Links können Zwischenziele nicht zuverlässig standardisiert
übergeben. Die Oberfläche weist deshalb ausdrücklich darauf hin; für eine
vollständige Folge von Zwischenzielen bleibt der vorhandene GPX-Export die
geeignete Übergabe, unter anderem für Sygic und spezialisierte
Wohnmobil-Navigation.

Die externe App kann die Route neu berechnen. **Fahrzeugabmessungen und
Gewicht bitte im Navi prüfen.** Die von Nakordoni ermittelten Straßen und
Fahrzeugbeschränkungen werden nicht automatisch übernommen.

## English

After a route has been calculated, the Lovelace card offers **🧭 Open in
navigation**. It is enabled only for a valid route with a destination. The
handoff uses the coordinates already present in the route and does not make a
new Nakordoni or Home Assistant request.

- iOS/iPadOS: `maps://` with destination and, when available, origin
- Android: `geo:` with destination, allowing the operating system to choose a
  compatible maps app
- Desktop: OpenStreetMap Directions as a browser fallback

iOS and Android links cannot reliably standardize intermediate waypoints. The
card therefore states when waypoints are omitted; the existing GPX export
remains the complete handoff for Sygic, specialist motorhome navigation, and
other GPX-compatible devices.

The external app may recalculate the route. **Check vehicle dimensions and
weight in the navigation app.** Nakordoni roads and vehicle restrictions are
not transferred automatically.
