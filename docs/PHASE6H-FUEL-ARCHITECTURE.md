# Phase 6H – Tankplanung und Preis-Schnittstelle

Beta.13 trennt dauerhafte Fahrzeugstammdaten von veränderlichen Reisedaten:

- Im Fahrzeugprofil bleiben Tankgröße und Durchschnittsverbrauch sowie die
  bestehenden Fahrzeug- und Tracker-Daten.
- Füllstand (Liter oder Prozent), Sicherheitsreserve und ein optionaler
  manueller Dieselpreis werden ausschließlich lokal in der Lovelace-Karte
  gespeichert. Der Schlüssel enthält Integrationseintrag und `profile_id`,
  damit ein Fahrzeugwechsel keine Tankdaten übernimmt.
- Alte Beta.12-Felder werden beim Lesen als Rückwärtskompatibilitäts-Fallback
  verwendet. Beim Speichern des Fahrzeugdialogs werden sie nicht gelöscht;
  neue Änderungen überschreiben das dauerhafte Profil jedoch nicht.

Die lokale Berechnung liefert den Gesamtbedarf aus Entfernung und Verbrauch.
Reichweite und Fehlbedarf erscheinen nur bei vollständigem, validem Tankstand,
Tankgröße, Reserve und Verbrauch. Ein manueller Preis erzeugt ausschließlich
eine ausdrücklich als grobe Schätzung gekennzeichnete lokale Kostenschätzung.
Ohne Preis erscheinen keine scheinbar exakten Kosten.

## Spätere, getrennte Preis-/Tankstellen-Schnittstelle

Eine künftige Erweiterung (Beta.14) kann vorhandene Routengeometrie in eine
unabhängige Preisquelle übergeben. Für Reisen in der Zukunft werden dabei
ausdrücklich die heute verfügbaren Preise mit Datenstand als Grundlage
verwendet und als „Geschätzte Kraftstoffkosten auf Basis heutiger Dieselpreise“
gekennzeichnet; eine Preisprognose ist nicht erforderlich. Vorgesehene
Datenfelder sind `station_id`, Position, `fuel_type`, `price`, `currency`,
`observed_at`, Quelle/Lizenz, Umwegstrecke, Erreichbarkeit und Datenqualität.
Die spätere Ausgabe trennt rechnerische Gesamtkosten der Reise von
voraussichtlichen Tankausgaben unterwegs bei gegebenem Startfüllstand. Diese
Schicht bleibt getrennt von Fahrzeugprofil, Routing und lokaler
Reichweitenberechnung. Sie darf keine Route automatisch ändern und keine
Nakordoni- oder andere externe Anfrage ohne ausdrückliche Nutzeraktion starten.
Beta.13 implementiert diese Schnittstelle noch nicht.
