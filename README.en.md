# Camper Route Planner

![Camper Route Planner](assets/logo.svg)

Home Assistant custom integration for manual route planning with vehicle
profiles, an interactive map, saved routes, and GPX export.

> **Status:** `v0.1.0` Stable. The Lovelace card is validated with an isolated
> HA 2026.10.1 fixture, Chromium, and the practical iPhone navigation test.
> Nakordoni motorhome routing remains explicitly manual with no automatic fallback.

[Deutsche Version](README.md) · [Documentation](docs/)

![Desktop](assets/screenshots/desktop.png)
![Mobile](assets/screenshots/mobile.png)

## Implemented

- vehicle profiles with dimensions, weight, and vehicle type
- origin, destination, and waypoints
- manual calculation after explicit user action
- CARTO map integration with SVG fallback
- deterministic mock routing for offline tests
- Nakordoni motorhome routing with configured vehicle parameters
- saving and loading calculated routes
- GPX route, track, and combined export
- Navigation handoff to iOS/Android map apps with a desktop fallback; GPX export remains available
- German and English UI text
- always-visible Leaflet map with draggable markers and map selection
- per-vehicle GPS start point; Zoe defaults to `device_tracker.wohnmobil_zoe`
- Geoapify address search and reverse geocoding through the HA Options Flow (backend-only, mockable)

## Supported limitations

- Route calculation starts only after an explicit user action.
- External navigation apps may recalculate routes and ignore vehicle parameters;
  GPX remains the reliable handoff for complex motorhome routes.

Truck routing must not be presented as safe motorhome navigation before the
real motorhome profile is available and validated. There is no silent truck
fallback for motorhome mode.

## Installation and configuration

The Stable release can be installed as a HACS custom repository or by copying the
integration to `custom_components/camper_route_planner/`, then setting it up
through **Settings → Devices & services**. The Options Flow offers `Nakordoni`
(internally `nakordoni_motorhome`) and `Mock (offline)`. Vehicle changes default
to no changes; provider/key updates preserve existing profiles, IDs, and tracker
assignments.

The map supports a browser-safe CARTO configuration and an SVG fallback. No
credentials belong in the frontend, screenshots, logs, GPX files, or Git.
Route calculation is manual only; GPS changes, Home Assistant startup,
reloads, and opening the card do not trigger routing.

### Geoapify address search and privacy

The Phase 3B candidate uses Geoapify Address Autocomplete behind a backend
Home Assistant WebSocket boundary. The Geoapify key is stored only through the
Home Assistant Options Flow and is never sent to Lovelace, the browser, logs,
diagnostic exports, or GitHub. Queries are sent to Geoapify when search is
enabled; the UI displays a privacy notice and Geoapify/OpenStreetMap
attribution. Debouncing, result limits, local rate limiting, and caching reduce
unnecessary requests. Without a key, the map, GPS, and manual coordinates remain
available. Reverse geocoding resolves GPS, map, and dragged marker positions to
readable addresses after a short delay; repeated coordinates use the cache.
Coordinates remain authoritative when no address is returned.

The Stable release contains the corrected iOS and Android navigation handoff
using the proven direct HTTPS-anchor pattern from Mobile Fuel Stations,
complete vehicle-management labels, the cleaned provider selection,
multi-vehicle management, GPX route/track/combined export, and the
non-destructive Options Flow. The user completed live route and iPhone tests;
automated tests continue to use only mocked APIs and isolated fixtures.

## Nakordoni status

According to support ticket #230, `GET /api/v2/data/truck-route` is accessible
with the existing access. This project has not made a live request. Truck
routing has a separate daily quota: Explorer 10 and Starter 300 routes/day,
with additional quota possible.

`vehicle_type=motorhome` is available only through the explicitly visible
`Nakordoni` provider and its controlled beta runtime path.
The profile carries motorhome dimensions, weight, and axles without EU truck
driving/rest-time fields. The personal key is sent only through Home
Assistant's transport; Mock is never an automatic fallback. Traffic signs and
applicable regulations take precedence.

Nakordoni is expected to register a dedicated OAuth client after receiving the
repository URL. The Mobile Fuel Stations client will not be reused. Each user
uses their own Nakordoni account and routing quota.

See the [planning update](docs/NAKORDONI-PLANUNGSUPDATE-2026-10-16.md),
[API audit](docs/NAKORDONI-API-AUDIT.md), and
[Phase 2F–2I plan](docs/PHASE2F-2I-PLAN.md).

## Security and limitations

- no production secrets or tokens in the repository
- no direct browser calls to Nakordoni
- no automatic route calculation or mock fallback after provider errors
- no automatic route calculation
- unknown restrictions are not treated as a clear road
- truck tolls, truck restrictions, and rest planning are not automatically
  valid for private motorhomes

## Development and tests

```bash
PYTHONPATH=src:. python3 -m unittest discover -s tests -v
python3 -m compileall -q src tests custom_components
cd frontend
npm ci
npm test
npm run build
npm run test:e2e
```

See the [Stable release notes](docs/releases/v0.1.0.md) for the installation and
test evidence. Hassfest and GitHub-side validation run through
`.github/workflows/validate.yml`; the public repository is validated by GitHub
Actions. Installation into productive HA systems remains an operator action.

## Roadmap

1. Stable `v0.1.0` is published and remains an independent fallback basis.
2. Further features require a separate change request.
3. Migration to the discontinued SmartCamper Suite is outside this release;
   the Suite remains only as a historical, discontinued repository.

## Nakordoni motorhome (provider status)

The internal provider ID remains `nakordoni_motorhome` behind the visible provider label `Nakordoni`. The provider may still label the motorhome profile as beta; traffic signs and applicable regulations take precedence. There is no automatic switch from the mock provider.

OAuth/PKCE remains a later optional alternative. The Mobile Fuel Stations OAuth
client is not reused.

Route data is attributed to [Data by nakordoni.eu](https://nakordoni.eu). The routing API is officially documented on `nakordoni.eu`; OAuth and Account Usage use `api.nakordoni.dev`. See [Phase 2H](docs/PHASE2H-IMPLEMENTATION.md), [API hosts](docs/NAKORDONI-API-HOSTS.md), [OAuth](docs/NAKORDONI-OAUTH.md), [quotas](docs/NAKORDONI-QUOTAS.md), and [tolls](docs/NAKORDONI-TOLLS.md).

## License

MIT. See [LICENSE](LICENSE).
