# Beta-Readiness – abgeschlossener Planungsstand vor `v0.1.0 Stable`

## Status

**Historischer Beta-Kandidat:** `v0.1.0-beta.21`. Die Lovelace-
Installationskette ist für HA 2026.10.1 isoliert geprüft. `v0.1.0 Stable` ist
seit dem Abschluss dieses Dokuments veröffentlicht. Der Plan für Phase 2F–2I steht in
`docs/PHASE2F-2I-PLAN.md`.

Für die Beta wurden folgende Punkte nachgewiesen:

1. HA-2026.10.1-Fixture mit Config-Entry-Lifecycle und Static Path;
2. reproduzierbare Lovelace-Resource-Registrierung und Reload-Cleanup;
3. Chromium-Desktop/Mobile sowie visueller Editor und YAML-Kontrakt;
4. HACS-/manuelle Installationsstruktur und Versionsprüfung;
5. explizite Nutzerkommunikation, dass Mock-Routing keine verlässliche
   Wohnmobilnavigation ersetzt.

Der abschließende Beta-Stand wurde durch Stable-CI, Nutzer-Installation,
Live-Routing und iPhone-Navigation ergänzt. Ein echter HACS-UI-
Installations-/Update-/Deinstallationslauf und produktive HA-Prüfungen sind
weiterhin nicht Bestandteil der automatisierten Repository-Gates.

Live-Nakordoni-Routing wurde für diese Beta nicht durch OpenClaw ausgeführt;
der Nutzer hat die Live-Funktion anschließend praktisch geprüft. VM 104 und
produktive Dashboards bleiben unverändert; die Veröffentlichung erfolgt über
GitHub/HACS.

Der Anbieterstatus des `vehicle_type=motorhome`-Profils kann weiterhin Beta
sein. Demo-, Truck- und Motorhome-Routing sind getrennte Modi; externe
Navigations-Apps können Fahrzeugparameter ignorieren.
