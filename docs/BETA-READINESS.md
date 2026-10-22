# Beta-Readiness – Planungsstand vor `v0.1.0 Stable`

## Status

**Beta-Kandidat:** `v0.1.0-beta.20`. Die Lovelace-Installationskette ist für
HA 2026.10.1 isoliert geprüft. `v0.1.0 Stable` ist weiterhin nicht
veröffentlicht. Der Plan für Phase 2F–2I steht in
`docs/PHASE2F-2I-PLAN.md`.

Für die Beta wurden folgende Punkte nachgewiesen:

1. HA-2026.10.1-Fixture mit Config-Entry-Lifecycle und Static Path;
2. reproduzierbare Lovelace-Resource-Registrierung und Reload-Cleanup;
3. Chromium-Desktop/Mobile sowie visueller Editor und YAML-Kontrakt;
4. HACS-/manuelle Installationsstruktur und Versionsprüfung;
5. explizite Nutzerkommunikation, dass Mock-Routing keine verlässliche
   Wohnmobilnavigation ersetzt.

Offen bleiben Hassfest auf dem finalen Beta-Commit, ein echter HACS-UI-
Installations-/Update-/Deinstallationslauf, WebKit/iOS und produktive HA-
Prüfungen. Diese Grenzen werden nicht als reale HACS- oder iOS-Nachweise
ausgegeben.

Live-Nakordoni-Routing wurde für diese Beta nicht durch OpenClaw ausgeführt.
VM 104 und produktive Dashboards bleiben unverändert; die Veröffentlichung
erfolgt ausschließlich über GitHub/HACS.

Truck-Routing darf bis zur tatsächlichen Verfügbarkeit und Prüfung von
Nakordonis `vehicle_type=motorhome` nicht als sichere Wohnmobilnavigation
dargestellt werden. Demo-, Truck- und Motorhome-Routing sind getrennte Modi.
