# Lovelace-Resource-Registrierung

**Status: CONDITIONAL / manuell.** Das Bundle und das Custom Element
`custom:camper-route-planner-card` sind vorhanden und idempotent registriert.
Eine automatische Lovelace-Resource-Registrierung ist bewusst nicht
implementiert, damit keine fremden Dashboards oder Ressourcen verändert werden.

Vor einer Beta müssen Resource-URL, Versions-Cache, HA-Neustart,
Config-Entry-Reload, Update und Cleanup eigener Einträge in einer isolierten
HA-Instanz geprüft werden. Bis dahin bleibt die manuelle Resource-Einbindung
die sichere Variante.
