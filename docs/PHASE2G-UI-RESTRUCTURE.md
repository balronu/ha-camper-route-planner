# UI-Neustrukturierung vor v0.1.6 Stable

Die Lovelace-Karte trennt seit Beta.16 die Eingaben für eine bewusste
Routenberechnung von der Auswertung des aktuellen Ergebnisses:

- **Planungsblock:** Fahrzeugprofil, Stationen, Routenoptionen, optionale
  Providerdaten und lokale Kraftstoff-/Reichweitenwerte stehen vor den
  Berechnungsaktionen.
- **Ergebnisblock:** Karte, Exporte, lokale POI-Anzeige, Fuel-Plan-Ergebnis,
  Restriktionen, Grenzübergänge und Mautdetails stehen unterhalb der Aktion.

Die drei Provideroptionen (Parkplätze, Tankstellen, intelligente Tankplanung)
werden ausschließlich bei der nächsten ausdrücklichen Berechnung verwendet.
Lokale POI-Filter bleiben auf das aktuelle Ergebnis beschränkt und lösen keine
Provideranfrage aus. Wenn eine Kategorie nicht angefordert wurde, zeigt die
Karte einen verständlichen Hinweis statt Daten vorzutäuschen.

Bei lokalen Anzeigeänderungen wird der vorhandene Leaflet-Kartenknoten samt
Ansicht wiederverwendet. Ein Fit-to-Route bleibt auf tatsächliche
Routenwechsel oder eine ausdrückliche Fit-Aktion beschränkt.

Die Änderung ist rückwärtskompatibel zu gespeicherten Routen und verändert
weder Fahrzeugprofile noch gespeicherte Routendaten. Stable `v0.1.5` bleibt
unverändert; diese Dokumentation beschreibt Entwicklungsstand und Testumfang,
nicht eine Stable-Freigabe.
