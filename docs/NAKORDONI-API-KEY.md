# Nakordoni API-Key-Anbindung

Phase 2I implementiert die manuelle Verwendung eines persönlichen
Nakordoni-API-Keys.

## Sicherheitsmodell

- Der Key wird ausschließlich über den Home-Assistant Config-/Options-Flow
  eingegeben und in der lokalen Config-Entry-Datenstruktur gespeichert.
- Das Eingabefeld ist ein Passwortfeld. Ein leerer Options-Flow-Eintrag behält
  den bisherigen Key; die separate Option `remove_api_key` löscht ihn.
- Der Key wird weder an Lovelace/WebSocket/GPX übertragen noch in Logs,
  Diagnosedaten oder Provider-Fehlermeldungen kopiert.
- Der Key wird nicht als CLI-Argument akzeptiert. Das isolierte Werkzeug liest
  ihn nur aus `NAKORDONI_API_KEY` oder einer geschützten Datei aus
  `NAKORDONI_API_KEY_FILE`.
- Die lokale Validierung prüft nur Form und Länge. Eine Gültigkeitsprüfung
  gegen Nakordoni wäre ein Netzwerkaufruf und ist offline nicht zulässig.

## Benutzerkonto und Kontingent

Jede Installation benötigt den persönlichen Developer-Account und den
persönlichen Key des Benutzers. Das Kontingent wird nicht fest angenommen.
Bei unbekannter Kontingentklasse muss die UI „unbekannt“ anzeigen; ein Trip
Pass darf nicht suggeriert werden. Usage-Abfragen bleiben getrennt und dürfen
höchstens alle 15 Minuten aktualisiert werden.

## Nakordoni-Vorgaben

Die Integration muss als eigene Surface im Nakordoni-Developer-Dashboard
registriert werden. Diese Registrierung ist in Phase 2I nur vorbereitet und
dokumentiert; es findet keine Anmeldung in einem fremden Account statt.
Routendaten tragen den aktiven Link [Data by nakordoni.eu](https://nakordoni.eu).
Die Developer-Registrierung ist unter
[nakordoni.eu/developers](https://nakordoni.eu/en/developers) verlinkt.
