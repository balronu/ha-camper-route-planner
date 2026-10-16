# Routing-Datenmodell

`RouteRequest`: Ursprung, Ziel, bis zu fünf Via-Punkte, Fahrzeugprofil, Alternativen, Geometrieformat, Verkehrsmodus, optionale zonenbewusste Abfahrt.

`RouteResult`: Provider, Distanz in m, reine Fahrdauer in s, normalisierte Geometrie, Warnungen, Aktualitäts-/Qualitätsmetadaten, Attribution, Rohantwort nur getrennt und redigiert.

Fehlerklassen: Validierungsfehler (lokal), Authentifizierung (401), Berechtigung/Markt (403), Kontingent (429), Provider-/Schemafehler (5xx/ungültiges JSON), Timeout. `ok=false` ist maßgeblich; `data` wird bei Fehlern niemals gelesen.

Cache-Schlüssel müssen alle routebestimmenden Eingaben einschließen. Fehlende Antwortfelder bleiben `None`/unknown; keine Defaultwerte, die „keine Einschränkung“ bedeuten.
