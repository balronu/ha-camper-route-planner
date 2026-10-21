# Camper Route Planner

![Camper Route Planner](assets/logo.svg)

Home Assistant custom integration for manual route planning with vehicle
profiles, an interactive map, saved routes, and GPX export.

> **Status:** `v0.1.0-beta.18` pre-release. The Lovelace card is validated with
> an isolated HA 2026.10.1 fixture and Chromium. The current implementation
> uses deterministic mock routing only and is not verified motorhome navigation.

[Deutsche Version](README.md) · [Documentation](docs/)

![Desktop](assets/screenshots/desktop.png)
![Mobile](assets/screenshots/mobile.png)

## Implemented

- vehicle profiles with dimensions, weight, and vehicle type
- origin, destination, and waypoints
- manual calculation after explicit user action
- CARTO map integration with SVG fallback
- deterministic mock routing for offline tests
- saving and loading synthetic routes
- GPX route, track, and combined export
- German and English UI text
- always-visible Leaflet map with draggable markers and map selection
- per-vehicle GPS start point; Zoe defaults to `device_tracker.wohnmobil_zoe`
- Geoapify address search and reverse geocoding through the HA Options Flow (backend-only, mockable)

## Not available yet

- production Nakordoni routing
- Nakordoni `vehicle_type=motorhome`
- verified motorhome navigation
- real Nakordoni/provider live validation

Truck routing must not be presented as safe motorhome navigation before the
real motorhome profile is available and validated. There is no silent truck
fallback for motorhome mode.

## Installation and configuration

The beta can be installed as a HACS custom repository or by copying the
integration to `custom_components/camper_route_planner/`, then setting it up
through **Settings → Devices & services**. The current local mode uses the
mock provider.

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

Beta.11 contains the Phase 3H branding, map, vehicle, translation, and
Options Flow fixes. Live Geoapify calls and the
productive HA presentation have not been validated; VM 104 and the productive
Home Assistant system remain unchanged.

## Nakordoni status

According to support ticket #230, `GET /api/v2/data/truck-route` is accessible
with the existing access. This project has not made a live request. Truck
routing has a separate daily quota: Explorer 10 and Starter 300 routes/day,
with additional quota possible.

`vehicle_type=motorhome` is not available yet. An initial beta was tentatively
forecast for around 26 October 2026. The planned profile is expected to cover
motorhome dimensions, weight limits, motorhome-specific prohibitions and toll
rules, without EU truck driving/rest-time planning. This forecast is not a
release gate.

Nakordoni is expected to register a dedicated OAuth client after receiving the
repository URL. The Mobile Fuel Stations client will not be reused. Each user
uses their own Nakordoni account and routing quota.

See the [planning update](docs/NAKORDONI-PLANUNGSUPDATE-2026-10-16.md),
[API audit](docs/NAKORDONI-API-AUDIT.md), and
[Phase 2F–2I plan](docs/PHASE2F-2I-PLAN.md).

## Security and limitations

- no production secrets or tokens in the repository
- no direct browser calls to Nakordoni
- no live routing or live CARTO requests in this development phase
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

See the [beta.18 release notes](docs/releases/v0.1.0-beta.18.md) for the
installation and test evidence. Hassfest and GitHub-side validation run through
`.github/workflows/validate.yml`; the public repository is already validated by
GitHub Actions. A Stable release and productive HA installation are outside
the scope of this beta.

## Roadmap

1. **Phase 2F:** independent repository, branding, documentation, and
   validation.
2. **Phase 2G:** offline preparation of the Nakordoni Motorhome beta provider,
   OAuth/PKCE, quota, and toll contracts.
3. **Phase 2H:** offline provider, OAuth/PKCE preparation, and CI.
4. **Phase 2I:** personal API keys, dry-run test tooling, and live test plan;
   no release without a result report and documented approval.
5. **Phase 2J:** isolated internal-beta installation, lifecycle, and rollback
   planning; no installation or live request has been performed.
6. **Phase 2K:** embedded frontend, installable internal ZIP, and isolated
   package validation; no installation or live request has been performed.

## Phase 2G/2H: Nakordoni Motorhome beta

The `nakordoni_motorhome` provider is prepared locally as an offline/fixture provider, but is not enabled for production. Nakordoni Motorhome is a beta; traffic signs and applicable regulations take precedence. There is no automatic switch from the mock provider and no verified motorhome navigation claim.

OAuth/PKCE remains a later optional alternative for v0.1.0 Stable. The Mobile
Fuel Stations OAuth client is not reused. No live routing requests were made
in Phase 2I.

Route data is attributed to [Data by nakordoni.eu](https://nakordoni.eu). The routing API is officially documented on `nakordoni.eu`; OAuth and Account Usage use `api.nakordoni.dev`. See [Phase 2H](docs/PHASE2H-IMPLEMENTATION.md), [API hosts](docs/NAKORDONI-API-HOSTS.md), [OAuth](docs/NAKORDONI-OAUTH.md), [quotas](docs/NAKORDONI-QUOTAS.md), and [tolls](docs/NAKORDONI-TOLLS.md).

## License

MIT. See [LICENSE](LICENSE).
