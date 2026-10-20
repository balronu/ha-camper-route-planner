# Camper Route Planner

![Camper Route Planner](assets/logo.svg)

Deutschsprachige Home-Assistant-Custom-Integration zur manuellen
Routenplanung mit Fahrzeugprofilen, interaktiver Karte, gespeicherten Routen
und GPX-Export.

> **Status:** lokale Stable-Vorbereitung, noch kein veröffentlichtes Release.
> Der aktuelle Stand verwendet ausschließlich deterministisches Mock-Routing.
> Er ist keine geprüfte Wohnmobilnavigation.

[English version](README.en.md) · [Dokumentation](docs/)

![Desktop](assets/screenshots/desktop.png)
![Mobil](assets/screenshots/mobile.png)

## Bereits implementiert

- Fahrzeugprofile mit Höhe, Breite, Länge, Gewicht und Fahrzeugart
- Start, Ziel und Zwischenziele
- manuelle Berechnung ausschließlich nach Benutzeraktion
- CARTO-Kartenintegration mit SVG-Fallback
- deterministisches Mock-Routing für Offline-Tests
- Speicherung und Laden synthetischer Routen
- GPX-Export als Route, Track oder kombiniert
- deutsche und englische UI-Texte

## Noch nicht verfügbar

- produktives Nakordoni-Routing
- Nakordoni-`vehicle_type=motorhome`
- verifizierte Wohnmobilnavigation
- automatische Auslieferung der Lovelace-Karte über die Integration

Truck-Routing darf bis zur Verfügbarkeit und Prüfung des echten Motorhome-
Profils nicht als sichere Wohnmobilnavigation dargestellt werden. Ein
stiller Fallback von Motorhome auf Truck ist ausgeschlossen.

## Installation und Konfiguration

Die Struktur ist für eine spätere HACS-Custom-Integration vorbereitet. Vor
einem regulären Release gibt es jedoch **keine Installationsfreigabe**.

Nach einer späteren Freigabe wird die Integration über HACS oder manuell nach
`custom_components/camper_route_planner/` installiert. Anschließend wird sie
über **Einstellungen → Geräte & Dienste** eingerichtet. Im aktuellen Stand
wird der Mock-Provider für lokale Tests verwendet.

### Karten

Die Karte kann mit einer browsergeeigneten CARTO-Konfiguration betrieben
werden. Zugangsdaten gehören nicht in das Frontend, in Screenshots, Logs,
GPX-Dateien oder Git. Wenn keine Kartenkacheln verfügbar sind, zeigt die
Karte den integrierten SVG-Fallback.

### Routen und GPX

Die Berechnung wird ausschließlich über die Schaltfläche bzw. die explizite
Service-Grenze ausgelöst. GPS-Änderungen, HA-Start, Reload oder das Öffnen der
Karte starten keine Berechnung. Der GPX-Export arbeitet auf der gespeicherten
normalisierten Route und enthält keine Zugangsdaten.

## Nakordoni-Status

Jede Installation verwendet ausschließlich den persönlichen Nakordoni-
Developer-API-Key des Benutzers. Der Key wird im Home-Assistant
Config-/Options-Flow als Passwortfeld eingegeben und lokal in der Config Entry
gespeichert; er wird nie an Lovelace, Browser-Local-Storage, GPX oder Logs
übertragen. Erneuerung und explizites Entfernen sind über den Options Flow
möglich. Siehe [API-Key-Anbindung](docs/NAKORDONI-API-KEY.md).

Laut Support-Ticket #230 ist `GET /api/v2/data/truck-route` mit dem
vorhandenen Zugang zugänglich. Das Projekt hat dafür keinen Live-Aufruf
ausgeführt. Das Truck-Routing besitzt ein separates Tageskontingent (Explorer
10, Starter 300 Routen/Tag; Zusatzkontingente möglich).

`vehicle_type=motorhome` ist als Beta dokumentiert. Das Profil verwendet
7,65 m × 2,34 m × 3,20 m, 4,8 t und zwei Achsen; Lkw-Lenk- und Ruhezeitfelder
werden nicht übertragen. Reale Aufrufe bleiben bis zur gesonderten Freigabe
aus. Das isolierte Werkzeug startet standardmäßig im Dry-Run; der
[Live-Testplan](docs/PHASE2I-LIVE-TEST-PLAN.md) begrenzt den ersten Tag auf
acht Abfragen.

OAuth/PKCE bleibt als spätere Alternative vorbereitet und ist für v0.1.0
Stable optional. Der Client von Mobile Fuel Stations wird nicht übernommen.
Jeder Nutzer verwendet seinen eigenen Zugang und sein eigenes Routing-
Kontingent. Die Surface-Registrierung im Nakordoni-Dashboard ist vorbereitet,
aber nicht in einem fremden Account durchgeführt.

Details: [Nakordoni-Planungsupdate](docs/NAKORDONI-PLANUNGSUPDATE-2026-10-16.md),
[API-Audit](docs/NAKORDONI-API-AUDIT.md),
[Phase-2F-bis-2I-Plan](docs/PHASE2F-2I-PLAN.md).

## Sicherheit und Einschränkungen

- keine produktiven Secrets oder Tokens im Repository
- keine direkten Browser-Aufrufe zu Nakordoni
- keine Live-Routing- oder Live-CARTO-Anfragen in dieser Entwicklungsphase
- keine automatische Routenberechnung
- unbekannte Restriktionen werden nicht als freie Strecke interpretiert
- Truck-Maut, Truck-Fahrverbote und Ruheplanung sind nicht automatisch auf
  private Wohnmobile übertragbar

## Entwicklung und Tests

```bash
PYTHONPATH=src:. python3 -m unittest discover -s tests -v
python3 -m compileall -q src tests custom_components
cd frontend
npm ci
npm test
npm run build
npm run test:e2e
```

Die Ausführungs- und Blocker-Matrix steht in
[docs/PHASE2E-TEST-REPORT.md](docs/PHASE2E-TEST-REPORT.md). Hassfest und
GitHub-seitige Validierung werden über
`.github/workflows/validate.yml` geprüft, sobald das Repository veröffentlicht
ist.

## Roadmap

1. **Phase 2F:** eigenständiges Repository, Branding, Dokumentation und
   Validierung.
2. **Phase 2G:** Offline-Vorbereitung des Nakordoni-Motorhome-Beta-Providers,
   OAuth-/PKCE-, Quoten- und Mautvertrag.
3. **Phase 2H:** Offline-Provider, OAuth-/PKCE-Vorbereitung und CI.
4. **Phase 2I:** persönliche API-Keys, Dry-Run-Testwerkzeug und Live-Testplan;
   kein Release ohne Ergebnisbericht und dokumentierte Freigabe.
5. **Phase 2J:** isolierte interne-Beta-Installation, Lifecycle- und
   Rücknahmeplanung; noch keine Installation oder Live-Abfrage.
6. **Phase 2K:** eingebettetes Frontend, installierbares internes ZIP und
   isolierte Paketprüfung; noch keine Installation oder Live-Abfrage.

## Phase 2G/2H: Nakordoni Motorhome-Beta

Der Provider `nakordoni_motorhome` ist lokal als Offline-/Fixture-Provider vorbereitet, aber nicht produktiv aktiviert. Nakordoni Motorhome ist eine Beta; Verkehrszeichen und geltende Vorschriften haben Vorrang. Es gibt keine automatische Umschaltung vom Mock-Provider und keine verifizierte Wohnmobilnavigation.

OAuth/PKCE bleibt als spätere Alternative vorbereitet und ist für v0.1.0
Stable optional. Der OAuth-Client von Mobile Fuel Stations wird nicht verwendet.
Keine Live-Routingabfragen wurden in Phase 2I ausgeführt.

Routendaten werden mit [Data by nakordoni.eu](https://nakordoni.eu) attribuiert. Die Routing-API ist offiziell unter `nakordoni.eu` dokumentiert; OAuth und Account Usage unter `api.nakordoni.dev`. Details: [Phase 2H](docs/PHASE2H-IMPLEMENTATION.md), [API-Hosts](docs/NAKORDONI-API-HOSTS.md), [OAuth](docs/NAKORDONI-OAUTH.md), [Kontingente](docs/NAKORDONI-QUOTAS.md), [Maut](docs/NAKORDONI-TOLLS.md).

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
