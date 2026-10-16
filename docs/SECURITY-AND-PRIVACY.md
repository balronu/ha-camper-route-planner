# Sicherheit und Datenschutz

- API-Key nur in HA Secret/Config-Entry-Token; niemals in Logs, Diagnostics, GPX, Markdown oder Git.
- HTTPS, begrenzte Timeouts, keine automatische Wiederholung bei 401/403/429 ohne Benutzeraktion.
- Cache mit TTL und Provider-Zeitstempel; Datenlöschung nach Lizenz-/Key-Ende berücksichtigen.
- Route/Koordinaten sind personenbezogene bzw. bewegungsbezogene Daten: lokale Speicherung minimieren, Export explizit auslösen, Löschen anbieten.
- Keine Drittintegrationsdatenbank lesen; nur offizielle optionale Adapter.
- Providerdaten sind Schätzungen und können fehlen/falsch/veraltet sein. UI muss Qualität und Zeitstempel sichtbar machen.
- Phase-1-Scan muss private IPs, Secrets und Live-URLs ausschließen; synthetische Testdaten verwenden.
