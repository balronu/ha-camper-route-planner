# Lovelace-Resource-Registrierung

**Status: automatisch über die Integration vorbereitet.** Das Bundle liegt im
Installationspaket unter `frontend/camper-route-planner-card.js`. Beim
`async_setup` wird es über HA `async_register_static_paths` ausgeliefert und
über `add_extra_js_url` mit `?v=0.1.0-beta.5` idempotent geladen. Der Static
Path wird über Reloads hinweg nur einmal registriert; die Extra-JS-URL wird
beim erneuten Setup wieder aktiviert. Bestehende Dashboards und deren
Resource-Collections werden nicht verändert.

Die automatische Auslieferung ist statisch/HA-seitig implementiert, aber der
vollständige HACS-UI-Installationslauf und iOS-Safari bleiben außerhalb der
isolierten CI-Fixture. Der HA-2026.10.1-Nachweis deckt HTTP 200, Bundle-Marker,
Extra-JS, Unload/Cleanup und erneutes Setup ab.
