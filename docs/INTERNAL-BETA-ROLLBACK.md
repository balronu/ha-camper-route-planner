# Interne Beta – Rücknahme

**Vorbereitung, nicht ausgeführt.**

1. Testansicht und die manuell hinzugefügte eigene Lovelace-Ressource entfernen.
2. Die Config Entry des Teststands entfernen und prüfen, dass nur der eigene
   Runtime-Eintrag und die eigene Extra-JS-Registrierung verschwinden.
3. Nur die kopierte `custom_components/camper_route_planner/`-Integration aus
   der Testinstanz entfernen; keine fremden Dateien oder Dashboards löschen.
4. Gespeicherte Test-Routen und den persönlichen Key über HA entfernen; keine
   Schlüssel in Berichten oder Logs belassen.
5. Nach HA-Neustart read-only prüfen: kein eigener Static-Path/Extra-JS-Eintrag,
   kein Runtime-Eintrag, keine laufenden Listener/Timer und keine unerwarteten
   Dateien.

Bei einem Fehler wird nicht automatisch zurückgerollt oder neu installiert;
die Sitzung stoppt und dokumentiert den Zustand.
