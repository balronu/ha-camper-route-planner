# Kontrollierte Motorhome-Live-Testmatrix (noch nicht ausgeführt)

Alle Fälle verwenden das Referenzfahrzeug 7,65 m × 2,34 m × 3,20 m, 4,8 t, zwei Achsen, `vehicle_type=motorhome`. Koordinaten sind reproduzierbare Stadt-/Streckenreferenzen und vor dem Test gegen die offizielle Vergleichsquelle zu verifizieren.

| Fall | Start → Ziel | Koordinaten (lat,lon) | Zweck | Budget |
|---|---|---|---|---:|
| 1 | München → Verona | 48.1374,11.5755 → 45.4384,10.9916 | Basisroute/Länderwechsel/Maut | 1 |
| 2 | Saarbrücken → Basel | 49.2402,6.9969 → 47.5596,7.5886 | DE–FR/CH und Maut | 1 |
| 3 | Basel → Luzern | 47.5596,7.5886 → 47.0502,8.3093 | Schweiz, Gewicht/Autobahn | 1 |
| 4 | Luzern → Bellinzona | 47.0502,8.3093 → 46.1950,9.0230 | Tunnel/Pass/Schweiz | 1 |
| 5 | bekannte niedrige Brücke | vorab dokumentierte Koordinaten mit Höhenbeschränkung | Höhenfilter und Restriktionshit | 1 |
| 6 | allgemeine 3,5-t-Beschränkung | vorab verifizierte Straße | Gewichtskategorie | 1 |
| 7 | Lkw-spezifisches Durchfahrtsverbot | vorab verifizierte Straße | `applies`/Warnung, keine Rechtsgarantie | 1 |
| 8 | mehrere Mautsysteme | DE–AT–IT oder DE–CH–IT | vollständige/unvollständige Maut | 1 |

**Budget:** acht geplante Aufrufe, zwei Reserveaufrufe, maximal zehn Explorer-Routen pro Tag. Keine Wiederholungen ohne dokumentierten Grund. Ein API-Erfolg ist kein Nachweis rechtlicher Zulässigkeit.

Für jeden Lauf werden Request ohne Secret, Response-Hash, Providerwarnungen, `vehicle`, `route.country_split`, `restriction_hits`, `truck_bans`, Mautdaten, Vergleichsquelle und Abweichungen archiviert. Die Ergebnisse werden nicht als Navigationsgarantie veröffentlicht.

