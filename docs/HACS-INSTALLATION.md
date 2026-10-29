# HACS- und manuelle Installationsstruktur

Die Struktur ist für die Stable-HACS-Custom-Integration `v0.1.5` und die
historische Pre-release-Linie `v0.1.4-beta.5` geprüft:

- `custom_components/camper_route_planner/` enthält die Integration;
- Manifest, Config Flow, Übersetzungen und `services.yaml` sind vorhanden;
- `hacs.json`, README und MIT-Lizenz sind vorhanden;
- das Frontend-Bundle wird reproduzierbar gebaut und in die Integration unter
  `custom_components/camper_route_planner/frontend/` übernommen;

Das Repository kann in HACS als Custom repository hinzugefügt werden; HACS
erkennt das reguläre Stable-Release `v0.1.5` über Tag und Manifest. Die
historische Beta.5 muss in HACS ausdrücklich als Pre-release ausgewählt werden. Die
Dokumentations- und
Issue-URLs im Manifest zeigen auf das Repository.

v2 und v3 sind getrennte auswählbare NaKordoni-Pfade. v3 bleibt für
Wohnmobile eine Beta-Schnittstelle; unvollständige Mautabdeckung wird mit
`complete=false` und Providerhinweisen angezeigt. V2-Schätzwerte werden nicht
als v3-Ergebnisse übernommen.
Die Integration liefert die Karte über einen HA-Static-Path und registriert
die versionierte Extra-JS-URL idempotent. Bestehende Dashboards werden nicht
verändert. Die isolierte HA-Fixture prüft HTTP 200, Bundle-Inhalt, Unload und
erneutes Setup; HACS-UI und iOS Safari bleiben separat ungetestet.
