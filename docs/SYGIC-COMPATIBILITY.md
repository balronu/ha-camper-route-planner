# Sygic-Kompatibilität

Stand: 16.10.2026. Die Prüfung ist dokumentarisch; ein echtes Android-/iOS-
Gerät und kein Sygic-Konto wurden verwendet.

## Verifizierte offizielle Aussagen

### Sygic GPS Navigation

Die offizielle Anleitung [How to import GPX files in Sygic GPS Navigation](https://help.sygic.com/hc/en-us/articles/33408793536786-How-to-import-GPX-files-in-Sygic-GPS-Navigation) beschreibt den Import durch Download auf das Gerät, Öffnen über E-Mail oder Dateimanager und „Open with Sygic“. Sie verlangt eine Prüfung der importierten Route vor dem Start. Sygic weist ausdrücklich darauf hin, dass die Route nach dem Import anhand aktueller Kartendaten neu berechnet wird; daher kann die resultierende Strecke abweichen. Die offizielle Seite nennt außerdem Probleme bei Dateien, die ausschließlich nicht unterstützte Trackdaten enthalten.

Damit ist `rte/rtept` für den Navigationsübergang die konservativere Variante. Ein `trk/trkseg` wird zusätzlich angeboten, ist aber keine Garantie für eine navigierbare Route.

### Sygic Truck & Caravan Navigation

Sygic führt dieses Produkt separat. Der [offizielle User Guide](https://help.sygic.com/hc/en-us/articles/37948287320338-User-guide-for-Sygic-Truck-Caravan-Navigation) nennt Trucks, Caravans, Camper und RVs als Zielgruppe sowie Fahrzeugparameter wie Höhe, Breite, Länge und Gewicht. Die [offizielle Fahrzeugprofil-Dokumentation](https://help.sygic.com/hc/en-us/articles/39387446148626-Vehicle-profiles-in-Sygic-Truck-Caravan-Navigation) unterscheidet unter anderem Truck und Camper und bietet unterschiedliche Parameter je Fahrzeugtyp.

Für Truck & Caravan ist ein separater, offizieller GPX-Importablauf in dieser Prüfung **UNVERIFIED**. Die offizielle [Route-Sender-Dokumentation](https://help.sygic.com/hc/en-us/articles/16874688360978-Plan-a-route-on-your-computer-and-send-it-to-Sygic-Truck-Caravan-Navigation) belegt stattdessen einen Android-only-Route-Push über Browser-Erweiterung und aktivierte Route-Push-Einstellung; dieser Weg ist kein GPX-Download und wird nicht von Camper Route Planner automatisiert.

## Produkt-/Plattformmatrix

| Produkt / Plattform | GPX-Import | Importweg | Neuberechnung | Status |
|---|---|---|---|---|
| Sygic GPS Navigation / Android | dokumentiert | Datei/E-Mail → „Open with Sygic“ | ja | **VERIFIED dokumentarisch** |
| Sygic GPS Navigation / iOS | dokumentiert für das Produkt, nicht gerätetestet | Datei/E-Mail/Share-Dialog | ja | **PARTIAL / Gerätetest offen** |
| Sygic Truck & Caravan / Android | kein offizieller GPX-Ablauf in dieser Prüfung gefunden | Route Sender ist separat dokumentiert | ja, laut Route-Sender-Hinweis | **UNVERIFIED für GPX** |
| Sygic Truck & Caravan / iOS | kein offizieller GPX-Ablauf in dieser Prüfung gefunden | kein belastbarer Nachweis | offen | **UNVERIFIED** |

## Exportentscheidung

Camper Route Planner erzeugt Route (`<rte>`), Track (`<trk><trkseg>`) und eine kombinierte GPX-1.1-Datei. Die Karte bietet keinen Sygic-Deep-Link und keine automatische Weiterleitung. Die Datei wird nach explizitem Benutzerklick heruntergeladen oder, wenn der Browser dies unterstützt, über die systemeigene Share-Funktion angeboten.

## Noch notwendiger Gerätetest

Vor einer Beta-Freigabe müssen mindestens ein Android-Gerät mit Sygic GPS Navigation und ein Gerät mit Truck & Caravan geprüft werden. Zu dokumentieren sind App-Version, Lizenz/Produkt, Importweg, Erhalt von Start/Ziel/Zwischenzielen, sichtbare Neuberechnung und Differenz zwischen GPX-Geometrie und aktivierter Navigation. Für iOS ist zusätzlich der Share-/Datei-Workflow zu prüfen.
