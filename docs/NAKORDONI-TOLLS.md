# Mautdarstellung

Die Normalisierung unterstützt `priced`, `status`, `complete`, `estimate`, `coverage_note`, Länderbeträge, Gesamtbetrag und Währung. Die Oberfläche unterscheidet verfügbaren Preis, Schätzung, unvollständige Daten und fehlende Preisinformation.

Ein fehlender Betrag wird niemals als 0 interpretiert. Eine unvollständige Summe wird nicht als verbindliche Gesamtkosten dargestellt. Länderabdeckung und Preise sind Momentaufnahmen der Providerantwort und werden nicht als dauerhaft vollständige Liste fest einprogrammiert.

API v2 und API v3 werden getrennt verarbeitet. v2 kann eine Schätzung liefern;
v3 normalisiert `total_eur` und `by_country` in die interne Darstellung und
erhält `complete=false`, Währung, Länderstatus, Objekte und Providerhinweise.
Bei fehlender v3-Abdeckung wird keine v2-Summe eingesetzt und kein Lkw-Tarif
auf ein privates Wohnmobil übertragen. Eine unvollständige v3-Antwort ist eine
sichtbare Datenqualitätsbegrenzung, nicht der Beleg, dass v3 grundsätzlich
keine Maut unterstützt.
