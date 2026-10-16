# Camper Route Planner

![Camper Route Planner](assets/logo.svg)

Home Assistant custom integration for manual route planning with vehicle
profiles, an interactive map, saved routes, and GPX export.

> **Status:** local Stable preparation, no published release yet. The current
> implementation uses deterministic mock routing only and is not verified
> motorhome navigation.

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

## Not available yet

- production Nakordoni routing
- a dedicated Nakordoni OAuth client
- Nakordoni `vehicle_type=motorhome`
- verified motorhome navigation
- automatic Lovelace resource registration

Truck routing must not be presented as safe motorhome navigation before the
real motorhome profile is available and validated. There is no silent truck
fallback for motorhome mode.

## Installation and configuration

The repository is structured for a future HACS custom integration. There is no
installation approval yet. After a future release, install through HACS or
copy the integration to `custom_components/camper_route_planner/`, then set it
up through **Settings → Devices & services**. The current local mode uses the
mock provider.

The map supports a browser-safe CARTO configuration and an SVG fallback. No
credentials belong in the frontend, screenshots, logs, GPX files, or Git.
Route calculation is manual only; GPS changes, Home Assistant startup,
reloads, and opening the card do not trigger routing.

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

See [the Phase 2E report](docs/PHASE2E-TEST-REPORT.md) for the current test
matrix and blockers. Hassfest and GitHub-side validation run through
`.github/workflows/validate.yml`; the public repository is already validated by
GitHub Actions. This result is not a Stable or installation-approval gate.

## Roadmap

1. **Phase 2F:** public repository, branding, documentation, and validation
   (completed).
2. **Phase 2G:** controlled truck adapter after contract, OAuth, and quota
   approval.
3. **Phase 2H:** motorhome contract and schema after actual provider release.
4. **Phase 2I:** conservative preparation of `v0.1.0 Stable`.

## License

MIT. See [LICENSE](LICENSE).
