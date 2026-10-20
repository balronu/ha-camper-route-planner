# Nakordoni-Kontingente

Die lokale Datenstruktur normalisiert `GET /api/v2/account/usage` für die Quotenklassen `fuel`, `heavy` und `route`: Tarif, Limit, Verbrauch, Rest, Reset, Märkte, Trip-Pass-Status und vertrauenswürdige Upgrade-/Pass-Links.

Die geplante Abfrage ist höchstens alle 15 Minuten und niemals durch Dashboard-Rendering. Eine zusätzliche Aktualisierung darf nur nach einer ausdrücklichen Routenberechnung und innerhalb dieses Intervalls erfolgen. Die Usage-Abfrage soll laut Support kein Routingkontingent verbrauchen. Das dokumentierte Limit von 30 Anfragen pro Minute/Schlüssel bleibt ein Schutzlimit.

Momentaufnahme, nicht fest einprogrammieren: Explorer 10 Routen/Tag; Trip Pass 200 Routen/Tag, 3.000 Fuel-Abfragen/Tag, 4 Anfragen/Sekunde. Es gibt keine Kaufabwicklung in der Integration. Sensoren müssen pro Config Entry eindeutig erzeugt werden; feste globale Entity-IDs sind nicht zulässig.

