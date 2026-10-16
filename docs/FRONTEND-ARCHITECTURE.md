# Frontend-Architektur

## Aufbau

```text
frontend/src/
  camper-route-planner-card.js  Web Component + Shadow DOM + HA lifecycle
  card-utils.js                 DOM-freie Validierung/Formatierung/State-Helfer
  localization.js               DE/EN dictionary, HA locale detection
  services.js                   hass.callWS / hass.callService boundary
  map-view.js                   SVG geometry fallback, zoom/pan
frontend/scripts/build.mjs       reproduzierbarer dependency-freier Bundle-Build
frontend/dist/                   lokales, versioniertes Bundle
```

Die Karte registriert `custom:camper-route-planner-card` idempotent und stellt
`getConfigElement()` sowie `getStubConfig()` bereit. Der Editor dispatcht ein
composed/bubbling `config-changed`-Event.

## HA-Datenfluss

- Profile und gespeicherte Routen kommen ausschließlich über authentifizierte
  HA-WebSocket-Kommandos.
- Eine Berechnung verwendet ausschließlich den authentifizierten HA-WebSocket-
  Serviceaufruf `type: "call_service"` mit
  `domain: "camper_route_planner"`, `service: "calculate_route"` und
  `return_response: true`.
- `hass`-Updates werden nicht als Berechnungs- oder Reload-Trigger verwendet.
  Nur eine neue Connection-Identität lädt Profile/Routen erneut.
- Der Browser liest niemals `.storage`, ruft keine Nakordoni-URL auf und kennt
  keine API-Credentials.

## Kartenmodell

Phase 2B verwendet absichtlich keine externen Kartenkacheln. Die Route wird
als skalierbare SVG-Geometrie mit Start-, Zwischenziel- und Zielmarkern
gezeichnet. Wheel-Zoom und Pointer-Pan funktionieren lokal und ohne
Drittanbieter-Telemetrie. Eine spätere Tile-Quelle muss konfigurierbar sein,
Attribution und Lizenz ausweisen und darf nicht automatisch sensible
Standortdaten an Dritte senden.

## Responsive/accessibility

Das Layout wechselt unter 600 px auf eine einspaltige Darstellung. Eingaben
haben sichtbare Labels, Buttons `aria-label` für Positionsaktionen und Fehler
werden als `role=alert` ausgegeben. Die Karte ist für Touch- und Tastatur-
Grundbedienung ausgelegt; vollständige Browser-/Screenreader-Prüfung bleibt
offen.
## Phase 2D Export

Die Karte verwendet den HA-WebSocket-Befehl `camper_route_planner/export_gpx`
für Route, Track und kombinierten Export. Der Aufruf erfolgt ausschließlich
im Eventhandler eines Exportbuttons; Rendering, HA-State-Updates und
Standortänderungen lösen keinen Export oder Routing-Aufruf aus. Der GPX-Inhalt
wird als Blob geteilt oder heruntergeladen und nicht dauerhaft im Browser oder
HA-Dateisystem abgelegt. Sygic-Deep-Links sind bewusst nicht implementiert.
