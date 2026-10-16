# GPX und Sygic

Sygic dokumentiert am 24.09.2026: GPX-Datei herunterladen, über Mail/Dateimanager „Open with Sygic“, Route prüfen und erst danach Navigation starten. Sygic warnt, dass nach Import anhand aktueller Kartendaten neu berechnet wird; reine Track-Dateien können inkompatibel sein. Quelle: [Sygic GPX-Import](https://help.sygic.com/hc/en-us/articles/33408793536786-How-to-import-GPX-files-in-Sygic-GPS-Navigation).

## Prototypentscheidung

Der Offline-Exporter schreibt sowohl `rte/rtept` als auch `trk/trkseg` mit synthetischen Punkten. Das maximiert Importchancen, garantiert aber keine Streckentreue. GPX-Route/Waypoints sind für Import wichtiger als ein alleiniger Track; ein Deep Link ist nicht als offiziell dokumentiert belegt und bleibt offen.

## Nicht getestet

Kein iOS-Gerät, keine Dateifreigabe, kein Sygic-Import, kein Deep Link und kein produktiver Navigationsstart wurde getestet. Eine spätere Geräteprüfung muss insbesondere Neuberechnung, Zwischenzielerhalt, Profil-/Höhenoptionen und sichtbare Differenzen dokumentieren.
