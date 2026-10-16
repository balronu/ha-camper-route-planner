# Browser-E2E Phase 2C

## Ergebnis

Chromium-E2E: **PASS** mit dem lokalen System-Chromium `/usr/bin/chromium`.

Geprüft wurden:

- Rendering ohne automatische Berechnung
- expliziter Berechnungsklick
- GPX-Route-Export nach explizitem Benutzerklick
- keine zusätzliche Routing-Anfrage beim Export
- erfolgreiche CARTO-Tile-Mock-Antwort
- HTTP 403 und HTTP 429
- kontrollierter Tile-Timeout/Abort
- SVG-Fallback in allen Fehlerfällen
- Desktop 1280×900
- Tablet 768×1024 mit Dark-Mode-Media-Emulation
- Mobil 390×844
- eine Spalte mobil, zwei Spalten Tablet
- keine direkte Routing-Anfrage aus dem Browser

Ausführung:

```text
cd frontend
npm run build
npm run test:e2e
browser e2e: PASS (Chromium; export; success/403/429/timeout fallback; desktop/mobile screenshots)
```

Screenshots:

- [Desktop](phase2c-desktop.png)
- [Mobil](phase2c-mobile.png)

WebKit wurde lokal heruntergeladen, ist aber wegen fehlender Host-Bibliotheken
(unter anderem GTK/GStreamer) **BLOCKED** und wurde nicht als bestanden
gewertet. Es gab keine Live-CARTO-Anfragen; alle Tile-Antworten stammen aus
kontrollierten Playwright-Routen.
