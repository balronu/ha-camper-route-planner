"""Provider protocol and shared typing."""

from __future__ import annotations

from typing import Protocol

from ..models import ProviderCapabilities, RouteRequest, RouteResult


class RoutingProvider(Protocol):
    """Provider-neutral route calculation boundary."""

    name: str
    capabilities: ProviderCapabilities

    async def calculate(self, request: RouteRequest) -> RouteResult:
        """Calculate a route only when called explicitly."""
