# Phase 1 – Machbarkeit

## Kurzurteil

**CONDITIONAL GO** für eine isolierte, provideragnostische Architektur. **Kein GO** für die Aussage „wohnmobilrechtlich korrekt geroutet“ durch Nakordoni allein.

### Fakten

- Nakordoni bietet `GET https://nakordoni.eu/api/v2/data/truck-route` als Truck-Route-Produkt an.
- Der dokumentierte Adapter kann Höhe, Breite, Länge, Gewicht, Achslast, Achsen, Anhänger, ADR und Emissionsklasse verarbeiten.
- Die API liefert Geometrie, Restriktionen, datierte Lkw-Fahrverbote, Verkehr, Grenzwarten, Truck-Mautschätzungen, Tankstellen, Parkplätze und Ruheplan.
- Es gibt keinen dokumentierten `motorhome`-Fahrzeugtyp und keine dokumentierte Garantie, dass Lkw-Regeln für privat genutzte Wohnmobile rechtlich passend sind.
- Sygic unterstützt offiziellen GPX-Import, berechnet die Strecke aber nach aktuellem Kartenstand neu.

### Konsequenzen

Im UI werden Providerdaten als **HGV-/Truck-Ergebnis** und nicht als rechtsverbindliche Wohnmobilfreigabe bezeichnet. Lkw-Ruhezeiten und Lkw-Maut werden standardmäßig ausgeblendet oder mit einem unübersehbaren „Truck-only / nicht Wohnmobilkosten“-Label versehen. Eine automatische Berechnung wird nur durch eine explizite Benutzeraktion ausgelöst.
