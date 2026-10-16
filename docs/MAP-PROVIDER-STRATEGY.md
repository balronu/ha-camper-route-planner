# Kartenanbieter-Strategie

## Ergebnis

Camper Route Planner verwendet eine lokale Leaflet-Bundled-Karte, wenn der
Home-Assistant-Options-Flow den Anbieter `CARTO` und einen ausdrücklich
browsergeeigneten CARTO-Basemap-Key konfiguriert hat. Ohne Konfiguration,
bei ungültigem Zugang oder bei einem Kachelfehler bleibt die vorhandene
geometrische SVG-Karte aktiv.

Die Schwesterimplementierung in `ha-camper-travel-journal` wurde ausschließlich
lesend geprüft. Übernommen wurden das getrennte Options-Flow-Feld, die CARTO-
Raster-URL, URL-Encoding und sichtbare Attribution. Das Schwesterprojekt wurde
nicht geändert.

## Credential-Grenze

CARTO-Basemap-Kacheln benötigen den Key in der Tile-URL. Dadurch ist dieser Key
im Browser und in den Netzwerkwerkzeugen sichtbar. Für diese Integration ist
daher nur ein dafür freigegebener, eingeschränkter **browsergeeigneter
Basemap-Key** zulässig. Ein privater, allgemeiner oder nicht für öffentliche
Browsernutzung freigegebener CARTO-Token darf nicht eingetragen werden.

Der Wert wird über den Home-Assistant-Options-Flow gespeichert, niemals im
Lovelace-YAML. Die WebSocket-Antwort liefert bei gültiger Konfiguration die
Tile-URL, weil Leaflet sie benötigt; sie liefert bei fehlendem/ungültigem Wert
keine URL. Es gibt keine direkte HTTP-Routing-Anfrage aus dem Browser und keine
Weitergabe von Nakordoni-Credentials.

CARTO beschreibt die Basemap-URL und die erforderliche Attribution in der
[offiziellen Basemap-Dokumentation](https://carto.com/basemaps/index.html?trk=public_profile__posts-text).
Die [Credential-Dokumentation](https://docs.carto.com/carto-user-manual/developers/managing-credentials/api-access-tokens)
empfiehlt Einschränkungen wie erlaubte APIs und Referer für öffentliche Tokens.

## Konfigurationsvertrag

`camper_route_planner/map_config` liefert:

- `provider`: `none` oder `carto`
- `status`: `not_configured`, `configured` oder `invalid`
- `tile_url`: nur bei `configured`
- `tile_attribution`: nur bei `configured`
- `error_code`: z. B. `carto_key_required` oder `carto_key_invalid`
- `browser_safe`: nur bei explizit akzeptiertem Basemap-Key `true`

Die Eingabe wird auf Länge, Whitespace und Steuerzeichen geprüft. Das ist keine
inhaltliche Geheimnisprüfung: Die Verantwortung, ausschließlich einen
browsergeeigneten und eingeschränkten CARTO-Basemap-Key zu verwenden, bleibt
bei der Konfiguration.

## Frontend und Fallback

Leaflet wird lokal als Produktions-Bundle gebaut. CARTO ist nur eine
konfigurierbare Tile-Schicht; Route, Marker und Geometrie bleiben lokale
Darstellung. Bei `tileerror` wird die Leaflet-Instanz entfernt und die SVG-
Geometrie erneut gerendert. Attribution wird an Leaflet übergeben.

Ohne CARTO-Zugang wird keine Drittanbieter-Karte geladen. Dadurch bleiben
Mock-Tests und die Integration ohne Kartenkonto funktionsfähig.

## Cache und Tests

Das Bundle erhält weiterhin eine versionierte URL durch die bestehende
Frontend-Cache-Strategie. Kartenkonfiguration wird beim Aufbau der HA-
Verbindung einmal per WebSocket gelesen; sie wird nicht bei jedem Rendern oder
bei Standortänderungen neu berechnet. Eine Änderung des Options-Flows wird beim
nächsten Verbindungsaufbau sichtbar. Es gibt keine tile-spezifische globale
Cache-Invalidierung im Projektcode; Browser- und CARTO-Cache bleiben
zuständigkeitsgemäß extern.

Lokale Tests prüfen Providerstatus, URL-Encoding, fehlende/ungültige Keys,
WebSocket-Konfiguration, Leaflet-Quelle, SVG-Fallback und das Ausbleiben
direkter Browser-HTTP-Aufrufe. Es wurden keine CARTO-Kacheln live abgerufen.
