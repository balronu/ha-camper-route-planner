# Phase 2K – Installierbare interne Beta

## Ziel und Grenze

Phase 2K erstellt einen reproduzierbaren Teststand für eine spätere,
ausdrücklich freigegebene Installation. Es wurden keine Home-Assistant-
Instanzen, Dashboards, Proxmox-Ressourcen oder Nakordoni-Endpunkte verwendet.

## Änderungen

- Frontend-Bundle wird beim Build bytegleich in
  `custom_components/camper_route_planner/frontend/` übernommen.
- Die Integration liefert das Bundle mit HA
  `async_register_static_paths` aus und registriert es im Lovelace-
  Storage-Modus als idempotente JavaScript-Resource. Das vermeidet die
  Scoped-Registry-Race des parallelen `add_extra_js_url`-Ladewegs.
- Unload entfernt keine benutzerverwaltete Lovelace-Resource; bestehende
  Ressourcen bleiben erhalten. YAML-Ressourcen werden nicht automatisch
  verändert.
- `after_dependencies` für `frontend` und `http` ist im Manifest gesetzt.
- `tools/build_internal_beta.py` baut ausschließlich Laufzeitdateien in ein
  ZIP, prüft fehlende Dateien, Pfade, Symlinks, Secret-Muster und ZIP-CRC und
  erzeugt eine SHA-256-Datei.
- HA-Fixture- und Frontend-Regressionen prüfen Bundle-Auslieferung bzw. die
  bytegleiche Kopie.
- Die vorhandenen Projekt-Icons werden als `assets/icon.png` und
  `assets/icon.svg` in das Paket übernommen; sie sind keine Zugangsdaten und
  benötigen keine externe Laufzeitquelle.

Die Manifest-Version bleibt `0.1.0-alpha.1`: Die vorgeschlagene Kennzeichnung
`0.1.0-internal-beta.1` wird nur für ZIP-Dateiname und Testpaket verwendet,
damit keine ungültige oder öffentlich auswertbare HA-Version erzwungen wird.

## Bewusst nicht ausgeführt

Keine Installation, kein HA-Neustart, keine Dashboardänderung, kein echter
Nakordoni-Aufruf, kein API-Key, kein Merge, kein Tag, kein Release und keine
HACS-Veröffentlichung.
