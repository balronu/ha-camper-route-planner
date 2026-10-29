"""Native Home Assistant diagnostics for the loaded config entry."""

from __future__ import annotations

from typing import Any

from .const import DOMAIN


async def async_get_config_entry_diagnostics(hass: Any, entry: Any) -> dict[str, Any]:
    """Return the volatile, secret-free diagnostic snapshot."""
    runtime = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if runtime is None:
        return {
            "configured_provider": None,
            "route_calls": {"v2": 0, "v3": 0},
            "last_operation": None,
            "status": "not_loaded",
        }
    return runtime.diagnostics()
