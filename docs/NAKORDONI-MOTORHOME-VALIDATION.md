# Motorhome-Validierung und Verkehrsrestriktionen

## Fahrzeugprofil

Pflichtfelder: Länge, Breite, Höhe, zulässige Gesamtmasse und Achszahl. Das Referenzprofil ist 7,65 m × 2,34 m × 3,20 m, 4,8 t, zwei Achsen. Die vorhandene Modellvalidierung bleibt für Mock-Routing unverändert und wird für den neuen Provider zusätzlich explizit geprüft.

## Restriktionsmatrix

| Bereich | API-Ergebnis | technische Entscheidung | rechtliche Aussage |
|---|---|---|---|
| Höhe/Breite/Länge/Gewicht | wird aus Providerantwort übernommen | Warnung/Geometrie gemäß Response | keine Garantie |
| allgemeines Verbot über 3,5 t | als Providerhinweis speichern | Route nicht als sicher kennzeichnen | lokal prüfen |
| Lkw-Durchfahrtsverbot | als Restriktion speichern | nicht stillschweigend ignorieren | ungeklärt je Land |
| Wohnmobil bis 7,5 t | Provider-Beta kann abweichend behandeln | Beta-Hinweis anzeigen | Verkehrszeichen gelten |
| Schweiz, Tunnel, Passstraßen | gesonderter Vergleichstest erforderlich | keine pauschale Freigabe | offen |
| Umweltzone/Stadtzentrum | Provider- und Landesdaten können unvollständig sein | Warnung sichtbar machen | lokal prüfen |

Eine technische Route ist niemals ein Nachweis rechtlicher Zulässigkeit oder sicherer Wohnmobilnavigation.

## Geschwindigkeiten und Maut

Länderabhängige Geschwindigkeiten werden nicht lokal überschrieben. Maut wird nur angezeigt, wenn Felder tatsächlich geliefert werden. Fehlende Preise sind nicht 0 EUR; unvollständige oder geschätzte Daten werden entsprechend markiert.

