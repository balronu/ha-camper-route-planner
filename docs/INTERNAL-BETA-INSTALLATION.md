# Interne Beta `v0.1.2-beta.3` – Installationsplan für VM 104

**Status: NICHT AUSGEFÜHRT.** Dieser Ablauf ist nur für eine spätere,
gesondert freigegebene Sitzung bestimmt.

1. HA-Version und freien Zustand read-only prüfen; bestehende Sicherungen nicht
   verändern und kein zusätzliches Backup ohne Auftrag erstellen.
2. Den Feature-Branch-Commit lokal als Installationsstand dokumentieren.
3. Nur `custom_components/camper_route_planner/` in eine kontrollierte
   Testkopie der HA-Instanz übertragen; keine Dashboards überschreiben.
4. Integration über **Einstellungen → Geräte & Dienste** einrichten.
5. Den persönlichen Nakordoni-Key ausschließlich im HA-Formular eingeben.
   Nicht auf dem OpenClaw-Host, in Shell-History oder Git speichern.
6. Das Carthago-Profil anlegen: 7,65 m × 2,34 m × 3,20 m, 4.800 kg, zwei
   Achsen, `motorhome`.
7. Prüfen, dass die Integration das Bundle automatisch über den eigenen
   versionierten Static-Path lädt; nur in einer eigenen Testansicht eine Karte
   anlegen. Keine bestehende Resource-Collection verändern.
8. Zuerst Offline-/Mock-Lifecycle prüfen; danach höchstens acht manuelle
   Routingabfragen mit Stop-Entscheidung nach jeder Abfrage.
9. Karte, Restriktionen, Maut, Speichern/Laden und GPX nur mit den Ergebnissen
   dieses Eintrags prüfen.

Keine automatische Resource-Registrierung, kein GPS-Trigger und keine
Änderung bestehender Dashboards.
