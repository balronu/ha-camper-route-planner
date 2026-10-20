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

## Schweiz – getrennte rechtliche Bewertung

Für ein Wohnmobil mit 4,8 t dürfen API-Routing und Rechtsbewertung nicht
gleichgesetzt werden. Die amtliche [Schwerverkehrsabgabeverordnung
(SVAV)](https://www.fedlex.admin.ch/eli/cc/2024/150/de) führt Wohnmotorwagen
über 3,5 t als abgabepflichtige Fahrzeugart auf. Das ASTRA beschreibt außerdem
ein generelles Sonntags- und Nachtfahrverbot für Fahrzeuge über 3,5 t und
verweist auf Ausnahmen und Bewilligungen ([Sonderbewilligungen](https://www.astra.admin.ch/de/sonderbewilligungen)).

Das Signal „Verbot für Lastwagen“ ist nicht automatisch identisch mit einem
Verbot für jedes Wohnmobil. Die [amtliche Ordnungsbussenverordnung](https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1996/1078_1078_1078/20170507/de/pdf-a/fedlex-data-admin-ch-eli-cc-1996-1078_1078_1078-20170507-de-pdf-a.pdf)
führt das Lastwagenverbot als eigenes Signal. Ein Nakordoni-Hinweis wird daher
als technische Warnung dargestellt; Verkehrszeichen, Fahrzeugausweis,
Ausnahmen, Tageszeit und kantonale Vorgaben bleiben maßgeblich.

Die [ASTRA-Information zu Verkehrsregeln 2026](https://www.astra.admin.ch/de/verkehrsregeln-2026)
ist für aktuelle Geschwindigkeits- und Gewichtsfragen zu prüfen. Eine
Schweizer Maut-/Abgabenanzeige im Providerergebnis ist keine Bestätigung, dass
alle Gebühren- oder Bewilligungspflichten erfüllt sind.

## Geschwindigkeiten und Maut

Länderabhängige Geschwindigkeiten werden nicht lokal überschrieben. Maut wird nur angezeigt, wenn Felder tatsächlich geliefert werden. Fehlende Preise sind nicht 0 EUR; unvollständige oder geschätzte Daten werden entsprechend markiert.
