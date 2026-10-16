# Fahrzeugprofile

Persistente Profile enthalten ID, Anzeigename, Fahrzeugart, Höhe, Breite, Länge, zulässige Gesamtmasse, Achslast, Achsanzahl, Emissionsklasse und optional Gefahrgut. Alle Maße verwenden SI-Einheiten; die Providerübersetzung erfolgt erst im Adapter.

Das Referenzprofil wird als `vehicle_kind=motorhome` gespeichert. Bis Nakordoni
`vehicle_type=motorhome` tatsächlich verfügbar und vertraglich beschrieben ist,
darf es nicht als Nakordoni-Motorhome-Request ausgegeben werden. Ein Truck-
Mapping ist höchstens eine ausdrücklich sichtbare HGV-Näherung und kein
Motorhome-Fallback.

Das Modell bleibt providerneutral und versioniert. Providerfelder, deren Name,
Einheit oder Semantik noch nicht bestätigt ist, werden nicht als verbindliche
Felder implementiert. Für die spätere Erweiterung sind Capability-Status,
Schema-Version, tatsächliche Masse, Achslast, Achsen, Anhänger und Präferenzen
vorbereitet; bestehende `schema_version=1`-Profile müssen migrierbar bleiben.
Profile sind unabhängig und dürfen nicht durch GPS oder Providerantworten
verändert werden. Ungültige Werte werden vor jedem Provideraufruf abgelehnt.
