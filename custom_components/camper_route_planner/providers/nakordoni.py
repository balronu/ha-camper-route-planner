"""Offline-only Nakordoni adapter skeleton.

The adapter contains parameter and fixture normalization only. ``calculate``
is deliberately feature-gated and never performs an implicit network request.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..models import (
    ProviderCapabilities,
    ProviderError,
    RouteGeometry,
    RouteRequest,
    RouteResult,
    RouteWarning,
    RouteWaypoint,
)


@dataclass(slots=True)
class NakordoniRoutingProvider:
    api_key: str | None = None
    live_enabled: bool = False
    timeout_s: float = 10.0
    name: str = "nakordoni"

    @property
    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities("nakordoni", False, True, True, True, "disabled" if not self.live_enabled else "unverified")

    async def calculate(self, request: RouteRequest) -> RouteResult:
        del request
        if not self.api_key:
            raise ProviderError(
                "Nakordoni API key is missing; configure it in the integration options.",
                code="missing_api_key",
                status=401,
            )
        raise ProviderError(
            "Nakordoni live routing is disabled in Phase 2A",
            code="live_routing_disabled",
            status=403,
        )

    def build_parameters(self, request: RouteRequest) -> dict[str, Any]:
        """Build a redacted, provider-shaped parameter mapping for tests."""
        return {
            "from": f"{request.origin.latitude},{request.origin.longitude}",
            "to": f"{request.destination.latitude},{request.destination.longitude}",
            "via": [f"{p.latitude},{p.longitude}" for p in request.waypoints],
            "height": request.vehicle.height_m,
            "width": request.vehicle.width_m,
            "length": request.vehicle.length_m,
            "weight": request.vehicle.gross_weight_kg / 1000,
            "traffic": request.traffic,
            "alternatives": request.alternatives,
            "geometry": request.geometry_format,
        }

    def normalize_fixture(self, payload: dict[str, Any]) -> RouteResult:
        if payload.get("ok") is not True:
            error = payload.get("error", {})
            raise ProviderError("Nakordoni fixture rejected request", code=error.get("code", "provider_error"), status=payload.get("status"))
        try:
            route = payload["data"]["route"]
            points = tuple(RouteWaypoint(float(p[0]), float(p[1])) for p in route["geometry"])
            warnings = tuple(RouteWarning(str(item.get("code", "provider_warning")), str(item.get("message", "Provider warning"))) for item in route.get("warnings", []))
            return RouteResult("nakordoni", float(route["distance_m"]), int(route["duration_s"]), RouteGeometry(points), warnings, {"fixture": True}, False)
        except (KeyError, TypeError, ValueError, IndexError) as exc:
            raise ProviderError("Invalid Nakordoni fixture", code="invalid_response") from exc
