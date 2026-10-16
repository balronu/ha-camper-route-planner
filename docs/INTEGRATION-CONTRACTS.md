# Optionale Integrationsverträge

## Mobile Fuel Stations

Read-only Adapter `FuelAlongRouteProvider`: Routepunkte/Korridor, Kraftstoffart, Preis, Währung, `price_updated_at`, `stale`, Distanz zur Route und Umweg. Partnerintegration bleibt optional; ohne installierte und unterstützte Schnittstelle ist der Adapter deaktiviert. Keine Datenbankzugriffe, keine Änderung am bestehenden Repository.

## Camper Travel Journal

Read-only Adapter `TravelJournalRouteLinker`: geplante Route-ID, Reise-ID, Fahrzeugprofil-ID und später Referenz auf tatsächliche GPS-Track-ID. Nur explizite Zuordnung, reversible Verknüpfung, keine automatische Reisezuweisung. Ohne Partnerintegration bleibt er deaktiviert. Keine Änderung am bestehenden Repository.

## Gemeinsame Regeln

Adapter liefern versionierte, minimale DTOs. Keine Secrets, Tokens oder privaten GPS-Daten in Editor-WebSocket-Daten, Logs oder GPX-Exporten.
