# Phase 2A – Implementierungsbericht

**Stand:** 16.10.2026
**Version:** `v0.1.0-alpha.1` (lokaler Kandidat)
**Scope:** lokale, staged Home-Assistant-Custom-Integration; keine Installation in HA und keine produktive Konfiguration.

## Implementierte Komponenten

- `custom_components/camper_route_planner/`: Integrationseintrag, Manifest,
  Config Flow, Options Flow und deutsche/englische Übersetzungen.
- Providerneutrale Modelle für Profile, Waypoints, Geometrie, Warnungen,
  Fähigkeiten, Requests, Results und normalisierte Fehler.
- Deterministischer `MockRoutingProvider` mit klar markierten synthetischen
  Ergebnissen und kontrollierten Fehlern.
- `NakordoniRoutingProvider` als Offline-Adapter-Skelett: Parameterabbildung,
  lokale Fixture-Normalisierung, Timeout-/Capability-Modell und harte Sperre
  für Live-Routing.
- Expliziter `RouteCoordinator` ohne Timer, Listener oder Refresh-Loop; mit
  In-Flight-Deduplizierung und Quota-Guard.
- Versionierter HA-Store-Vertrag für Profile und Routendaten; atomarer
  JSON-Teststore und additive Migration von Version 1 auf 2.
- Response-Service `camper_route_planner.calculate_route`; ausschließlich ein
  direkter Serviceaufruf kann eine Berechnung auslösen.
- Deaktivierte, datenbankfreie Verträge für Mobile Fuel Stations und Camper
  Travel Journal.

## Architekturentscheidungen

- Das Carthago-Profil liegt ausschließlich in `tests/test_phase2a.py` als
  Fixture und wird niemals beim Setup erzeugt.
- Mock-Modus benötigt keinen Nakordoni-Key.
- Nakordoni bleibt auch bei vorhandener Credential-Konfiguration deaktiviert;
  `stored` wird nicht als `verified` behandelt.
- Es gibt keinen GPS-Listener, keine Entity, keinen periodischen Coordinator-
  Refresh und keine automatische Berechnung bei Start, Reload oder Dashboard-
  Öffnung.
- Credentials werden nicht in Route- oder Exportdaten persistiert.

## Bewusste Abweichungen / Grenzen

Die HA-Wrapper importieren Home Assistant erst in der produktiven Laufzeit.
Dadurch bleibt die Offline-Testumgebung ohne HA-Paket ausführbar. Die
HA-spezifische Fixture-/Hassfest-Prüfung ist lokal nicht verfügbar und wurde
nicht durch Offline-Tests ersetzt. Die Integration enthält in Phase 2A noch
keine Entities, keine Live-Netzwerkimplementierung und keine Sygic-Anbindung.
