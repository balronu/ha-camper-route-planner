# HACS- und manuelle Installationsstruktur

Die Struktur ist für eine spätere HACS-Custom-Integration vorbereitet:

- `custom_components/camper_route_planner/` enthält die Integration;
- Manifest, Config Flow, Übersetzungen und `services.yaml` sind vorhanden;
- `hacs.json`, README und MIT-Lizenz sind vorhanden;
- das Frontend-Bundle wird reproduzierbar gebaut und in die Integration unter
  `custom_components/camper_route_planner/frontend/` übernommen;

Eine HACS-Installation, ein GitHub-Release und eine Veröffentlichung wurden
in Phase 2E nicht durchgeführt. Die Dokumentations- und Issue-URLs im
Manifest zeigen auf das geplante Repository; ein Release existiert noch nicht.
Die Integration liefert die Karte über einen HA-Static-Path und registriert
die versionierte Extra-JS-URL idempotent. Bestehende Dashboards werden nicht
verändert. Der reale HA-Neustart-/Update-Nachweis bleibt vor der Beta
NOT RUN.
