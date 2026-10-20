# Phase 2K – Testbericht

Stand: 2026-10-20. Der Teststand bleibt auf dem Feature-Branch.

Verifizierter CI-Lauf: [Validate 39419593181](https://github.com/balronu/ha-camper-route-planner/actions/runs/39419593181)
für Code-Commit `11a0862b8563887bdef17e9dca9560ca3607abc7`.

## Offline-/CI-Ergebnisse

| Prüfung | Ergebnis |
|---|---|
| Python-Unittest | **PASS – 40/40** |
| HA-Fixtures | **PASS – 4/4 mit HA 2026.10.1**; der HTTP-lose Fixture überspringt die reale Static-Path-Registrierung kontrolliert |
| Frontend | **PASS – 11/11** |
| Frontend-Build und Bundle-Kopie | **PASS** |
| Chromium-E2E | **PASS** |
| Hassfest | **PASS** |
| Gitleaks/Quality | **PASS** |
| Compileall, JSON, Diff-Check | **PASS lokal** |
| ZIP-Integrität, Inhalt, Pfade, Secret-Scan, SHA-256 | **PASS** |
| WebKit/iOS | **NOT RUN** |
| Reale HA-Installation/Deinstallation | **NOT RUN** |
| Nakordoni live | **NOT TESTED** |

## Beta-Paket

- Name: `camper-route-planner-0.1.0-internal-beta.1.zip`
- Lokaler Pfad: `artifacts/camper-route-planner-0.1.0-internal-beta.1.zip`
- SHA-256: `2a048ec464325ba35671cd9f22a769f5955fdfc7cc0f04e8c1e170dc0d8a6fb3`
- Paket-Quellcommit: `11a0862b8563887bdef17e9dca9560ca3607abc7`
- Paketwurzel: `camper_route_planner/`
- Enthält: Integration, Config-/Options-Flow, Übersetzungen, Provider,
  WebSocket, Services und eingebettetes Frontend-Bundle
- Nicht enthalten: Tests, `node_modules`, `__pycache__`, Symlinks, Credentials,
  Entwicklungsquellen oder absolute Pfade

## Bewertung

- **READY TO INSTALL INTERNAL BETA: YES** – als kontrollierter, noch nicht
  installierter Kandidat. Die reale Installation, der Browser-Lifecycle und
  die API-Berechtigung bleiben Praxistests nach gesonderter Freigabe.
- **READY FOR PUBLIC v0.1.0 STABLE: NO** – reale HA-, Motorhome-API-, Maut-
  und Benutzer-Key-Prüfungen fehlen.

Der nachfolgende Dokumentations-Commit ändert den Paketinhalt nicht; das ZIP
bleibt auf dem oben genannten Paket-Quellcommit reproduzierbar.
