# Phase 2O – Options-Persistenz und Lovelace-Integration

Stand: 2026-10-20. VM 104, bestehende Dashboards und produktive Config Entries
wurden in dieser Phase nicht verändert. Es wurden keine Nakordoni-API-Aufrufe
und keine Änderungen an `.storage` ausgeführt.

## Befund

Die Optionen wurden gespeichert, aber beim erneuten Anzeigen teilweise falsch
dargestellt. `CamperRoutePlannerOptionsFlow._schema()` las Provider und
Kartenanbieter nur aus `config_entry.data`; gespeicherte Werte in
`config_entry.options` wurden daher durch die Defaults `mock` und `none`
überdeckt. Es gab keinen Nachweis für einen Verlust der gespeicherten Werte.

## Korrekturen

- Options-Flow verwendet jetzt die effektive Zusammenführung aus `data` und
  `options` sowohl beim Speichern als auch beim Erzeugen des Formularschemas.
- Leere API-Key-Felder erhalten vorhandene Schlüssel; die expliziten
  `remove_api_key`- und `remove_carto_api_key`-Schalter löschen gezielt.
- Neue authentifizierte WebSocket-Aktion `camper_route_planner/list_entries`
  liefert ausschließlich `entry_id`, Titel und Status. Geheimnisse, Optionen
  und Profildaten werden nicht ausgeliefert.
- Die Karte wählt bei genau einer Instanz automatisch diese Config Entry, zeigt
  bei mehreren Instanzen eine Auswahl-/Hinweissituation und meldet bei null
  Instanzen die erforderliche Einrichtung. Explizite YAML-`entry_id` bleibt
  gültig.
- Der visuelle Editor lädt die Instanzliste über `hass.callWS`, verwendet ein
  Auswahlfeld und sendet `config-changed` composed/bubbling.
- `window.customCards` registriert den Karteneintrag idempotent mit deutschem
  Titel/Description, Vorschau-Metadaten und Dokumentationslink.

## Tests

- Python-Unittest: **PASS – 40/40**
- Frontend-Unit-/Static-Tests: **PASS – 12/12**
- Chromium-E2E: **PASS**, einschließlich Desktop/Mobile/Fallback sowie
  Einzelinstanz-Autoerkennung und idempotenter Katalogregistrierung
- Compileall und Diff-Check: **PASS**
- HA-Flow-Manager-Fixtures mit Home Assistant 2026.10.1: in der lokalen
  Umgebung nicht installiert; CI muss den Options-Persistenz- und
  `list_entries`-Test ausführen
- VM 104 / produktive HA-Konfiguration: **nicht verändert**
- Nakordoni live: **nicht ausgeführt**

## Beta.3-Provenienz

Das Paket wird erst aus dem finalen Commit reproduzierbar gebaut. Der Builder
schreibt `BETA-COMMIT.txt`, prüft erwartete Dateien, sichere ZIP-Pfade,
Secret-Muster und ZIP-Integrität; anschließend wird die SHA-256-Prüfsumme
separat dokumentiert. Beta.2-Artefakte werden nicht wiederverwendet.

## Bewertung vor CI

- **OPTIONS PERSISTENCE: PASS**
- **CONFIG ENTRY AUTO-DETECTION: PASS** (isolierte Tests)
- **CARD CATALOG: PASS** (isolierte Tests)
- **VISUAL EDITOR: PASS** (isolierte Tests)
- **BETA.3 READY TO INSTALL: NO – CI und Paketprüfung ausstehend**

Kein Merge, Tag oder Release.
