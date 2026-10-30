# Camper Route Planner

![Camper Route Planner](assets/logo.svg)

Plan motorhome trips directly in Home Assistant with your own vehicle profile,
custom waypoints, and routes that can account for your vehicle's dimensions and
weight.

Camper Route Planner combines a clear Lovelace card with the routing technology
of [NaKordoni](https://nakordoni.eu), keeping route planning, vehicle data, and
travel documents together.

> **v0.1.5 Stable** is published. The Stable version passed automated checks
> and was successfully verified with a real NaKordoni v3 route calculation.
> This integration is a planning tool, not a replacement for a dedicated
> motorhome navigation device.
>
> **v0.1.6-beta.11** is available as an optional diagnostic preview release.
> It adds a protected one-shot diagnostic for parser errors with safe
> transport metadata, request ID, and response field types, without storing
> complete provider responses or credentials. The beta 10 POI features and
> map regressions remain covered.
> v0.1.5 remains the current Stable version for production use.

[Deutsche Version](README.md) · [Documentation](docs/) · [Releases](https://github.com/balronu/ha-camper-route-planner/releases)

![Desktop](assets/screenshots/desktop.png)
![Mobile](assets/screenshots/mobile.png)

## Built for motorhome trip planning

- **Motorhome vehicle profiles:** Store vehicle type, length, width, height,
  weight, axle count, and optional fuel data.
- **Flexible routes:** Plan an origin, destination, and waypoints with route
  types, avoidance options, and optional departure or arrival times.
- **NaKordoni routing:** Use the visible NaKordoni provider with your own
  credentials, or the offline mock for tests.
- **Map and trip overview:** See the route, distance, duration, notices, border
  crossings, and available toll information in Home Assistant.
- **Saved routes:** Save plans, load them later, and recalculate them from the
  stored inputs. If inputs change or recalculation fails, an existing result is
  marked as outdated.
- **Travel documents:** Export a route, track, or combined GPX file and create
  a PDF travel plan. Routes can also be handed off to Apple Maps, Google Maps,
  or OpenStreetMap.
- **Fuel planning:** Estimate range, consumption, cost, and potential extra fuel
  needs from your vehicle data.
- **Phone and tablet friendly:** The Lovelace card is designed for desktop and
  mobile Home Assistant dashboards.

## Working with NaKordoni

Camper Route Planner uses the NaKordoni routing API and sends the vehicle data
configured for the route request. Technical exchange with the NaKordoni team
has helped make the motorhome support more practical. This does not claim a
formal partnership or endorsement by NaKordoni.

NaKordoni API v2 and v3 are handled as separate paths. Toll data can be
complete, estimated, or incomplete depending on the route and API version; the
UI keeps those distinctions visible. Personal API credentials are managed
through Home Assistant's Config/Options Flow and are not sent to the browser,
screenshots, GPX files, or logs.

## Usage and privacy

Route calculation starts only after an explicit user action. Optional departure
and arrival times are sent only when set. Developer diagnostics are hidden by
default, available only to Home Assistant administrators, and enabled per card.
A request diagnostic applies to one backend attempt; the sanitized report can
then be copied. Location data, waypoints, and credentials are sensitive and
should only be shared through trusted support channels.

## Known limitations

- A calculated route is not legal clearance. Check height and weight limits,
  signs, environmental zones, tolls, and local driving rules before and during
  every trip.
- External navigation apps may recalculate the route or only partially accept
  vehicle data and waypoints. GPX is the more reliable handoff for complex
  motorhome routes.
- Toll, border, and traffic data depend on the provider response. Missing or
  estimated values are not presented as binding information.
- The NaKordoni motorhome path may still be labelled a beta profile by the
  provider. There is no silent switch to truck routing and no automatic mock
  fallback on provider errors.
- Fuel planning is a local estimate. Tank stops are not booked automatically or
  presented as binding travel instructions.

## Installation

Until the integration is listed in the official HACS catalog, install Camper
Route Planner as a **Custom Repository**:

1. In HACS, open **Integrations → ⋮ → Custom repositories**.
2. Add `balronu/ha-camper-route-planner` with category **Integration**.
3. For production use, install the regular Stable version `v0.1.5`.
   `v0.1.6-beta.11` is intended for testing through pre-releases or the release
   ZIP. Restart Home Assistant when prompted.
4. Set up the integration under **Settings → Devices & services**, then add
   the Lovelace card to your dashboard.

Alternatively, extract the release ZIP into
`custom_components/camper_route_planner/`. The complete
[HACS/install guide](docs/HACS-INSTALLATION.md), configuration details, and
rollback notes remain available in the technical documentation. The official
HACS catalog status is tracked in the [HACS documentation](docs/HACS-INSTALLATION.md);
catalog inclusion is not assumed.

## Further documentation

- [Vehicle profiles](docs/VEHICLE-PROFILES.md)
- [Lovelace card](docs/LOVELACE-CARD.md)
- [GPX and PDF export](docs/GPX-EXPORT.md)
- [NaKordoni API and toll data](docs/NAKORDONI-API-AUDIT.md)
- [Security and privacy](docs/SECURITY-AND-PRIVACY.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [v0.1.5 release notes](docs/releases/v0.1.5.md)
- [v0.1.6-beta.1 release notes](docs/releases/v0.1.6-beta.1.md)
- [v0.1.6-beta.2 release notes](docs/releases/v0.1.6-beta.2.md)
- [v0.1.6-beta.3 release notes](docs/releases/v0.1.6-beta.3.md)
- [v0.1.6-beta.4 release notes](docs/releases/v0.1.6-beta.4.md)
- [v0.1.6-beta.5 release notes](docs/releases/v0.1.6-beta.5.md)
- [v0.1.6-beta.6 release notes](docs/releases/v0.1.6-beta.6.md)
- [v0.1.6-beta.7 release notes](docs/releases/v0.1.6-beta.7.md)
- [v0.1.6-beta.8 release notes](docs/releases/v0.1.6-beta.8.md)
- [v0.1.6-beta.9 release notes](docs/releases/v0.1.6-beta.9.md)
- [v0.1.6-beta.10 release notes](docs/releases/v0.1.6-beta.10.md)
- [v0.1.6-beta.11 release notes](docs/releases/v0.1.6-beta.11.md)
- [NaKordoni POI concept](docs/NAKORDONI-POI-CONCEPT.md)

## License

MIT. See [LICENSE](LICENSE).
