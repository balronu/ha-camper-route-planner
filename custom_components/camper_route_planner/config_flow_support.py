"""HA-independent validation helpers used by Config/Options Flow tests."""

from __future__ import annotations

from typing import Any

from .const import MAP_PROVIDER_CARTO, MAP_PROVIDER_NONE, PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME
from .map_provider import validate_carto_browser_key


def normalize_api_key(value: Any) -> str:
    """Validate a user-owned Nakordoni key without exposing its value."""
    if not isinstance(value, str):
        raise ValueError("api key is required")
    if any(ord(char) < 32 for char in value):
        raise ValueError("api key contains invalid characters")
    key = value.strip()
    if not 16 <= len(key) <= 256:
        raise ValueError("api key has an invalid length")
    if any(char.isspace() or ord(char) < 32 for char in key):
        raise ValueError("api key contains invalid characters")
    return key


def validate_user_input(user_input: dict[str, Any]) -> dict[str, str]:
    provider = str(user_input.get("provider", "")).strip()
    if provider not in (PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME):
        return {"base": "invalid_provider"}
    if provider in (PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME) and user_input.get("live_enabled", False):
        return {"base": "live_routing_requires_separate_phase"}
    if provider in (PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME):
        try:
            normalize_api_key(user_input.get("api_key"))
        except ValueError:
            return {"api_key": "invalid_api_key"}
    map_provider = str(user_input.get("map_provider", MAP_PROVIDER_NONE) or MAP_PROVIDER_NONE).strip().lower()
    if map_provider not in (MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO):
        return {"base": "invalid_map_provider"}
    if map_provider == MAP_PROVIDER_CARTO:
        try:
            validate_carto_browser_key(user_input.get("carto_api_key"))
        except ValueError as exc:
            return {"carto_api_key": str(exc)}
    return {}
