# Architekturentwurf

## Grenzen

Phase 1 bis Phase 2E sind offline/staged. Die aktuelle 2F-2I-Arbeit ist
Dokumentationsplanung; sie enthält keine neue Routing-Implementierung. Phase 2A enthält die Struktur einer
native Custom Integration mit Domain-Modul, Config Flow, Options Flow und HA
Storage, aber keine produktive Installation und keinen Live-HTTP-Client. Es
gibt keine Listener auf GPS, keinen Start bei Lovelace-Öffnung und keinen Start
nach HA-Neustart.

## Komponenten

```text
Lovelace / Service: explicit calculate
             |
        RouteCoordinator -- manual action + dedupe + quota guard
             |
       RoutingProvider protocol
        /       |          \
   Nakordoni  Mock       future provider
             |
       normalized RouteResult
            |
       local route store / GPX export
```

Der Phase-2A-Service `camper_route_planner.calculate_route` ist die einzige
HA-Aktionsgrenze. Ein `DataUpdateCoordinator` mit Refresh-Loop wird bewusst
nicht verwendet.

`RouteRequest` und `RouteResult` bleiben providerunabhängig. Der Nakordoni-Adapter besitzt die einzige Übersetzung in API-Parameter und die einzige Antwort-Normalisierung. API-Schlüssel werden als Config-Entry-Secret/Token gespeichert, nie in Diagnosen, Exporten oder Logmeldungen.

## Routing-Modi und Nakordoni-Vertrag

Demo-/Fixture-Routing, Nakordoni-Truck-Routing und das künftige
Nakordoni-Motorhome-Routing sind drei getrennte Modi. `synthetic=true` muss Demo-
Ergebnisse unverwechselbar markieren. Truck-Ergebnisse werden als HGV-/Truck-
Näherung gekennzeichnet und dürfen nicht als sichere Wohnmobilnavigation,
Wohnmobilmaut oder Wohnmobil-Rechtsauskunft dargestellt werden. Der Modus
`motorhome` bleibt deaktiviert, bis Nakordoni ihn tatsächlich freigibt und das
Schema bestätigt; ein stiller Truck-Fallback ist nicht erlaubt.

OAuth2 erhält einen eigenen Camper-Route-Planner-Client, eigenen Token-/Status-
Speicher und eigenen Quota-Guard. Nakordoni soll diesen Client nach Übermittlung
der Repository-URL registrieren. Der OAuth-Client von Mobile Fuel Stations,
dessen Config Entry und dessen Storage sind keine Abhängigkeit. Die Kontingent-
und Authentifizierungsgrenze ist pro Benutzer/Config Entry zu bewerten.

## Persistenz

Kleine Metadaten (Provider, Version, Cache-Index, Profil-Index) über Home-Assistant-Storage mit `version`/`minor_version` und Migrationen. Routen mit Geometrie und Provider-Rohdaten in einem versionierten, lokalen JSON- oder später SQLite-Store; keine Recorder-internen Tabellen und keine Datenbankzugriffe auf Partnerintegrationen. Routenexporte entfernen Credentials und Request-Header.

## GPX-Export

Der GPX-Export arbeitet ausschließlich auf dem normalisierten Routenmodell. Er
startet keine neue Berechnung und kennt keinen Provider-spezifischen API-Key.
`route` exportiert Start, Zwischenziele und Ziel als GPX-1.1-Route (`rte`),
`track` exportiert ausschließlich die tatsächlich gespeicherte Geometrie als
Track (`trk`); `combined` enthält beides. Bei fehlender oder ungültiger
Geometrie wird der Track-Export abgelehnt. Die WebSocket-Aktion erzeugt den
Inhalt erst nach expliziter Benutzeraktion und legt keine Datei im HA-
Dateisystem ab.

## Kosten- und Lebenszyklus-Schutz

Nur ein expliziter Button/Service darf den Provider aufrufen. Cache-Key = normalisierte Anfrage + Fahrzeugprofil + Provider + relevante Optionen. Identische laufende Anfragen werden dedupliziert; ein erneuter manueller Aufruf muss Quota/TTL prüfen. GPS, HA-Start, Config-Reload, Kartenansicht und Sensor-Refresh sind niemals Auslöser.
