# Phase 3E – Frontend-Fixes / Frontend fixes

## Deutsch

### Nachgewiesene Ursachen

- Die Leaflet-Karte wurde nur erzeugt, wenn bereits mindestens ein Punkt
  vorhanden war. Vor der ersten Route führte das direkt zum SVG-Status
  „Keine Route vorhanden“; eine CARTO-Basiskarte konnte nicht erscheinen.
- Jedes `input`-Event ersetzte den gesamten Shadow-DOM. Dadurch gingen Fokus,
  Cursorposition und der aktuelle Suchtext während der Eingabe oder bei einer
  verzögerten Geoapify-Antwort verloren.
- Das Formular verwendete eine feste Zwei-Spalten-Struktur und reagierte auf
  Viewport-Breite statt auf die tatsächliche Lovelace-Kartenbreite.

### Korrekturen

- Leaflet initialisiert bei konfiguriertem CARTO-Anbieter auch ohne Route und
  verwendet zunächst eine neutrale Mitteleuropa-Ansicht. Punkte, Marker und
  Geometrie werden weiterhin ergänzt, sobald sie verfügbar sind.
- Suchentwürfe, Request-Generationen und Fokus-/Cursorzustand werden geschützt;
  veraltete Antworten dürfen keinen neueren Benutzereingabetext überschreiben.
- Ein ResizeObserver hält Leaflet nach Größenänderungen und Rückkehr in ein
  Dashboard gültig; die Karteninstanz bleibt gekapselt.
- Das Layout wird anhand der Kartenbreite auf einspaltig bzw. zweispaltig
  gesetzt. Enge Kartencontainer und interne Leaflet-Panes erzeugen keinen
  sichtbaren horizontalen Überlauf.
- Koordinaten werden in der Oberfläche auf höchstens sechs Nachkommastellen
  formatiert; die internen Werte bleiben unverändert präzise.

## English

### Proven causes

- Leaflet was created only when at least one point existed. Before the first
  route this went straight to the SVG “no route” state, so no CARTO basemap
  could appear.
- Every `input` event replaced the complete shadow DOM. Focus, caret position,
  and the current search text were therefore lost during typing or delayed
  Geoapify responses.
- The form used a fixed two-column grid and reacted to viewport width rather
  than the actual Lovelace card width.

### Fixes

- With a configured CARTO provider, Leaflet now initializes without a route and
  starts at a neutral central-Europe view. Points, markers, and geometry are
  added when available.
- Search drafts, request generations, and focus/caret state are preserved;
  stale responses cannot overwrite newer user input.
- A ResizeObserver keeps Leaflet valid after card resizing and dashboard
  return; the map instance remains isolated.
- The layout uses the actual card width and switches between one and two
  columns. Narrow cards and internal Leaflet panes do not create visible
  horizontal overflow.
- Coordinates are displayed with at most six decimal places while internal
  precision is retained.

Live CARTO, Geoapify, Nakordoni, and productive Home Assistant rendering are
not tested by this document. Browser tests use controlled local fixtures.
