# Phase 2V – Kartenkatalog-Ladekreis und gezielter lokaler Fix

## Befund

Die drei Fehler sind unabhängig:

1. **`Custom element not found` / Ladekreis**: Beta.7 registrierte das
   Custom Element selbst korrekt, verletzte aber den HA-Katalogvertrag: Der
   `window.customCards`-Eintrag verwendete `type: "custom:camper-route-planner-card"`
   statt des Tag-Namens ohne Präfix, und `getStubConfig()` gab ebenfalls ein
   `type`-Feld zurück. HA erwartet den Präfix nur in der späteren Card-Konfigura-
   tion (`custom:...`), nicht in Katalogmetadaten oder Stub-Konfiguration.
   Das ist die nachgewiesene Vertragsverletzung und die stärkste Erklärung
   für den Ladekreis. Die Kausalität wurde mangels produktivem HA-Katalogtest
   nicht direkt auf VM 104 beobachtet.

2. **`_leaflet_pos` in `Flightradar24Card._applyAreaViewport`**: Der Fehler
   gehört zur FR24-Map. Beta.7 bündelt Leaflet 1.9.4 in einer eigenen privaten
   Instanz; der Map-Handle liegt unter einem privaten `Symbol` und der
   Container heißt `crp-leaflet-map`. Die FR24-Implementierung verwendet
   dagegen ihr eigenes `window.L` und ihren eigenen `#map`-Container. Der
   Beta.7-Code kann den FR24-Handle nicht erreichen. Die frühere Beta.5-Ursache
   (generisches `_leafletMap`/`leaflet-map`) ist in Beta.7 bereits behoben.
   Der Stack zeigt eine FR24-eigene Destroy/Resize-Race; Flightradar24 wurde
   nicht verändert.

3. **`Subscription not found`**: Camper Route Planner registriert keine
   WebSocket-Subscription und ruft weder `subscribe_events` noch
   `unsubscribe_events` auf; es verwendet ausschließlich einzelne `callWS`
   Requests. Der Fehler kann deshalb nicht von dieser Integration stammen.
   Er ist separat im HA-/FR24-/Frontend-WebSocket-Lifecycle zu korrelieren.

## Lokale Korrektur

Beta.7 zerstörte eine bestehende Camper-Leaflet-Map erst nach dem Rendern des
neuen DOM. Dadurch war der alte Symbol-Handle nach `innerHTML`-Austausch nicht
mehr erreichbar; zusätzlich fehlte `disconnectedCallback()`. Der lokale Fix:

- alte Map vor dem Shadow-DOM-Austausch zerstören;
- bei Disconnect `map.remove()` über `destroyMap()` ausführen;
- bei Reconnect eine vorhandene Vorschau-Map neu aufbauen;
- Chromium-Regression für Re-Render, Disconnect und Reconnect ergänzen.

Der Fix ändert weder Flightradar24 noch HA, YAML, Dashboard, Credentials,
Nakordoni oder externe APIs.

Zusätzlich korrigiert der Kandidat den Katalogvertrag:

- `getStubConfig()` liefert nur `{ entry_id: "" }`;
- `window.customCards[].type` ist `camper-route-planner-card` ohne `custom:`;
- die spätere echte Card-Konfiguration bleibt weiterhin
  `type: "custom:camper-route-planner-card"`.

## Reproduktion / Grenzen

Der bestehende Browser-Harness deckt Resource-URL, Registrierung, Editor,
Desktop/Mobile, Kachelfehler und Leaflet-Isolation ab. Der neue Test prüft
zusätzlich den HA-Katalogvertrag, Stub-Konfiguration, Preview-Aufrufe ohne
Routing, Re-Render, Entfernen und erneutes Einhängen. Ein vollständiger
Home-Assistant-Kartenkatalog mit FR24 auf VM 104 wurde nicht ausgeführt; dies
ist eine möglichst originalgetreue Chromium-Fixture, kein echter HA-Test.

## Empfehlung

Den lokalen Fix als Kandidat für die nächste Beta testen. Vor einer
Veröffentlichung ist ein separat freigegebener HA-UI-Test erforderlich, der
den Katalog mit und ohne FR24, mehrfaches Öffnen/Schließen, Resize und
Dashboard-Navigation beobachtet. Für den `_leaflet_pos`-Stack und
`Subscription not found` sollte parallel ein FR24-/HA-Frontend-Fehlerbericht
mit exakter FR24-Version und WebSocket-Zeitstempeln erstellt werden; kein
unbegründeter FR24-Patch im Camper-Repository.
