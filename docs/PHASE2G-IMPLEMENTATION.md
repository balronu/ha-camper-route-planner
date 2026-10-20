# Phase 2G – Implementierung

## Ergebnis

- neuer Provider `nakordoni_motorhome`, getrennt von Mock und Legacy-Nakordoni
- explizites Motorhome-Requestmodell mit Tonnengewicht, Achszahl und ohne Lkw-Fahrerzeiten
- defensive Fixture-Normalisierung für Geometrie, Warnungen und Maut
- PKCE-/State-Helfer ohne Netzwerkzugriff
- Quotenmodell und 15-Minuten-Aktualisierungsregel ohne Polling
- Beta-Hinweis und Nakordoni-Attribution in der Karte
- Config-/Options-Flow unterstützt die neue Providerauswahl; Live-Routing bleibt deaktiviert
- bestehende manuelle Berechnung und GPX-Export bleiben providerfrei bzw. klickgebunden

## Grenzen

Es wurden keine neuen Live-Routing-Funktionen aktiviert. OAuth, Usage-Sensoren und reale Streckentests sind vorbereitet, aber nicht produktiv verdrahtet. Keine Credentials wurden verwendet.

