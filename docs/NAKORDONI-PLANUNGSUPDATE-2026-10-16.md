# Nakordoni-Planungsupdate – 16.10.2026

## Geltungsbereich

Dieses Dokument verarbeitet die Angaben aus dem Support-Ticket #230 als
Planungsgrundlage. Es wurden keine Secrets gelesen, kein Live-Endpunkt
aufgerufen und kein Kontingent verbraucht. Die Aussagen sind daher weder ein
Connectivity-Test noch eine Freigabe für produktives Routing.

## Repository- und Phasenstatus

Der angegebene Projektordner enthält bereits Dokumentation zu Phase 2F bis 2I,
aber keine nachweisbare Phase-2F-Implementierung. Er ist aktuell kein eigenes
Git-Repository, sondern liegt als unversionierter Unterordner im Workspace;
damit gibt es dort keinen belastbaren Phase-2F-Commit, Merge, Tag oder Push.
Die bestehende `manifest.json` trägt weiterhin `0.1.0-alpha.1`; sie wurde in
diesem Planungsupdate bewusst nicht geändert. `v0.1.0 Stable` bleibt ein
Planungsziel, keine veröffentlichte Version.

## Verbindlicher Planungsstand

| Thema | Stand | Konsequenz |
|---|---|---|
| Endpoint | `GET /api/v2/data/truck-route` ist laut Support mit dem vorhandenen Zugang zugänglich | Nur dokumentieren; Implementierung bleibt feature-gated |
| Truck-Kontingent | Explorer 10, Starter 300 Routen/Tag; Zusatzkontingente möglich | Eigener Quota-Guard pro Benutzer/Config Entry und Produkt |
| Motorhome | `vehicle_type=motorhome` noch nicht verfügbar; Beta-Termin ca. 26.10.2026 unverbindlich | Kein Parameter, kein Fallback und kein Release-Versprechen |
| Motorhome-Semantik | Maße, Gewichtsgrenzen, Wohnmobilverbote und Mautregeln geplant; keine Lkw-Lenk-/Ruhezeiten | Erst nach bestätigtem Schema als Providervertrag übernehmen |
| OAuth | Nakordoni will nach Repository-URL einen eigenen Client registrieren | Kein Übernehmen des Mobile-Fuel-Stations-Clients |
| Nutzerkonto | Jeder Nutzer verwendet eigenen Nakordoni-Zugang und eigenes Kontingent | Kein gemeinsames Projektkonto und keine globale Quota-Annahme |

## Modustrennung

1. **Demo:** deterministische synthetische Daten, immer `synthetic=true`; keine
   Aussage über Straßen, Maut, Verbote oder Verkehr.
2. **Truck:** Nakordoni-Truck-Route; sichtbare Kennzeichnung als Truck/HGV und
   ausdrücklich keine sichere Wohnmobilnavigation.
3. **Motorhome:** erst nach tatsächlicher Providerfreigabe, vollständiger
   Parameter-/Antwortdokumentation und Tests. Kein stiller Truck-Fallback.

Die UI, der Export und gespeicherte Routen müssen den Modus und den
Verifikationsstatus erhalten. Unbekannte Restriktionen bleiben `unknown`.

## Phasenentscheidung 2F bis 2I

- **2F:** Vertrags-, OAuth-, Quota- und Sicherheitsgrundlage dokumentieren.
- **2G:** Truck-Adapter nur als manuelle, separat freigegebene und
  kontingentgeschützte Funktion vorbereiten.
- **2H:** Providerneutrales Motorhome-Modell versioniert vorbereiten; keine
  unbestätigten Nakordoni-Feldnamen oder Wertebereiche implementieren.
- **2I:** `v0.1.0 Stable` nur mit klarer Funktionsgrenze vorbereiten. Stable
  darf zunächst Demo/Offline bedeuten; Truck und Motorhome benötigen ihre
  eigenen Freigabegates.

## Priorisierte Fragen an Nakordoni

### P0

- Gilt die Truck-Route-Zugänglichkeit für jeden persönlichen Benutzerzugang?
- Welche OAuth-Grant-/PKCE-Variante, Scopes, Redirect-URIs, Tokenlaufzeiten,
  Refresh- und Revocation-Regeln gelten?
- Welches exakte `motorhome`-Schema, welche Parameter, Einheiten,
  Antwortfelder und Capability-Anzeige werden veröffentlicht?
- Wie werden wohnmobilspezifische Verbote und Mautregeln sowie unbekannte Fälle
  signalisiert?
- Wird schriftlich bestätigt, dass im Motorhome-Profil keine
  Lkw-Lenk-/Ruhezeiten angewendet werden?

### P1

- Sind 10/300 Routen Tageswerte je UTC-Tag oder nach anderer Zeitzone? Wie
  funktionieren Zusatzkontingente, 429, Reset und parallele Requests?
- Welche Bedingungen gelten für den eigenen öffentlichen OAuth-Client nach
  Übermittlung der GitHub-URL?
- Welche Länder, Märkte und Fahrzeugklassen sind pro persönlichem Zugang
  freigeschaltet?
- Welche Cache-, Attributions-, Aufbewahrungs- und Löschregeln gelten für
  Routen, Restriktionen und normalisierte Geometrien?

### P2

- Gibt es anonymisierte Fixtures oder eine Sandbox ohne reale GPS-Daten?
- Wie werden API-Versionen, Schemaänderungen und Deprecations angekündigt?

## Empfehlung

Als nächster Entwicklungsschritt wird **kein API-Code** empfohlen. Zuerst
soll die Repository-Grundlage separat freigegeben und anschließend Phase 2F
als Dokumentations-/Vertragsreview gestartet werden. Erst nach Nakordoni-
Antworten zu OAuth und Motorhome-Schema ist eine Entscheidung über Phase 2G
oder 2H sinnvoll.
