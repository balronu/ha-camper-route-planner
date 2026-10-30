# NaKordoni-POI-Konzept / NaKordoni POI concept

## Deutsch

Dieses Dokument begann als technische Machbarkeitsbewertung. Seit Beta 9 ist
die dort beschriebene optionale, same-request-basierte POI-Verarbeitung als
fixture-getestete Beta-Funktion umgesetzt. Es gibt weiterhin keine zusätzliche
Anfrage beim Öffnen, Schließen, Zoomen oder Verschieben der Karte.

### Vorgeschlagene Architektur

- POIs werden als ausdrückliche, optionale Routenoption angefordert; die
  Standardberechnung bleibt unverändert.
- Der Provider erhält `include=parking,fuel` und optional `fuel=diesel` in
  derselben bewusst gestarteten Routenanfrage. Popup öffnen, Schließen,
  Zoomen und Verschieben lösen keine Anfrage aus.
- Die Antwort wird in ein internes Schema normalisiert: stabile ID, Kategorie
  (`parking`/`fuel`), Name, Breitengrad, Längengrad, `km_from_start`,
  Fahrzeugtauglichkeit, Quelle, Datenstand sowie optionale Kraftstoffart,
  Preis und Währung. Unbekannte oder unplausible Felder werden verworfen.
- POIs erhalten eine eigene Leaflet-Layer-Gruppe. Marker werden nicht mit
  Stationsmarkern vermischt und über die stabile ID aktualisiert.
- Cache-Schlüssel enthalten Routenparameter, `include` und `fuel`; Laufzeit,
  Antwortgröße und Kontingentverbrauch werden begrenzt und diagnostiziert.
- Mobile Fuel Stations kann dasselbe normalisierte Anzeigemodell verwenden,
  bleibt aber ein unabhängiger Provider mit eigenen Zugangsdaten, Anfragen und
  Cache-Grenzen.

### Umgesetzte Grenzen und offene Praxisprüfung

Die dokumentierte Antwortstruktur wird über isolierte Fixtures normalisiert:
`parking` und `fuel` werden begrenzt, Koordinaten und Entfernungen validiert,
und nur tatsächlich gelieferte Preisfelder übernommen. Fahrzeugtauglichkeit,
Öffnungszeiten, Preise und Laufzeit werden nicht ergänzt oder erfunden.
Eine produktive Praxisprüfung, Kontingentmessung und Live-Datenqualitätsprüfung
bleiben für eine spätere, ausdrücklich freigegebene Abnahme offen.

## English

This document started as a technical feasibility assessment. Since beta 9,
the optional same-request POI processing described here is implemented and
covered by isolated fixtures. Opening, closing, zooming, or panning the map
still makes no additional request.

### Proposed architecture

- POIs are an explicit, optional route request feature; the default calculation
  remains unchanged.
- The provider would send `include=parking,fuel` and optionally `fuel=diesel`
  in the same deliberate route request. Opening, closing, zooming, or panning
  the popup would never request data.
- Responses would be normalized to a stable internal schema: ID, category,
  label, latitude, longitude, `km_from_start`, vehicle suitability, source,
  timestamp, and optional fuel type, price, and currency. Unknown or implausible
  fields are discarded.
- POIs use a separate Leaflet layer group and are never mixed with station
  markers; updates are keyed by the stable POI ID.
- Cache keys include route parameters, `include`, and `fuel`; runtime, response
  size, and quota use are bounded and exposed to diagnostics.
- Mobile Fuel Stations may reuse the normalized display model, but remains an
  independent provider with separate credentials, requests, and cache limits.

### Implemented limits and practical validation still open

The documented response shape is normalized through isolated fixtures:
`parking` and `fuel` are bounded, coordinates and distances are validated, and
only actually supplied price fields are retained. Vehicle suitability, opening
hours, prices, and latency are never invented. A productive acceptance test,
quota measurement, and live data-quality review remain open for a separately
approved future step.
