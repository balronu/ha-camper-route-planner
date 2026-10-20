# Phase 2I – Offline-Implementierung

## Ergebnis

Phase 2I ergänzt die manuelle API-Key-Anbindung und die kontrollierte
Vorbereitung von Live-Tests. Der Nakordoni-Motorhome-Provider bleibt im
produktiven HA-Runtime-Pfad offline, bis ein separater Live-Test ausdrücklich
freigegeben wird. OAuth/PKCE bleibt eine optionale spätere Alternative und ist
keine Voraussetzung für v0.1.0 Stable.

## Implementiert

- API-Key-Pflicht für `nakordoni` und `nakordoni_motorhome`
- Passwortfeld im Config-/Options-Flow
- sichere Erneuerung, Beibehalten bei leerer Eingabe und explizites Löschen
- formale Key-Validierung ohne Netzwerkrequest
- keine Übertragung des Keys in Lovelace, WebSocket, GPX oder Frontend
- isoliertes Dry-Run-Testwerkzeug mit doppelter Live-Startschranke
- strikt acht Requests maximal, keine Retries, redigierte Ausgaben
- Stable-/Surface-/Kontingent- und Schweiz-Dokumentation

## Grenzen

Es wurden keine Home-Assistant-Instanz, kein Proxmox-System und kein
Nakordoni-Dashboard verändert. Es gab keinen Live-API-Aufruf, keinen echten
Key, keinen Merge, keinen Tag und kein Release.
