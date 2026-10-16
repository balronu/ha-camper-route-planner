# Kartenanbieter – lokaler Testbericht

Stand: 2026-10-16

## Ergebnis

| Prüfung | Ergebnis |
|---|---|
| Leaflet-Produktionsbuild | PASS |
| Frontend-Tests | PASS – 8/8 |
| Python-Tests gesamt | PASS – 21/21 |
| URL-Encoding und CARTO-Key-Status | PASS |
| Fehlender/ungültiger Key ohne Tile-URL | PASS |
| SVG-Fallback im Frontend | PASS – statisch geprüft |
| Kein direkter Browser-HTTP-Aufruf | PASS – statisch geprüft |
| Kein Nakordoni-Endpunkt im Frontend | PASS |
| Credential-Scan | PASS |
| Compileall | PASS |
| Live-CARTO-Test | NOT RUN – absichtlich, keine Live-Aufrufe |
| Home-Assistant-Hassfest/echte HA-Fixtures | BLOCKED – HA-Abhängigkeiten nicht installiert |
| Browser-E2E mit realen CARTO-Kacheln | NOT RUN – würde Live-Zugang erfordern |

## Ausgeführte Befehle

```text
cd frontend && npm run build && npm test
node --check frontend/dist/camper-route-planner-card.js
PYTHONPATH=src:. python3 -m unittest discover -s tests -v
python3 -m compileall -q custom_components src tests
```

Es wurden keine vorhandenen Schlüssel gelesen oder verwendet. Das
Schwesterprojekt `ha-camper-travel-journal` blieb unverändert.
