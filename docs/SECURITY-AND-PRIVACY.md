# Sicherheit und Datenschutz

- API-Key nur in HA Secret/Config-Entry-Token; niemals in Logs, Diagnostics, GPX, Markdown oder Git.
- HTTPS, begrenzte Timeouts, keine automatische Wiederholung bei 401/403/429 ohne Benutzeraktion.
- Cache mit TTL und Provider-Zeitstempel; Datenlöschung nach Lizenz-/Key-Ende berücksichtigen.
- Route/Koordinaten sind personenbezogene bzw. bewegungsbezogene Daten: lokale Speicherung minimieren, Export explizit auslösen, Löschen anbieten.
- Request-Koordinaten, Waypoints und Zeitangaben gehören zu den sensiblen
  Requestdaten. Sie werden nicht in nativen HA-Diagnostics ausgegeben.
- Die administrative Request-Diagnose ist standardmäßig deaktiviert, gilt nur
  für einen Backend-Versuch und verwirft den flüchtigen Bericht nach dem
  Abruf. „Diagnose kopieren“ bietet nur den bereinigten Bericht an; es gibt
  keinen automatischen Versand oder zusätzlichen Speicher.
- Die Entwicklerdiagnose bleibt in der Karte ausgeblendet, bis ein
  Administrator sie pro Karte aktiviert. Nicht-Administratoren können sie
  weder über die Oberfläche noch über den geschützten Backend-Befehl abrufen.
- Keine Drittintegrationsdatenbank lesen; nur offizielle optionale Adapter.
- Providerdaten sind Schätzungen und können fehlen/falsch/veraltet sein. UI muss Qualität und Zeitstempel sichtbar machen.
- Phase-1-Scan muss private IPs, Secrets und Live-URLs ausschließen; synthetische Testdaten verwenden.
