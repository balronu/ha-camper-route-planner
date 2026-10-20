# Phase 2H – Integrationsvalidierung

## Korrekturen

- Routing-, OAuth- und Usage-Hosts anhand der offiziellen Dokumentation getrennt.
- Motorhome-Fixture-Normalisierung an `data.vehicle`, `data.tolls.total_eur`, `by_country[].amount`, Beta-Warnung und Attribution angepasst.
- OAuth-Token-Normalisierung um Refresh-Request und Marktfreigaben ergänzt.
- Usage-Normalisierung an `data.plan`, `data.pass`, `data.markets.approved` und das offizielle Usage-Envelope angepasst.
- HTTP 504 sowie Reset-Hinweise werden defensiv behandelt.
- Kein Live-Transport, keine echte OAuth-Anmeldung und keine automatische Aktivierung.

## Bewusst nicht enthalten

Die Home-Assistant-OAuth2-Integration wird erst nach Ausstellung der eigenen Client-ID aktiviert. Bis dahin bleibt der Provider kontrolliert deaktiviert. Sensoren, Repair-Flows und echte Config-Entry-Tokenablage sind deshalb weiterhin Vorbereitungsarbeit und keine produktive Funktion.

