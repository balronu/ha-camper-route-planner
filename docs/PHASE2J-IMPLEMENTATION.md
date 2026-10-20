# Phase 2J – Internal-Beta-Vorbereitung

## Scope

Phase 2J prüft den bestehenden Feature-Branch als isolierten Home-Assistant-
Teststand. Es wurden keine produktiven Home-Assistant-Dateien, Dashboards,
Proxmox-Ressourcen oder Nakordoni-Endpunkte verändert bzw. angesprochen.

## Umgesetzt

- HACS-/Custom-Integration-Struktur, Manifest, Domain, Config Flow, Options
  Flow, Übersetzungen, WebSocket-Befehle, Runtime-Setup und Unload geprüft.
- Persönlicher Nakordoni-Key bleibt Config-Entry-lokal; Eingabevalidierung ist
  formal und behauptet keine Online-Authentifizierung.
- Options-Flow unterstützt Beibehalten, Erneuern und explizites Entfernen.
- Browser-Routenrecords weisen credential-artige Felder vor der Speicherung ab.
- Berechnung bleibt ausschließlich eine explizite Benutzeraktion; kein Start-,
  GPS-, Karten- oder Profiländerungs-Trigger berechnet automatisch.
- Frontend-Bundle, manuelle Resource-Einbindung, Cache-Busting, GPX-Export,
  Speicherung/Laden/Löschen und Beta-/Attributionshinweise dokumentiert.
- Installations-, Test- und Rücknahmeablauf für VM 104 vorbereitet, aber nicht
  ausgeführt.

## Bewusst nicht ausgeführt

- Keine HA-Installation, kein Dashboardzugriff und kein zusätzliches Backup.
- Keine echten Nakordoni-Anfragen und keine Suche nach Credentials.
- Kein Merge, Tag, Release oder HACS-Veröffentlichung.

## Reifeurteil

Der Branch ist ein vorbereiteter Kandidat für einen späteren, ausdrücklich
freigegebenen Praxistest. Er ist noch keine freigegebene interne Beta: die
reale Motorhome-API, die Berechtigung eines Benutzer-Keys und die Installation
in einer echten HA-Instanz bleiben ungetestet.
