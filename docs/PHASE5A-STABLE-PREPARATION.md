# Phase 5A – Stable-Vorbereitung

## Ausgangspunkt und Status

Diese Entwicklungsphase startet auf dem verifizierten Stable-Vorbereitungsstand
`v0.1.0-beta.19` / Commit `e06f45d228c1481e6049a447b2440dc91b6774d6`.
Es wurde keine Stable-Version veröffentlicht, kein Tag verschoben und keine
produktive Home-Assistant-Instanz verändert.

## Provider-Kompatibilität

- Sichtbar sind künftig nur `Mock (offline)` und `Nakordoni`.
- Der sichtbare Eintrag `Nakordoni` verwendet weiterhin intern
  `nakordoni_motorhome`; dadurch bleiben `vehicle_type=motorhome`, Maße,
  Gewicht, Achsen, HA-aiohttp-Transport, Bearer-Key und das Verhalten ohne
  Mock-Fallback unverändert.
- Die gespeicherte ID `nakordoni_motorhome` wird nicht migriert.
- Der alte gespeicherte Wert `nakordoni` bleibt der deaktivierte generische
  Adapter. Er wird nicht stillschweigend auf den Motorhome-Provider abgebildet;
  die vorhandenen Zugangsdaten bleiben unangetastet.
- Es wird bei der Provider-/Options-Migration kein Live-Request ausgeführt.

## Fahrzeugverwaltung

Die erste Options-Seite enthält die Auswahl `Keine Änderungen an Fahrzeugen`
als Standard. Dieser Pfad speichert ausschließlich Provider-/Karten-/Key-
Änderungen und lädt keine Profilseite. Er legt kein Fahrzeug an, überschreibt
keine Felder und setzt keine Tracker-Zuordnung zurück.

`Vorhandenes Fahrzeug bearbeiten` und `Neues Fahrzeug hinzufügen` bleiben
explizite Aktionen. Beim Bearbeiten bleibt die Profil-ID stabil; beim Anlegen
werden vorhandene Profile einschließlich Zoe nicht verändert. Die bisherige
zweite Auswahlseite enthält ebenfalls `Keine Änderungen an Fahrzeugen`.

## HACS-Versionsprüfung

Nachweisbar im Repository:

- `manifest.json` enthält eine semantische Version (`0.1.0-beta.19`).
- `hacs.json` ist auf die Integration im Repository-Root (`content_in_root:
  false`) und Home Assistant `2026.10.0` eingestellt.
- Der Beta-Tag `v0.1.0-beta.19` und der GitHub-Pre-Release existieren.

Damit ist die Repository-Seite für die Stable-Erkennung vorbereitet. Die
beobachtete HACS-Anzeige eines Commit-Hashs kann mit dem lokalen Repository
allein jedoch nicht kausal bewiesen werden: Dafür muss die Installation den
GitHub-Release-Kanal tatsächlich verwenden und HACS muss nach der Stable-
Veröffentlichung neu einlesen. Ein Branch-/Commit-Installationsweg ist eine
plausible Erklärung, aber kein belegter Befund. Diese Phase führt daher keine
HACS-interne Änderung und keine Installation in VM 104 durch.

## Offene Stable-Gates

- Vollständige Offline- und HA-Fixture-Suite auf dem Kandidaten.
- Frontend-Build und Chromium-Regression für die umbenannte sichtbare
  Provider-Beschriftung.
- PR-, Main- und Tag-CI auf dem späteren exakten Stable-Commit.
- Erst danach: separat autorisierte Stable-Veröffentlichung und unabhängige
  HACS-Erkennungskontrolle.
