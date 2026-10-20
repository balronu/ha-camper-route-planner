# Nakordoni API-Hosts – Prüfung Phase 2H

Geprüft am 20.10.2026 gegen die offiziellen Entwicklerdokumente. Es wurde kein API-Aufruf ausgeführt.

| Funktion | Offizielle URL | Status |
|---|---|---|
| Routing | `https://nakordoni.eu/api/v2/data/truck-route` | bestätigt |
| OAuth Authorize | `https://api.nakordoni.dev/oauth/authorize` | bestätigt |
| OAuth Token | `https://api.nakordoni.dev/oauth/token` | bestätigt |
| OAuth Revoke | `https://api.nakordoni.dev/oauth/revoke` | dokumentiert, noch nicht implementiert |
| Account Usage | `https://api.nakordoni.dev/api/v2/account/usage` | bestätigt |
| HA Redirect | `https://my.home-assistant.io/redirect/oauth` | exakt registrieren |

Die frühere Routing-Konstante `api.nakordoni.dev/api/v2/...` war nicht ausreichend belegt und wurde auf den offiziell dokumentierten Routing-Host korrigiert. Vor Live-Aktivierung bleibt eine gezielte Rückfrage offen, ob für den aus Ticket #230 bekannten Zugang ein abweichender Host gilt.

Offene Rückfrage an Nakordoni:

1. Gilt für Camper Route Planner verbindlich `nakordoni.eu/api/v2/data/truck-route` oder ein dedizierter API-Host?
2. Ist `GET /api/v2/account/usage` auf `api.nakordoni.dev` für den auszustellenden OAuth-Client freigeschaltet?
3. Welche Client-ID und welche exakt registrierte Redirect-URI werden für das öffentliche Home-Assistant-Projekt ausgestellt?

