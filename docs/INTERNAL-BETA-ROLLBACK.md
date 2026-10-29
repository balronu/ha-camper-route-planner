# Interne Beta – Rücknahme auf Stable v0.1.3

**Vorbereitung, nicht ausgeführt.**

1. Vor dem Wechsel ein Home-Assistant-Backup erstellen und die aktuelle
   installierte Version dokumentieren.
2. In HACS ausdrücklich Stable-Tag `v0.1.3` auswählen oder das unveränderte
   v0.1.3-Release-Asset installieren; keine Beta-/Main-Version auswählen.
3. Testansicht und die manuell hinzugefügte eigene Lovelace-Ressource entfernen.
4. Die Config Entry des Teststands entfernen und prüfen, dass nur der eigene
   Runtime-Eintrag und die eigene Extra-JS-Registrierung verschwinden.
5. Nur die kopierte `custom_components/camper_route_planner/`-Integration aus
   der Testinstanz entfernen; keine fremden Dateien oder Dashboards löschen.
6. Gespeicherte Test-Routen und den persönlichen Key über HA entfernen; keine
   Schlüssel in Berichten oder Logs belassen.
7. Nach HA-Neustart read-only prüfen: kein eigener Static-Path/Extra-JS-Eintrag,
   kein Runtime-Eintrag, keine laufenden Listener/Timer und keine unerwarteten
   Dateien.

Gespeicherte produktive Routen, Fahrzeugprofile, Zoe-Daten und Config Entries
werden nicht migriert, gelöscht oder überschrieben. Bei einem Fehler wird nicht automatisch zurückgerollt oder neu installiert;
die Sitzung stoppt und dokumentiert den Zustand.
