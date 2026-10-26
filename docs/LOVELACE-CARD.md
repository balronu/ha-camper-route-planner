# Lovelace-Karte

## Ressource

Das Bundle liegt im installierbaren Paket unter
`custom_components/camper_route_planner/frontend/camper-route-planner-card.js`.
Die Integration liefert und lädt es über einen versionierten HA-Static-Path:

```yaml
url: /camper_route_planner/camper-route-planner-card.js?v=0.1.1-beta.4
type: module
```

Die URL wird beim Integration-Setup über einen Static Path und im Storage-Modus
als Lovelace-Resource registriert. Dadurch wird die Karte nach der HA-Registry
geladen. Bei `resource_mode: yaml` muss sie als eigene YAML-Resource gepflegt
werden; die Integration verändert diese Liste nicht.

## Konfiguration

```yaml
type: custom:camper-route-planner-card
entry_id: "<camper-route-planner-config-entry-id>"
title: Camper Route Planner
```

Die `entry_id` ist bewusst explizit. Es gibt keine automatische Auswahl einer
anderen Config Entry und keine produktive IP-/Entity-Hardcodierung.

## Bedienung

1. Fahrzeugprofil auswählen.
2. Start und Ziel als WGS84-Koordinaten eingeben.
3. Zwischenziele hinzufügen, bearbeiten, verschieben oder entfernen.
4. **Route berechnen** klicken.
5. Mock-Ergebnis, Warnungen und SVG-Geometrie prüfen.
6. Mit **Route speichern** explizit persistieren; gespeicherte Routen können
   geladen oder nach Bestätigung gelöscht werden.

Freitext-Orte und Reverse-Geocoding werden über den konfigurierten Geoapify-
Provider und die Backend-WebSocket-Grenze angeboten. Ohne API-Key bleiben
Koordinaten- und Karteneingabe verfügbar.
## Kartenanbieter

Die Karte fragt die Kartenkonfiguration über den HA-WebSocket-Befehl
`camper_route_planner/map_config` ab. Ein CARTO-Key gehört ausschließlich in
den Options Flow der Integration und nicht in Lovelace-YAML. Ohne einen
browsergeeigneten CARTO-Basemap-Key wird die lokale SVG-Geometrie verwendet;
Details stehen in [MAP-PROVIDER-STRATEGY.md](MAP-PROVIDER-STRATEGY.md).

## Navigation und GPX-Export

Nach einer expliziten Berechnung oder beim Laden einer gespeicherten Route
stehen **GPX-Route**, **GPX-Track** und – bei vorhandener Geometrie –
**GPX kombiniert** zur Verfügung. Der Export wird über den HA-WebSocket-Befehl
`camper_route_planner/export_gpx` erzeugt und erst durch den Button ausgelöst.
Die Karte berechnet beim Rendern, bei GPS-Änderungen oder beim Kartenwechsel
keine Route und erzeugt keinen Export automatisch. Der Button **Im Navi öffnen**
verwendet den direkten HTTPS-Anchor-Mechanismus aus Mobile Fuel Stations:
Apple Maps Directions auf iOS, Google Maps Directions auf Android und
OpenStreetMap Directions als Desktop-Fallback. Auf iOS/Android wird nur das
gültige Ziel übergeben; Zwischenziele werden dort nicht behauptet. Externe
Navigations-Apps können die Route neu berechnen und Fahrzeugmaße, Gewicht oder
Achszahl ignorieren. GPX bleibt der Übergabeweg für komplexe Wohnmobilrouten;
ein direkter Sygic-Link ist nicht Bestandteil der Integration.
