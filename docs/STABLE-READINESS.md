# Stable-Readiness nach Phase 2I

## Fortschritt

Die manuelle persönliche API-Key-Anbindung ist offline implementiert. Der Key
bleibt lokal in Home Assistant; OAuth/PKCE ist für die erste Stable-Version
optional. Das Motorhome-Produkt bleibt Beta und wird nicht automatisch oder
beim Dashboard-Aufruf abgefragt.

## Verbleibende Gates für v0.1.0 Stable

- kontrollierte Live-Tests nach gesonderter Freigabe
- echte Prüfung der Key-/Kontingentzuordnung und Account Usage
- verifizierte Ergebnisse für Mautfelder und unvollständige Abdeckung
- konkrete, amtlich vergleichbare Restriktionsfälle 5–7
- Schweizer rechtliche Bewertung getrennt vom API-Routing
- Surface-Registrierung im jeweiligen Benutzerkonto
- Entscheidung über Stable erst nach Live-Ergebnisbericht

Bis dahin: **NO-GO für Stable, NO-GO für Merge/Tag/Release**.
