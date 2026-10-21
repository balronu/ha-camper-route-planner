# Lovelace-Resource-Registrierung

**Status: automatisch über die Integration vorbereitet.** Das Bundle liegt im
Installationspaket unter `frontend/camper-route-planner-card.js`. Beim
`async_setup` wird es über HA `async_register_static_paths` ausgeliefert und im
Lovelace-Storage-Modus idempotent als JavaScript-Resource registriert. Dadurch
lädt Lovelace das Bundle erst nach der HA-Scoped-Custom-Element-Registry.
`add_extra_js_url` wird bewusst nicht verwendet, weil dessen paralleler
Früh-Ladeweg die Registrierung in HA 2026.10.x unsichtbar machen kann.

Die automatische Auslieferung ist statisch/HA-seitig implementiert, aber der
vollständige HACS-UI-Installationslauf und iOS-Safari bleiben außerhalb der
isolierten CI-Fixture. Der HA-2026.10.1-Nachweis deckt HTTP 200, Bundle-Marker,
Lovelace-Resource, Unload/erneutes Setup und Duplikatvermeidung ab. Bei
`resource_mode: yaml` bleibt die Resource-Liste absichtlich benutzerverwaltet;
dort muss die URL manuell als `type: module` eingetragen werden.
