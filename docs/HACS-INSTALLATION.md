# HACS- und manuelle Installationsstruktur

Die Struktur ist für eine spätere HACS-Custom-Integration vorbereitet:

- `custom_components/camper_route_planner/` enthält die Integration;
- Manifest, Config Flow, Übersetzungen und `services.yaml` sind vorhanden;
- `hacs.json`, README und MIT-Lizenz sind vorhanden;
- das Frontend-Bundle wird reproduzierbar unter `frontend/dist/` gebaut.

Eine HACS-Installation, ein GitHub-Release und eine Veröffentlichung wurden
in Phase 2E nicht durchgeführt. Die Dokumentations- und Issue-URLs im
Manifest zeigen auf das geplante Repository; ein Release existiert noch nicht.
Die Karte wird derzeit manuell als Lovelace-Ressource
eingebunden; automatische Resource-Registrierung ist bewusst offen.
