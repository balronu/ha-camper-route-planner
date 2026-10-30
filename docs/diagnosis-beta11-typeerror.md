# Beta.11 NaKordoni-v3-TypeError

Stand: 2026-10-30

## Gesicherte Fakten

Der Praxisbericht zeigt eine HTTP-200-JSON-Antwort mit vorhandenen bekannten
Pflichtfeldern und `parser_exception: TypeError`. `missing_fields` und
`invalid_fields` sind leer. Damit ist eine unvollständige Top-Level-Route nicht
nachgewiesen; die bisherige Diagnose enthielt jedoch noch keine innere
GeoJSON-Form und keine Parser-Codeposition.

## Lokale Reproduktion

Die bestehende v3-Normalisierung akzeptiert eine gültige GeoJSON-LineString-
Antwort mit `coordinates: [[longitude, latitude], ...]` einschließlich
Distanz, Dauer, Fahrzeugbestätigung, `legal` und `restriction_hits`.

Ein kontrolliertes Fixture mit `geometry` als Objekt, aber nicht iterierbaren
oder falsch verschachtelten `coordinates`, erzeugt den gleichen `TypeError` in
`_geometry`. Das ist ein reproduzierbarer Kandidat, aber noch kein Beweis,
dass die produktive 844737-Byte-Antwort genau diese Form enthielt.

## Lokaler Diagnose-Patch

Auf dem lokalen Branch `diagnose/beta12-typeerror` ergänzt die One-shot-
Diagnose ausschließlich:

- GeoJSON-Schlüssel, `coordinates`-Typ und Länge,
- Typ der ersten Koordinate und ihrer Elemente beziehungsweise sichere
  Schlüssel eines Objektpunkts,
- Exception-Typ und kurze, bereinigte Exception-Nachricht,
- Datei, Funktion und Zeilennummer des letzten Parser-Frames.

Es werden keine Responsewerte, vollständige Providerantworten, Koordinaten,
API-Keys oder Authentifizierungsheader gespeichert. Die eigentliche
Validierung bleibt unverändert.

## Entscheidung

Ein Beta.12-Routingfix ist noch nicht gerechtfertigt. Für den Nachweis ist
ein einmaliger späterer Diagnosebericht mit `geometry_shape` und
`parser_exception.location` erforderlich. Erst wenn dieser `_geometry` als
echte Fehlerstelle bestätigt und die konkrete Unterstruktur bestimmt, darf ein
minimaler Fix implementiert und als Beta.12 geprüft werden.
