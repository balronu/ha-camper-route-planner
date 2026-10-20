# Lovelace-Resource-Registrierung

**Status: automatisch über die Integration vorbereitet.** Das Bundle liegt im
Installationspaket unter `frontend/camper-route-planner-card.js`. Beim
`async_setup` wird es über HA `async_register_static_paths` ausgeliefert und
über `add_extra_js_url` mit `?v=0.1.0-alpha.1` idempotent geladen. Bestehende
Dashboards und deren Resource-Collections werden nicht verändert.

Die automatische Auslieferung ist statisch/HA-seitig implementiert, aber der
vollständige Browser- und Neustartnachweis in einer realen HA-Instanz bleibt
NOT RUN. Bei einer späteren Beta-Prüfung sind URL, Cache-Busting, Reload,
Update und Cleanup des eigenen Extra-JS-Eintrags zu verifizieren.
