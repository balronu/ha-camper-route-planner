# Phase 2I – Live-Testplan (noch nicht freigegeben)

Dieses Dokument ist eine Vorbereitung. In Phase 2I wurden **keine** echten
Nakordoni-Anfragen ausgeführt.

## Startbedingungen

1. Persönlichen Nakordoni-Key in einer geschützten Umgebung bereitstellen:
   `NAKORDONI_API_KEY` oder `NAKORDONI_API_KEY_FILE`.
2. Vor jedem Lauf die gesonderte Freigabe des Projektverantwortlichen einholen.
3. Das Werkzeug startet standardmäßig im Dry-Run. Netzwerkzugriff erfordert
   sowohl `--live` als auch `--confirm-live`.
4. Maximal acht Routingabfragen pro Testtag; zwei bleiben als Reserve.
5. Keine automatischen Wiederholungen, insbesondere nicht bei HTTP 429.

Start im Dry-Run:

```bash
PYTHONPATH=. python3 tools/nakordoni_live_test.py
```

Ein Live-Aufruf ist bis zur Freigabe absichtlich nicht auszuführen:

```bash
NAKORDONI_API_KEY_FILE=/geschuetzter/pfad/key \
  PYTHONPATH=. python3 tools/nakordoni_live_test.py --case 1 --live --confirm-live
```

## Testmatrix

| Nr. | Strecke/Fall | Status | Akzeptanzkriterium |
|---:|---|---|---|
| 1 | München → Verona | vorbereitet | 200/valide Route, Motorhome-Profil sichtbar, Mautstatus korrekt |
| 2 | Saarbrücken → Basel | vorbereitet | Länder-/Mautabdeckung und Warnungen nachvollziehbar |
| 3 | Basel → Luzern | vorbereitet | Schweizer Restriktionen nicht als Rechtsfreigabe darstellen |
| 4 | Luzern → Bellinzona | vorbereitet | Alpen-/Tunnelhinweise und Mautstatus sichtbar |
| 5 | konkrete niedrige Brücke | **PENDING** | erst nach verifizierter Straße und amtlicher Vergleichsquelle |
| 6 | konkrete allgemeine 3,5-t-Beschränkung | **PENDING** | erst nach verifiziertem Straßenabschnitt |
| 7 | konkretes Lkw-Durchfahrtsverbot | **PENDING** | erst nach verifiziertem Straßenabschnitt |
| 8 | länderübergreifende Mautstrecke | vorbereitet | `priced/status/complete/estimate/coverage_note` korrekt |

Für die Fälle 5–7 werden keine Koordinaten erfunden. Ein API-Ergebnis ist
niemals allein eine rechtliche Freigabe.

## Redigiertes Ergebnisformat

Das Werkzeug schreibt nur Fallnummer, Parameter ohne Key, Status, HTTP-Code
und die Felder Distanz/Dauer/Maut. Authorization-Header und vollständige
Providerantworten werden nicht ausgegeben oder gespeichert.
