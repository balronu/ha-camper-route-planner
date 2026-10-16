# Wohnmobil-Eignung und rechtliche Grenzen

## Referenzfahrzeug

3,20 m hoch, 2,34 m breit, 7,65 m lang, 4,8 t zulässige Gesamtmasse, Diesel, Wohnmobil. Diese Werte liegen innerhalb der dokumentierten Truck-Parametergrenzen; das beweist jedoch nur technische Eingabekompatibilität.

## Bewertung

Nakordoni dokumentiert den Endpunkt als **Truck Route API / HGV-legal route**. Ein Wohnmobilprofil oder eine Fahrzeugart, die zwischen Lkw, Reisebus und privat genutztem Wohnmobil unterscheidet, ist nicht dokumentiert. Daher kann die Integration Höhen-/Gewichtsrestriktionen als konservative technische Näherung verwenden, darf aber nicht behaupten, alle wohnmobilspezifischen Ausnahmen, lokalen Beschilderungen, Umweltzonen oder Mautklassen korrekt abzubilden.

Die EU-Verordnung 561/2006 knüpft ihren Anwendungsbereich an Güterbeförderung bzw. Fahrzeuge für mehr als neun Personen und enthält Ausnahmen; die Einordnung eines konkreten privat genutzten Wohnmobils ist kontextabhängig. Quelle: [konsolidierte EUR-Lex-Fassung](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A02006R0561-20241231). Lkw-Pausen dürfen deshalb nicht als notwendige Wohnmobil-Pausen angezeigt werden.

Truck-Mautwerte, die Nakordoni als HGV-Tarife/Truck-Rate beschreibt, dürfen nicht als Wohnmobilkosten erscheinen. Die Integration zeigt sie höchstens unter „nicht auf Wohnmobil übertragbar“. Länderabhängige Maut, Vignetten, Umweltzonen und Durchfahrtsverbote benötigen einen separaten Rechts-/Länder-Datensatz.

Laut Nakordoni-Support ist `vehicle_type=motorhome` noch nicht verfügbar; eine
erste Beta wurde nur unverbindlich für ungefähr den 26.10.2026 prognostiziert.
Bis zur tatsächlichen Freigabe ist Truck-Routing ausdrücklich keine sichere
Wohnmobilnavigation. Das geplante Motorhome-Profil soll eigene Abmessungs-,
Gewichts-, Wohnmobilverbots- und Mautsemantik erhalten; Lkw-Lenk- und
Ruhezeiten sollen dort nicht gelten. Diese Zielbeschreibung ist noch kein
verfügbarer API-Vertrag.

## UI-Regeln

- Providerstatus: `HGV approximation; motorhome suitability unverified`.
- Ruheplan: deaktiviert oder ausschließlich „Lkw-Planungshilfe“.
- Maut: deaktiviert oder „Lkw-Schätzung, keine Wohnmobilkosten“.
- Lkw-Fahrverbote: als Warnsignal, niemals als vollständige Wohnmobil-Rechtsauskunft.
- Fehlende/uneindeutige Daten: „unknown“, nicht „frei“.
