# Phase 2M – Options-Flow-Hotfix und interne Beta.2

Stand: 2026-10-20. Die installierte Beta auf VM 104 wurde nicht verändert.

## Ursache

Der Options Flow brach beim Öffnen über den Home-Assistant-Flow-Manager mit
folgendem Fehler ab:

```text
AttributeError: property 'config_entry' of
'CamperRoutePlannerOptionsFlow' object has no setter
```

Auslöser war `CamperRoutePlannerOptionsFlow.__init__` in
`custom_components/camper_route_planner/config_flow.py`: Der Konstruktor schrieb
`self.config_entry = config_entry`. In HA 2026.x stellt Home Assistant die
Config Entry über eine schreibgeschützte `OptionsFlow.config_entry`-Property
bereit. Die Factory muss daher eine Flow-Instanz ohne Konstruktorargument
zurückgeben; die Integration darf die Property nicht selbst setzen.

Die bisherigen vier HA-Fixtures erkannten das nicht, weil sie Config Flow,
Integration-Setup, WebSocket-Services und Unload prüften, aber keinen Options
Flow über `hass.config_entries.options.async_init(entry_id)` öffneten.

## Korrektur

- Options-Flow-Fabrik auf `CamperRoutePlannerOptionsFlow()` umgestellt.
- Eigenen Konstruktor und die schreibgeschützte Property-Zuweisung entfernt.
- Beim Speichern werden bestehende `data`-/`options`-Felder in den neuen
  Options-Eintrag übernommen; der Mock-Provider, gespeicherte API-Keys,
  Fahrzeugprofile und Routingverhalten bleiben unverändert.
- Kein Netzwerkaufruf und keine Config-Entry-Entfernung.

Betroffene Stelle: `config_flow.py`, vormals Zeile 56; die aktuelle Flow-Fabrik
steht in Zeile 49, die Options-Klasse beginnt in Zeile 52.

## Regressionstest

`tests/test_phase2c_ha.py::test_options_flow_manager_form_save_reopen_and_invalid_input`
verwendet den echten HA-Options-Flow-Manager und prüft:

- bestehenden Mock-Config-Entry öffnen,
- Init- und Profilformular anzeigen,
- Fahrzeugprofil speichern,
- bestehende Option erhalten,
- Flow erneut öffnen,
- ungültige CARTO-Eingabe feldbezogen ablehnen und bestehende Konfiguration
  unverändert lassen.

## Qualitätssicherung

Verifizierter CI-Lauf für Quellcommit `cecb5ad88f76826f56e90f53d74f74cd47580233`:
[Validate 39425356646](https://github.com/balronu/ha-camper-route-planner/actions/runs/39425356646)

| Prüfung | Ergebnis |
|---|---|
| Python-Unittest | **PASS – 40/40** |
| HA-Fixtures mit HA 2026.10.1 | **PASS – 5/5**, einschließlich Options-Flow-Manager |
| Frontend-Tests und Build | **PASS** |
| Chromium-E2E | **PASS** |
| Hassfest | **PASS** |
| Gitleaks/Quality | **PASS** |
| Compileall, JSON, Diff-Check | **PASS** |
| ZIP-Integrität, Pfade, Secret-Scan | **PASS** |
| WebKit/iOS | **NOT RUN** |
| VM 104 / produktive HA-Konfiguration | **NICHT VERÄNDERT** |
| Nakordoni live | **NICHT AUSGEFÜHRT** |

## Beta.2 und Provenienz

- ZIP: `artifacts/camper-route-planner-0.1.0-internal-beta.2.zip`
- SHA-256: `523bf08d7ed9453a1086dba6c39b90de9065a6626eaf9fb734d0f0f97047c140`
- Paketquellcommit in `BETA-COMMIT.txt`:
  `cecb5ad88f76826f56e90f53d74f74cd47580233`
- ZIP-Mitglieder: 30, kein `__pycache__`, keine Symlinks, keine absoluten oder
  aufwärts gerichteten Pfade

Die frühere Beta.1 enthält nachweisbar `BETA-COMMIT: 11a0862` und den Hash
`2a048ec464325ba35671cd9f22a769f5955fdfc7cc0f04e8c1e170dc0d8a6fb3`. Ursache
der Abweichung war das vor dem Dokumentationsabschluss erzeugte Paket aus dem
Packaging-Commit `11a0862`; der dokumentierte Branch-Stand `f3c2d5e` kam danach.
Beta.2 wurde neu gebaut und verwendet keine alten Artefakte.

## Bewertung

- **OPTIONS FLOW FIX: PASS**
- **BETA.2 READY TO INSTALL: YES** – nur nach separater Freigabe.

## Aktualisierungsplan für VM 104

1. Separate Freigabe für die Installation einholen.
2. ZIP und SHA-256 vor dem Transfer erneut vergleichen.
3. Bestehende Config Entry unverändert lassen; nur das Integrationsverzeichnis
   gezielt aktualisieren.
4. HA-Konfiguration prüfen und kontrolliert neu starten, falls freigegeben.
5. Options Flow über die bestehende Mock-Konfiguration öffnen, speichern und
   wieder öffnen; anschließend Offline-Mock-Route prüfen.
6. Erst nach separater Freigabe einen echten Nakordoni-Test erwägen; Beta.2
   führt keinen solchen Aufruf automatisch aus.

Kein Merge, Tag oder Release wurde durchgeführt.
