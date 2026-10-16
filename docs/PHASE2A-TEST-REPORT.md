# Phase 2A – Testbericht

## Ergebnisse

| Prüfung | Ergebnis |
|---|---|
| Gesamte Offline-Suite | **PASS – 17 Tests** |
| Phase-1-Tests | **PASS – 7 Tests** |
| Phase-2A-Tests | **PASS – 10 Tests** |
| Python Compileall (`custom_components`, `src`, `tests`) | **PASS** |
| JSON-Parsing für Manifest, Strings und Übersetzungen | **PASS** |
| Credential-Pattern-Scan | **PASS – kein credential-artiger Wert** |
| Netzwerk-Code-Scan | **PASS – kein HTTP-Client/kein impliziter Netzwerkaufruf** |
| Pytest | **BLOCKED – pytest nicht installiert; unittest vollständig ausgeführt** |
| YAML-Parsing von `services.yaml` | **BLOCKED – PyYAML nicht installiert** |
| Mock ohne Netzwerk | **PASS – nur lokale deterministische Berechnung** |
| Nakordoni Live-Aufruf | **NOT RUN / absichtlich gesperrt** |
| HA-Config-Flow mit echter HA-Fixture | **BLOCKED – HA-Paket/Fixture nicht verfügbar** |
| Hassfest/HACS | **BLOCKED / NOT RUN – keine lokale HA-Validierungsumgebung** |
| Produktive HA-/VM-/Proxmox-Prüfung | **NOT RUN – ausdrücklich außerhalb des Scopes** |

Ausführung:

```text
PYTHONPATH=src:. python3 -m unittest discover -s tests -v
Ran 17 tests ... OK
```

Abgedeckt sind unter anderem unabhängige Profile, Carthago-Fixture,
Grenzwertvalidierung, deterministische Waypoints, manuelle Berechnung,
In-Flight-Deduplizierung, Quota-Sperre, Storage-Migration/Wiederanlauf,
Config-Flow-Validierung, Mock- und Nakordoni-Fixtures, Live-Gate sowie
optionale Adapterverträge.

## Abnahme Phase 2A

| Kriterium | Status | Begründung |
|---|---|---|
| HA-Struktur | **PASS (offline)** | Domain, Manifest, Config Flow, Options Flow, Services und Übersetzungen vorhanden. Echte Hassfest-Prüfung offen. |
| Mehrere Profile | **PASS** | Versioniertes Profilmodell und wiederholbarer Options-Flow; Testfixture bleibt nicht-produktiv. |
| Mock-Routing | **PASS** | Deterministische synthetische Route mit Waypoints und Warnung. |
| Live-Routing gesperrt | **PASS** | Nakordoni `calculate()` liefert `live_routing_disabled`; kein HTTP-Client. |
| Nur manuelle Berechnung | **PASS** | Nur Service/Coordinator-Methode; keine Listener, Timer oder Refresh-Schleife. |
| Speicherung/Wiederherstellung | **PASS (offline)** | HA-Store-Adapter plus getestete atomare JSON-/Memory-Backends und Migration. |
| Optionale Integrationen | **PASS** | Deaktivierte, datenbankfreie Verträge; fehlende Partner sind kein Startfehler. |
| Tests | **PASS** | 17/17 Offline-Tests, Compileall und JSON-Prüfungen bestanden. |
| Secrets | **PASS** | Keine Secrets gelesen; Scan und GPX-/Route-Modellgrenzen ohne Credential-Felder. |
| Produktivsysteme unverändert | **PASS** | Nur lokales Projektverzeichnis geändert. |

## Offene Punkte für Phase 2B

- HA 2026.10.x Fixture/Hassfest/HACS gegen die echte Zielversion ausführen.
- Config-Entry-Daten und Secret-Storage mit der aktuellen HA-API verifizieren.
- Erst nach separater Freigabe einen echten, nicht kontingentverbrauchenden
  oder ausdrücklich freigegebenen Nakordoni-Test planen.
- Nakordoni-HTTP-Client, Response-Schema und Quota-Header erst nach Klärung
  der Phase-1-Risiken implementieren.
- Sygic-Zielgerätetest und produktive Installation bleiben eigene Gates.
