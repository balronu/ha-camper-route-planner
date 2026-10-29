# Troubleshooting / Fehlerbehebung

## Deutsch

### Gespeicherte Route lädt falsche Koordinaten

`v0.1.5` übernimmt Start, Ziel und Zwischenziele aus der gespeicherten Route.
Alte sichtbare Formularentwürfe dürfen diese Werte nicht überschreiben. Vor
der Neuberechnung die Koordinaten in der Karte prüfen. Enthält eine alte Route
keine gültigen Zielkoordinaten, werden keine Koordinaten erfunden; das Ziel
muss erneut ausgewählt werden.

### Fehler bei `depart_at` oder `arrive_at`

Die Zeitangaben sind optional. Eine leere Zeit wird nicht als `None` oder als
String `"None"` übertragen. Eine gespeicherte gültige Zeit bleibt erhalten.
Wenn der Provider für eine bestimmte Funktion einen Zeitpunkt verlangt, zeigt
die Karte den Backend-Fehler an und führt keine automatische Zeit ein.

### Ergebnis ist als veraltet markiert

Nach einem fehlgeschlagenen Berechnungsversuch bleibt ein vorheriges Ergebnis
nicht als neues Ergebnis sichtbar. Die Markierung **veraltet** bedeutet, dass
die letzte Berechnung fehlgeschlagen ist; nach einer erfolgreichen
Neuberechnung verschwindet sie.

### Entwicklerdiagnose

Die Entwicklerdiagnose ist standardmäßig ausgeblendet. In den
Karteneinstellungen kann sie nur ein Home-Assistant-Administrator aktivieren.
Sie gilt für genau einen Berechnungsversuch. **Diagnose kopieren** kopiert nur
den bereinigten JSON-Bericht. Nach dem Abruf werden die flüchtigen Daten
verworfen; es gibt keinen automatischen Versand. Wenn die Zwischenablage in
Browser oder App nicht verfügbar ist, kann der angebotene Text-Fallback
manuell markiert werden.

Native HA-Diagnostics enthalten keine Request-Koordinaten, Waypoints,
API-Schlüssel oder Authentifizierungsdaten.

### HACS findet die Stable nicht

Das Repository kann bis zur Aufnahme in den offiziellen HACS-Katalog als
**Custom repository** vom Typ Integration hinzugefügt werden. Der aktuelle
Katalog-PR ist in [hacs/default#12938](https://github.com/hacs/default/pull/12938)
offen und nicht als abgeschlossen zu behandeln. Für Stable `v0.1.5` in HACS
keine Pre-release-Auswahl aktivieren.

### Rollback

Vor einem Versionswechsel ein Home-Assistant-Backup erstellen. Für den
Rollback in HACS ausdrücklich Stable `v0.1.3` auswählen oder das unveränderte
`v0.1.3`-Release-Asset installieren. Gespeicherte Routen und Fahrzeugprofile
werden nicht automatisch migriert, gelöscht oder überschrieben.

## English

### Saved routes load incorrect coordinates

`v0.1.5` restores origin, destination, and waypoints from the saved route.
Old visible form drafts must not overwrite them. Check the coordinates before
recalculating. If an old route has no valid destination coordinates, the card
does not invent them; select the destination again.

### `depart_at` or `arrive_at` errors

Time values are optional. An empty value is omitted rather than sent as `None`
or the string `"None"`; a valid saved time is preserved. If a provider
requires a time for a specific operation, the card shows the backend error and
does not invent a departure time.

### Result marked stale

After a failed calculation, a previous result is not presented as a new one.
The **stale** marker means the latest calculation failed; it clears after a
successful recalculation.

### Developer diagnostics

Developer diagnostics are hidden by default and can only be enabled by a Home
Assistant administrator in the card settings. They apply to exactly one
calculation attempt. **Copy diagnostics** copies only the sanitized JSON report.
The volatile data is discarded after retrieval and is never sent automatically.
If the browser or app clipboard is unavailable, use the offered selectable
text fallback.

Native Home Assistant diagnostics contain no request coordinates, waypoints,
API keys, or authentication data.

### HACS cannot find the Stable release

Until the repository is accepted into the official HACS catalog, add it as a
**Custom repository** of type Integration. The current catalog PR is open at
[hacs/default#12938](https://github.com/hacs/default/pull/12938); do not claim
catalog inclusion yet. For Stable `v0.1.5`, do not enable pre-release
selection.

### Rollback

Create a Home Assistant backup before changing versions. In HACS explicitly
select Stable `v0.1.3` or install its unchanged release asset. Saved routes and
vehicle profiles are not automatically migrated, deleted, or overwritten.

