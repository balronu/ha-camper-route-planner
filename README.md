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
- eigenständiger Nakordoni-OAuth-Client
- Nakordoni-`vehicle_type=motorhome`
- verifizierte Wohnmobilnavigation
- automatische Lovelace-Resource-Registrierung

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

Laut Support-Ticket #230 ist `GET /api/v2/data/truck-route` mit dem
vorhandenen Zugang zugänglich. Das Projekt hat dafür keinen Live-Aufruf
ausgeführt. Das Truck-Routing besitzt ein separates Tageskontingent (Explorer
10, Starter 300 Routen/Tag; Zusatzkontingente möglich).

`vehicle_type=motorhome` ist noch nicht verfügbar. Eine erste Beta wurde
unverbindlich für ungefähr den 26.10.2026 prognostiziert. Das geplante Profil
soll Wohnmobilmaße, Gewichtsgrenzen, Wohnmobilverbote und Mautregeln
berücksichtigen; Lkw-Lenk- und Ruhezeiten sollen nicht gelten. Diese
Ankündigung ist kein API- oder Release-Gate.

Nakordoni soll nach Übermittlung der Repository-URL einen eigenen OAuth-Client
für dieses Projekt registrieren. Der Client von Mobile Fuel Stations wird
nicht übernommen. Jeder Nutzer verwendet seinen eigenen Zugang und sein
eigenes Routing-Kontingent.

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
`.github/workflows/validate.yml` geprüft; der öffentliche Repository-Stand wird
bereits durch GitHub Actions validiert. Das Ergebnis ist kein Stable- oder
Installationsfreigabe-Gate.

## Roadmap

1. **Phase 2F:** öffentliches Repository, Branding, Dokumentation und
   Validierung (abgeschlossen).
2. **Phase 2G:** kontrollierter Truck-Adapter nur nach Vertrags-, OAuth- und
   Quota-Freigabe.
3. **Phase 2H:** Motorhome-Vertrag und Schema erst nach tatsächlicher
   Providerfreigabe.
4. **Phase 2I:** konservative Vorbereitung von `v0.1.0 Stable`.

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
