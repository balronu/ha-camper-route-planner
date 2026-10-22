# HACS- und manuelle Installationsstruktur

Die Struktur ist für die HACS-Custom-Integration `v0.1.0-beta.19` geprüft:

- `custom_components/camper_route_planner/` enthält die Integration;
- Manifest, Config Flow, Übersetzungen und `services.yaml` sind vorhanden;
- `hacs.json`, README und MIT-Lizenz sind vorhanden;
- das Frontend-Bundle wird reproduzierbar gebaut und in die Integration unter
  `custom_components/camper_route_planner/frontend/` übernommen;

Für die Beta wird das Repository in HACS als Custom repository hinzugefügt und
die Pre-release-Version ausdrücklich ausgewählt. Ein Stable-Release existiert
in dieser Vorbereitungsphase weiterhin nicht. Die Dokumentations- und
Issue-URLs im Manifest zeigen auf das Repository.
Die Integration liefert die Karte über einen HA-Static-Path und registriert
die versionierte Extra-JS-URL idempotent. Bestehende Dashboards werden nicht
verändert. Die isolierte HA-Fixture prüft HTTP 200, Bundle-Inhalt, Unload und
erneutes Setup; HACS-UI und iOS Safari bleiben separat ungetestet.
