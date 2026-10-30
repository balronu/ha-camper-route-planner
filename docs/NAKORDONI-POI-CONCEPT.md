# NaKordoni-POI-Konzept / NaKordoni POI concept

## Deutsch

Dieses Dokument ist eine technische Machbarkeitsbewertung, keine produktive
POI-Implementierung. In Beta 6 werden weder `include=parking,fuel` noch
`fuel=diesel` automatisch an NaKordoni übertragen und es werden dafür keine
zusätzlichen API-Anfragen ausgeführt.

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

### Offene Machbarkeit

Die konkrete Antwortstruktur, Datenqualität, Dieselpreis-Verfügbarkeit,
Fahrzeugtauglichkeit, Laufzeit und Kontingentwirkung wurden ohne Live-Anfrage
nicht verifiziert. Dafür wird zunächst ein anonymisiertes Provider-Fixture oder
eine dokumentierte Antwortprobe benötigt. Erst danach sollte eine getrennte
Freigabe für Implementierung und zusätzliche API-Anfragen erfolgen.

## English

This document is a technical feasibility assessment, not a production POI
implementation. Beta 6 sends neither `include=parking,fuel` nor optional
`fuel=diesel` and makes no additional API request for POIs.

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

### Feasibility still open

The exact response shape, data quality, diesel-price availability, vehicle
suitability, latency, and quota impact remain unverified without a live request.
An anonymized provider fixture or documented response sample is required first;
implementation and extra API calls need separate approval.
