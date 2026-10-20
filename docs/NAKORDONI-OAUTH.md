# Nakordoni OAuth2/PKCE-Vorbereitung

Camper Route Planner benötigt einen eigenen Nakordoni-OAuth-Client. Der OAuth-Client von Mobile Fuel Stations wird nicht verwendet.

| Zweck | Wert |
|---|---|
| Authorize | `https://api.nakordoni.dev/oauth/authorize` |
| Token | `https://api.nakordoni.dev/oauth/token` |
| Redirect | `https://my.home-assistant.io/redirect/oauth` |
| PKCE | `S256` |

Die lokale Implementierung erzeugt Verifier/Challenge, State und eine synthetische Token-Normalisierung. Sie führt keinen Tokenaustausch aus. State-Mismatch und `invalid_grant` werden kontrolliert abgewiesen. Client-Secret, API-Key und Refresh-Token dürfen weder Repository, Frontend noch Logs erreichen.

Eine manuelle API-Key-Variante bleibt als spätere, sicher im Config Entry gespeicherte Alternative planbar. Die produktive Aktivierung erfordert zuerst den eigenen Client, Reauth-/Refresh-Tests und eine ausdrückliche Freigabe.

Die offizielle Dokumentation bestätigt: Public Client ohne Client-Secret, Authorization Code ist nur kurzzeitig und einmalig gültig, Refresh kann mit `invalid_grant` scheitern und muss dann eine Reauth auslösen. Der Schlüssel wird nur im Token-Response-Body geliefert. Bis zur Client-ID ist der OAuth-Modus in Camper Route Planner nicht verfügbar.
