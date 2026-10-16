"""Safe, HA-independent map-provider configuration.

Only a CARTO Basemaps key explicitly approved for browser use may be sent to
the card. General/private credentials are never treated as browser-safe.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote
from typing import Any

from .const import CARTO_TILE_ATTRIBUTION, CARTO_TILE_URL, MAP_PROVIDER_CARTO, MAP_PROVIDER_NONE


@dataclass(frozen=True)
class MapProviderConfig:
    provider: str
    status: str
    tile_url: str | None = None
    tile_attribution: str | None = None
    error_code: str | None = None
    browser_safe: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "status": self.status,
            "tile_url": self.tile_url,
            "tile_attribution": self.tile_attribution,
            "error_code": self.error_code,
            "browser_safe": self.browser_safe,
        }


def validate_carto_browser_key(value: Any) -> str:
    """Validate syntax only; public/browser-safe classification is explicit policy."""
    key = str(value or "").strip()
    if not key:
        raise ValueError("carto_key_required")
    if len(key) > 256 or any(character.isspace() or ord(character) < 32 for character in key):
        raise ValueError("carto_key_invalid")
    return key


def build_map_config(values: dict[str, Any] | None) -> MapProviderConfig:
    values = values or {}
    provider = str(values.get("map_provider", MAP_PROVIDER_NONE) or MAP_PROVIDER_NONE).strip().lower()
    if provider == MAP_PROVIDER_NONE:
        return MapProviderConfig(provider=MAP_PROVIDER_NONE, status="not_configured")
    if provider != MAP_PROVIDER_CARTO:
        return MapProviderConfig(provider=provider, status="invalid", error_code="map_provider_invalid")
    try:
        key = validate_carto_browser_key(values.get("carto_api_key"))
    except ValueError as exc:
        return MapProviderConfig(provider=MAP_PROVIDER_CARTO, status="invalid", error_code=str(exc))
    return MapProviderConfig(
        provider=MAP_PROVIDER_CARTO,
        status="configured",
        tile_url=CARTO_TILE_URL.replace("{key}", quote(key, safe="")),
        tile_attribution=CARTO_TILE_ATTRIBUTION,
        browser_safe=True,
    )
