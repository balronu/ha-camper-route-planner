"""HA-independent validation helpers used by Config/Options Flow tests."""

from __future__ import annotations

from typing import Any

from .const import MAP_PROVIDER_CARTO, MAP_PROVIDER_NONE, PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME
from .map_provider import validate_carto_browser_key


def validate_user_input(user_input: dict[str, Any]) -> dict[str, str]:
    provider = str(user_input.get("provider", "")).strip()
    if provider not in (PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME):
        return {"base": "invalid_provider"}
    if provider == PROVIDER_NAKORDONI and not str(user_input.get("api_key", "")).strip():
        return {"api_key": "required_for_nakordoni"}
    if provider in (PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME) and user_input.get("live_enabled", False):
        return {"base": "live_routing_requires_separate_phase"}
    map_provider = str(user_input.get("map_provider", MAP_PROVIDER_NONE) or MAP_PROVIDER_NONE).strip().lower()
    if map_provider not in (MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO):
        return {"base": "invalid_map_provider"}
    if map_provider == MAP_PROVIDER_CARTO:
        try:
            validate_carto_browser_key(user_input.get("carto_api_key"))
        except ValueError as exc:
            return {"carto_api_key": str(exc)}
    return {}
