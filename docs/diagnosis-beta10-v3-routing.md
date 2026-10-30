# Beta.10 v3-Routingdiagnose

Stand: 2026-10-30

## Befund

Die produktive Fehlermeldung `Invalid or incomplete NaKordoni v3 response`
ist mit den vorhandenen VM-104-Daten nicht auf eine konkrete Providerantwort
zurückzuführen. Die Integration ist geladen, meldet Version `0.1.6-beta.10`
und verwendet `nakordoni_motorhome_v3`. Die Read-only-Diagnose zählt sechs
v3-Route-Aufrufe; die dauerhafte HA-Diagnostik enthält jedoch keinen letzten
Fehler und keine Antwortdaten. Die System- und Error-Logs enthalten im
verfügbaren Fenster keinen passenden Eintrag. Es liegen daher keine
nachweisbaren HTTP-Statuscodes, Content-Types, Antwortdauern oder Request-IDs
für die beiden praktischen Fehlversuche vor.

Die Ursache bleibt **unbestätigt**. Insbesondere ist nicht nachgewiesen, ob
NaKordoni eine fehlerhafte Antwort, eine gültige Fehlerantwort, eine gültige
Route oder eine unvollständige/abgebrochene Transportantwort geliefert hat.

## Codevergleich

Der gemeinsame v3-Parser ist zwischen `v0.1.6-beta.8` und `v0.1.6-beta.10`
unverändert. Beta.10 ergänzt lediglich POI-Parameter im Request, die
POI-Optionen in `request_options` und die optionale POI-Normalisierung. Die
Pflichtprüfung für `api_version`, `data.vehicle`, Fahrzeugwerte, `legal`,
`restriction_hits`, Geometrie, `distance_m` und `duration_s` stammt bereits
aus Beta.8.

Die offizielle NaKordoni-v3-Dokumentation beschreibt diese Routendaten als
Teil des Vertrags. Eine Lockerung der Sicherheitsprüfung wäre deshalb ohne
eine echte Antwortaufzeichnung nicht vertretbar.

## Regressionen

Die v3-Testabdeckung enthält nun für eine gültige Route alle vier
POI-Anfragekombinationen:

1. keine POIs,
2. nur Parkplätze,
3. nur Diesel-Tankstellen,
4. Parkplätze und Diesel-Tankstellen.

Zusätzlich werden leere sowie vollständig fehlende optionale POI-Listen
akzeptiert, ohne eine gültige Route zu verwerfen. Die Tests verwenden nur
kontrollierte Fixtures und keine echten Provideraufrufe.

## Offene Diagnosegrenze

Für eine belastbare Beta.11-Entscheidung muss bei einem ausdrücklich
freigegebenen nächsten Praxistest vor der einen Routenberechnung die
flüchtige One-shot-Entwicklerdiagnose bewaffnet werden. Danach sind nur
sanitisierte Felder auszulesen: Endpoint/API-Version, POI-Parameter,
HTTP-Status, Content-Type, Antworttyp/-länge, Dauer, Retry-Anzahl,
`X-Route-Source`, Request-ID, Fehlercode und Restriktionsstatus. Die komplette
Providerantwort und Zugangsdaten dürfen nicht gespeichert werden.

Bis dieser Nachweis vorliegt, wird kein spekulativer Parser-Fix, kein PR,
kein Beta.11-Tag und kein Release erstellt.
