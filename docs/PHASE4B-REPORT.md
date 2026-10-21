# Phase 4B – Nakordoni-Transport und Vertragsprüfung

Stand: 21.10.2026. Diese Phase bereitet die produktive Anbindung offline vor.
Es wurden keine Nakordoni-, Geoapify- oder CARTO-Anfragen ausgeführt.

## Bestätigter öffentlicher Vertrag

Die offizielle Nakordoni-API-Dokumentation bestätigt derzeit:

- `GET https://nakordoni.eu/api/v2/data/truck-route`;
- `Authorization: Bearer <API-Key>`;
- Koordinaten als `lat,lon` in `from` und `to`;
- bis zu fünf `via`-Punkte als ein pipe-separierter Parameter;
- `height`, `width`, `length`, `weight` in Tonnen und `axles`;
- `geometry=geojson|polyline5|polyline6`;
- `data.route.distance_m`, `duration_s`, `geometry`, `warnings` und
  `restriction_hits` sowie `data.tolls` mit einem möglichen
  `complete`-/`estimate`-Status;
- eine separate `route`-Quota-Klasse.

Die Referenz dokumentiert **kein** `vehicle_type=motorhome`. Die lokale
Support-/Audit-Dokumentation führt Motorhome weiterhin als angekündigte,
noch nicht verfügbare Funktion. Daher wird der vorhandene
`NakordoniMotorhomeProvider` in dieser Phase nicht für echte Requests
freigeschaltet.

## Implementierung

`NakordoniHttpTransport` verwendet ausschließlich eine von Home Assistant
bereitgestellte aiohttp-Session. Er:

- sendet einen einzelnen GET mit Bearer-Header und Timeout;
- führt keine automatischen Wiederholungen, Token-Erneuerung oder Quota-
  Abfragen aus;
- normalisiert HTTP-Status und ausschließlich sichere Quota-Header;
- gibt weder Response-Body-Fehlertexte mit Credentials noch Header-Secrets
  weiter;
- bleibt ohne aktive Motorhome-Vertragsfreigabe ein reiner vorbereiteter Pfad.

Die eigentliche Provider-/Fixture-Normalisierung bleibt getrennt vom
Transport. Fehlende Keys, Timeouts, Netzwerkfehler, HTTP-Fehler und ungültige
JSON-/Routenantworten bleiben explizite Fehler; es gibt keinen Mock-Fallback.

## Offene Voraussetzungen / NO-GO

Vor einem kontrollierten echten Test fehlen weiterhin:

1. veröffentlichter und versionierter Motorhome-Request-/Response-Vertrag;
2. Bestätigung, dass `vehicle_type=motorhome` tatsächlich unterstützt wird;
3. Bestätigung der zulässigen Märkte und des persönlichen Route-Kontingents;
4. bestätigte Geometriecodierung der Motorhome-Antwort;
5. ausdrückliche Freigabe eines einzelnen synthetischen Probeaufrufs durch den
   Accountinhaber.

Bewertung: **NO-GO für einen echten Nakordoni-Motorhome-Livetest**.

