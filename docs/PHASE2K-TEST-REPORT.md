# Phase 2K – Testbericht

Stand: 2026-10-20. Der Teststand bleibt auf dem Feature-Branch.

## Offline-/CI-Ergebnisse

| Prüfung | Ergebnis |
|---|---|
| Python-Unittest | **PASS – 40/40** |
| HA-Fixtures | **nach Push erneut auszuführen – 4 Tests mit Static-Path-/Unload-Assertions** |
| Frontend | **PASS – 11/11** |
| Frontend-Build und Bundle-Kopie | **PASS** |
| Chromium-E2E | **PASS im vorherigen CI-Lauf; Phase-2K-Lauf folgt** |
| Hassfest | **Phase-2K-CI-Lauf folgt** |
| Gitleaks/Quality | **Phase-2K-CI-Lauf folgt** |
| Compileall, JSON, Diff-Check | **PASS lokal** |
| ZIP-Integrität, Inhalt, Pfade, Secret-Scan, SHA-256 | **PASS** |
| WebKit/iOS | **NOT RUN** |
| Reale HA-Installation/Deinstallation | **NOT RUN** |
| Nakordoni live | **NOT TESTED** |

## Beta-Paket

- Name: `camper-route-planner-0.1.0-internal-beta.1.zip`
- Lokaler Pfad: `artifacts/camper-route-planner-0.1.0-internal-beta.1.zip`
- SHA-256: `2c2bcafeb93174864ca1fbb370c27372c81320d9abdb28f50d943ad956468439`
- Paket-Quellcommit: `b4a258c5431d02b4f94be3f798548bbf049a9478`
- Paketwurzel: `camper_route_planner/`
- Enthält: Integration, Config-/Options-Flow, Übersetzungen, Provider,
  WebSocket, Services und eingebettetes Frontend-Bundle
- Nicht enthalten: Tests, `node_modules`, `__pycache__`, Symlinks, Credentials,
  Entwicklungsquellen oder absolute Pfade

## Bewertung

- **READY TO INSTALL INTERNAL BETA: NO** bis der Phase-2K-CI-Lauf den neuen
  Static-Path-/Unload-Code bestätigt; danach weiterhin nur als kontrollierter
  Installationskandidat, nicht als bereits installierte Beta.
- **READY FOR PUBLIC v0.1.0 STABLE: NO** – reale HA-, Motorhome-API-, Maut-
  und Benutzer-Key-Prüfungen fehlen.
