# Entwicklungsplan Phase 2F bis 2I

**Stand:** 16.10.2026
**Projektstatus:** Nur Planung und Dokumentation; keine neue Routing-Implementierung, kein Live-API-Aufruf, kein produktives HA-Wiring.
**Release-Ziel:** `v0.1.0 Stable` ist die erste geplante Veröffentlichung; bis dahin bleibt der aktuelle Offline-/Mock-Stand die einzige nutzbare Variante.

## Verbindliche Leitplanken aus Nakordoni-Ticket #230

- `GET /api/v2/data/truck-route` ist mit dem vorhandenen API-Schlüssel laut Support bereits zugänglich. Das ist eine Support-Aussage, kein von diesem Projekt ausgeführter Probeaufruf.
- Truck-Routing hat ein eigenes Tageskontingent: Explorer 10, Starter 300 Routen/Tag. Zusatzkontingente sind möglich. Zähler, Zeitzone, Overuse-Verhalten und genaue Add-on-Bedingungen müssen im Accountvertrag bestätigt werden.
- `vehicle_type=motorhome` ist noch nicht verfügbar. Eine erste Beta wurde unverbindlich für etwa den **26.10.2026** prognostiziert.
- Das geplante Motorhome-Profil soll Abmessungen, Gewichtsbeschränkungen, wohnmobilspezifische Fahrverbote und Mautregeln berücksichtigen; Lkw-Lenk- und Ruhezeiten sollen nicht gelten.
- Bis zur tatsächlichen Freigabe darf Truck-Routing nicht als sichere Wohnmobilnavigation erscheinen.
- Nakordoni möchte nach Übermittlung der öffentlichen GitHub-Repository-URL einen eigenen OAuth-Client für das Projekt registrieren.
- Der OAuth-Client von Mobile Fuel Stations wird nicht übernommen. Jeder Benutzer verwendet seinen eigenen Nakordoni-Zugang und sein eigenes Routing-Kontingent.

Diese Angaben stammen aus dem Support-Ticket #230 und ersetzen ältere,
nicht kontospezifische Annahmen im API-Audit. Sie sind kein Nachweis eines
aus diesem Arbeitsverzeichnis ausgeführten Requests.

## Saubere Routing-Trennung

| Modus | Datenquelle/Vertrag | Sichtbare Aussage | Freigabezustand |
|---|---|---|---|
| **Demo** | deterministischer Mock/Fixture, `synthetic=true` | Beispielroute, keine reale Verkehr-, Maut- oder Restriktionsaussage | bereits offline möglich |
| **Truck** | Nakordoni `truck-route`, technisch verfügbar laut Ticket | Truck-/HGV-Routenhinweise; keine Wohnmobilgarantie | erst nach separat autorisiertem Implementierungs- und Vertragsgate |
| **Motorhome** | Nakordoni `vehicle_type=motorhome`, derzeit nicht verfügbar | erst nach bestätigter Beta/API-Freigabe als Wohnmobilprofil | blockiert bis echte Verfügbarkeit und Vertrag vorliegen |

Demo-Ergebnisse dürfen nie als Providerergebnis erscheinen. Truck-Ergebnisse erhalten einen sichtbaren Modus, Providerstatus und Unsicherheits-/Hinweistext. Motorhome darf erst aktiviert werden, wenn die API, Parameter, Antwortsemantik und rechtliche Produktdarstellung schriftlich bestätigt sind. Ein Fallback von Motorhome auf Truck ist nicht stillschweigend zulässig; er muss, falls später überhaupt erlaubt, explizit als HGV-Näherung bestätigt werden.

## Phasen

### Phase 2F – Vertrags- und Sicherheitsgrundlage

**Ziel:** Die vorhandene Architektur auf getrennte Demo-/Truck-/Motorhome-Verträge vorbereiten, ohne Live-Routing zu aktivieren.

- Provider-Modi und Capability-/Statusmodell als Dokumentationsvertrag festschreiben.
- Eigenen Camper-Route-Planner-Credential-Slot und eigenen OAuth2-Status definieren; keine Abhängigkeit von Mobile Fuel Stations.
- Benutzer-, Konto- und Quota-Grenze dokumentieren: pro Config Entry eigener Zugang, eigener Tageszähler und eigene Fehleranzeige.
- API-Fehler, Quota-Header/Usage, Retry-Regeln, Cache-TTL und Löschung als redigierten Vertrag festlegen.
- Testspezifikation für Secret-Redaction, Demo-Kennzeichnung, Modus-Trennung und „kein impliziter Truck-Fallback“ ergänzen.

**Gate:** Nakordoni-Client/Scopes/Redirect-URIs, OAuth-Flow, Datenschutz,
Kontingentverhalten und Repository-URL sind bestätigt. Ohne dieses Gate keine
kontingentverbrauchenden Requests. Die Registrierung des OAuth-Clients ist
eine externe Abhängigkeit und wird nicht durch dieses Projekt selbst
vorgenommen.

### Phase 2G – Kontrollierter Truck-Adapter

**Ziel:** Nur den dokumentierten Truck-Vertrag als ausdrücklich manuelle, feature-gated Funktion vorbereiten.

- `GET /api/v2/data/truck-route` mit eigener Auth-/Fehlergrenze und eigener Quota-Guard-Schicht; der Supportzugang ist nur als externe Aussage dokumentiert.
- Antwortnormalisierung nur für bestätigte Felder; unbekannte Restriktionen bleiben `unknown`.
- UI-/Exportkennzeichnung „Truck/HGV – nicht als sichere Wohnmobilnavigation“.
- Kein Start durch GPS, HA-Start, Kartenöffnung, Reload oder Sensorupdate.
- Synthetische Offline-Fixtures und ein separat freigegebener, einmaliger Probeplan; keine Produktiv-GPS-Daten in Tests.

**Gate:** CI/Hassfest, Secret-Scan, redigierte Vertrags-Fixtures, Quota- und Fehlerfälle, Datenschutz-Review sowie schriftliche Freigabe des externen Tests. Truck bleibt bis dahin deaktiviert.

### Phase 2H – Motorhome-Vertragsvorbereitung

**Ziel:** Das Datenmodell für das kommende `motorhome`-Profil vorbereiten, ohne unbestätigte API-Parameter zu implementieren.

- Providerneutrale Felder für Höhe, Breite, Länge, zulässige/aktuelle Masse, Achslast, Achsen, Anhänger, Emissions-/Antriebsdaten und lokale Präferenzen beibehalten bzw. versioniert erweitern.
- Eine explizite Capability `motorhome_routing_available` und einen Provider-/Schema-Versionsstatus vorsehen.
- Nakordoni-spezifische Felder erst nach bestätigter Referenz dokumentieren; keine erfundenen Namen, Wertebereiche oder Maut-/Verbotsparameter als verbindlich festlegen.
- Lenk-/Ruhezeiten im Motorhome-Modus nicht anzeigen oder berechnen. Truck-Ruheplanung bleibt eine getrennte, nicht übertragbare Information.
- Migration/Abwärtskompatibilität für bestehende `schema_version=1`-Profile planen.

**Gate:** Nakordoni-Beta tatsächlich verfügbar, vollständiges Schema/Beispielantwort, Parameter- und Einheitenvertrag, Maut-/Verbotssemantik und Testfreigabe liegen vor. Die Prognose 26.10.2026 ist kein Release-Gate.

### Phase 2I – Stable-Vorbereitung `v0.1.0`

**Ziel:** Eine konservative erste Veröffentlichung mit klarer Produktgrenze.

- Stable kann als Offline/Demo-Release erfolgen, wenn die technischen HA-/HACS-Gates erfüllt sind.
- Truck-Routing wird nur aufgenommen, wenn die Phase-2G-Gates vollständig erfüllt sind; andernfalls bleibt es deaktiviert bzw. dokumentiert.
- Motorhome-Routing wird nur aufgenommen, wenn Phase 2H bestätigt ist; kein Versprechen aufgrund einer Beta-Prognose.
- Deutsch bleibt Hauptsprache; englische Kurzfassung, Status- und Warntexte ergänzen die Dokumentation.
- Release-Checkliste: Moduskennzeichnung, OAuth-Hinweise, Quota-/Fehlertexte, Datenschutz, Cache-/Löschung, CI/Hassfest/HACS und nachvollziehbare Rollback-/Deaktivierungsoption.

**Stable-Freigabe:** Kein Stable-Tag, Merge oder Release ist Bestandteil dieses Planungsauftrags.

## OAuth2- und Kontingentmodell

Der spätere OAuth-Client gehört ausschließlich zu Camper Route Planner und soll
von Nakordoni nach Übermittlung der öffentlichen Repository-URL registriert
werden. Der Client von Mobile Fuel Stations darf weder übernommen noch aus
dessen Config Entry, Storage oder Laufzeit importiert werden. Ein Benutzer
authentifiziert sich mit seinem eigenen Nakordoni-Konto; die Integration darf
kein gemeinsames Projektkonto oder gemeinsames globales Kontingent
voraussetzen.

Vorgesehene Statuswerte: `not_configured`, `authorization_pending`, `authorized`, `expired`, `revoked`, `quota_exhausted`, `provider_unavailable`. Ein gespeicherter Zugang ist nicht gleichbedeutend mit erfolgreicher Routing-Freigabe. Tokens gehören ausschließlich in den HA-Credential-Speicher; Logs, Diagnosen, GPX und Rohantworten werden redigiert.

Für die Planung werden Explorer mit 10 und Starter mit 300 Truck-Routen pro
Tag angesetzt; Zusatzkontingente sind möglich. Diese Werte werden erst nach
Bestätigung von Zählerdefinition, Reset-Zeitzone, Parallelität, 429-Verhalten
und Add-on-Regeln als verbindlicher UI-/Guard-Vertrag verwendet. Quota wird
pro Benutzer/Config Entry und pro Routing-Produkt geführt. Vor jedem manuellen
Aufruf: lokale Guard-Prüfung, dann Provideraufruf, danach Auswertung von
HTTP-Status, `usage` und Quota-Headern. Bei 429 keine automatische
Wiederholung; bei unbekanntem Reset-Zeitpunkt bleibt der Zustand konservativ.
Cache-Hits dürfen nicht als neue Route gezählt werden, aber die genaue
Provider-/Accountdefinition ist zu bestätigen.

## Offene Fragen an Nakordoni, priorisiert

1. **P0:** Welche OAuth2-Grant-/PKCE-Variante, Scopes, Redirect-URIs, Tokenlaufzeiten, Refresh-/Revocation-Regeln und Client-Registrierungsanforderungen gelten für das öffentliche Home-Assistant-Projekt?
2. **P0:** Welche API-Version, Parameter und Response-Felder sind für `vehicle_type=motorhome` vorgesehen? Ist der 26.10.2026-Termin nur eine interne Prognose oder gibt es ein Beta-Programm mit Bedingungen?
3. **P0:** Welche wohnmobilspezifischen Fahrverbote und Mautregeln werden tatsächlich modelliert, und wie werden unbekannte Länder-/Straßenfälle markiert?
4. **P0:** Bestätigt Nakordoni ausdrücklich, dass Lkw-Lenk- und Ruhezeiten im Motorhome-Profil nicht angewendet werden? Gibt es dafür ein Antwort-/Capability-Feld?
5. **P0:** Gilt die Ticket-Aussage zur Zugänglichkeit von `truck-route` für jeden Benutzerzugang nach Anmeldung oder nur für einen bestimmten Account/Testzugang? Welche Länder/Märkte und Fahrzeugklassen sind freigeschaltet?
6. **P1:** Sind Explorer 10 und Starter 300 Routen pro Tag verbindlich? Welche Zeitzone, welche Zusatzkontingente, 429-/Reset-Semantik, Parallelitätsgrenzen und Überschreitungsfolgen gelten?
7. **P1:** Wie werden OAuth-Client, Benutzerkonto und Routing-Kontingent einer öffentlichen HA-Installation organisatorisch getrennt?
8. **P1:** Welche Cache-/Speicher-/Attributionsbedingungen gelten für normalisierte Geometrien, Maut-/Verbotsdaten und Fehlerantworten?
9. **P1:** Welche API- und Datenänderungsankündigung, Versionierung und Deprecation-Frist gilt für Truck- und Motorhome-Routing?
10. **P1:** Welche Bedingungen gelten für die Registrierung des öffentlichen OAuth-Clients nach Übermittlung der Repository-URL, und welche Redirect-URI-/Review-Anforderungen gibt es?
11. **P2:** Welche anonymisierten Fixtures oder Sandbox-Möglichkeiten stehen für reproduzierbare Tests ohne reale GPS-Daten zur Verfügung?

## English summary

Phase 2F–2I remains documentation-only. Demo, Truck and Motorhome routing are separate modes. Truck routing is not safe motorhome navigation; the Nakordoni `motorhome` type is not available yet. OAuth must use a dedicated Camper Route Planner client, never the Mobile Fuel Stations client. Each user supplies their own Nakordoni account and routing quota. `v0.1.0 Stable` is the first planned release, but no merge, tag or release is authorized by this plan.
