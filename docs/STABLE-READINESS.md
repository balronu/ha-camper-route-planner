# Stable-Readiness nach Phase 2J (historisch)

> **Archivhinweis:** Dieses Dokument beschreibt den früheren Planungsstand vor
> Stable. Die aktuelle Stable ist `v0.1.5`; die maßgebliche Dokumentation steht
> in [docs/releases/v0.1.5.md](releases/v0.1.5.md) und
> [HACS-INSTALLATION.md](HACS-INSTALLATION.md). Die folgenden No-Go-Gates sind
> keine aktuelle Release-Sperre.

## Fortschritt

Die manuelle persönliche API-Key-Anbindung, die eingebettete Lovelace-Karte
und das isolierte Beta-Installationspaket sind vorbereitet. Der Key bleibt
lokal in Home Assistant; OAuth/PKCE ist optional. Das Motorhome-Produkt bleibt
Beta und wird nicht automatisch oder beim Dashboard-Aufruf abgefragt.

## Historische verbleibende Gates für v0.1.0 Stable

- kontrollierter HA-Installations- und Praxistest nach gesonderter Freigabe
- CI-/Fixture-Nachweis des neuen Static-Path-/Extra-JS-Lifecycle-Codes
- reale Motorhome-API-Antwort mit vollständigem Fahrzeugprofil
- echte Prüfung der Key-/Kontingentzuordnung und Account Usage
- verifizierte Ergebnisse für Mautfelder und unvollständige Abdeckung
- konkrete, amtlich vergleichbare Restriktionsfälle 5–7
- Schweizer rechtliche Bewertung getrennt vom API-Routing
- Surface-Registrierung im jeweiligen Benutzerkonto
- Entscheidung über Stable erst nach Live-Ergebnisbericht

Bis dahin: **NO-GO für interne Beta und Stable, NO-GO für Merge/Tag/Release**.
