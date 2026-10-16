# Testplan

| Test | Status |
|---|---|
| Zwei unabhängige Fahrzeugprofile | PASS offline |
| Ungültige Maße/Koordinaten | PASS offline |
| Timeout | PASS mit begrenztem Mock-Wait, kein Live-Aufruf |
| 401/403/429/5xx | PASS als normalisierte Mock-Fehler, kein Live-Aufruf |
| Fehlende Antwortfelder | PASS als `invalid_response` |
| Ungültige Geometrie | PASS über Modellvalidierung |
| Wiederholte identische Anfrage | PASS: deterministischer Mock; echter Cache noch nicht implementiert |
| Nur manuelle Auslösung | DESIGN PASS: kein Listener/HA-Code vorhanden |
| GPX XML | PASS offline |
| Optionale Integrationen fehlen | DESIGN PASS: Verträge bleiben deaktiviert |
| Secrets | PASS: Test prüft kein Bearer im GPX; Repository-Scan erforderlich |

Bewusst nicht ausgeführt: HA-Installation, Hassfest, HA-Test-Fixture, echte API, Sygic-Gerätetest, Kartenvisualisierung, kostenpflichtiger Aufruf.
