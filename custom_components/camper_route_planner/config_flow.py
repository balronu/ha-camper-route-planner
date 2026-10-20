"""Home Assistant Config Flow, with live Nakordoni routing kept disabled."""

from __future__ import annotations

from typing import Any

from .config_flow_support import validate_user_input
from .const import (CONF_API_KEY, CONF_CARTO_API_KEY, CONF_LIVE_ENABLED, CONF_MAP_PROVIDER,
                    CONF_PROVIDER, CONF_REMOVE_CARTO_API_KEY, DOMAIN, MAP_PROVIDER_CARTO,
                    MAP_PROVIDER_NONE, PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME)
from .models import VehicleProfile

try:  # Home Assistant is intentionally not required by the offline test runner.
    import voluptuous as vol
    from homeassistant import config_entries
    from homeassistant.const import CONF_NAME

    class CamperRoutePlannerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
        """Set up an isolated provider configuration."""

        VERSION = 1

        async def async_step_user(self, user_input: dict[str, Any] | None = None):
            errors: dict[str, str] = {}
            if user_input is not None:
                errors = validate_user_input(user_input)
                if not errors:
                    return self.async_create_entry(title=user_input.get(CONF_NAME, "Camper Route Planner"), data={
                        CONF_PROVIDER: user_input[CONF_PROVIDER],
                        CONF_API_KEY: user_input.get(CONF_API_KEY),
                        CONF_LIVE_ENABLED: False,
                        CONF_MAP_PROVIDER: user_input.get(CONF_MAP_PROVIDER, MAP_PROVIDER_NONE),
                        CONF_CARTO_API_KEY: user_input.get(CONF_CARTO_API_KEY, "").strip(),
                    })
            schema = vol.Schema({vol.Required(CONF_NAME, default="Camper Route Planner"): str, vol.Required(CONF_PROVIDER, default=PROVIDER_MOCK): vol.In([PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME]), vol.Optional(CONF_API_KEY): str, vol.Optional(CONF_MAP_PROVIDER, default=MAP_PROVIDER_NONE): vol.In([MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO]), vol.Optional(CONF_CARTO_API_KEY, default=""): str})
            return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

        @staticmethod
        def async_get_options_flow(config_entry):
            return CamperRoutePlannerOptionsFlow(config_entry)


    class CamperRoutePlannerOptionsFlow(config_entries.OptionsFlow):
        """Edit non-secret provider settings without enabling live routing."""

        def __init__(self, config_entry) -> None:
            self.config_entry = config_entry

        async def async_step_init(self, user_input: dict[str, Any] | None = None):
            if user_input is not None:
                current = {**self.config_entry.data, **self.config_entry.options}
                submitted = {**current, **user_input}
                if not str(user_input.get(CONF_CARTO_API_KEY, "")).strip():
                    submitted[CONF_CARTO_API_KEY] = current.get(CONF_CARTO_API_KEY, "")
                if user_input.get(CONF_REMOVE_CARTO_API_KEY):
                    submitted[CONF_CARTO_API_KEY] = ""
                errors = validate_user_input(submitted)
                if not errors:
                    self._provider_input = {**user_input, CONF_CARTO_API_KEY: submitted.get(CONF_CARTO_API_KEY, ""), CONF_LIVE_ENABLED: False}
                    return await self.async_step_profile()
                return self.async_show_form(step_id="init", data_schema=self._schema(), errors=errors)
            return self.async_show_form(step_id="init", data_schema=self._schema())

        def _schema(self):
            return vol.Schema({vol.Required(CONF_PROVIDER, default=self.config_entry.data.get(CONF_PROVIDER, PROVIDER_MOCK)): vol.In([PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME]), vol.Optional(CONF_API_KEY): str, vol.Optional(CONF_MAP_PROVIDER, default=self.config_entry.data.get(CONF_MAP_PROVIDER, MAP_PROVIDER_NONE)): vol.In([MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO]), vol.Optional(CONF_CARTO_API_KEY, default=""): str, vol.Optional(CONF_REMOVE_CARTO_API_KEY, default=False): bool})

        async def async_step_profile(self, user_input: dict[str, Any] | None = None):
            errors: dict[str, str] = {}
            if user_input is not None:
                try:
                    profile = VehicleProfile(
                        profile_id=user_input["profile_id"], name=user_input["name"], vehicle_kind=user_input["vehicle_kind"],
                        height_m=float(user_input["height_m"]), width_m=float(user_input["width_m"]), length_m=float(user_input["length_m"]),
                        gross_weight_kg=int(user_input["gross_weight_kg"]), fuel_type=user_input["fuel_type"],
                        axles=int(user_input.get("axles", 2)),
                    )
                    runtime = self.hass.data.get(DOMAIN, {}).get(self.config_entry.entry_id)
                    if runtime is not None:
                        await runtime.store.async_save_profile(profile)
                    return self.async_create_entry(data=getattr(self, "_provider_input", {CONF_LIVE_ENABLED: False}))
                except (KeyError, TypeError, ValueError) as exc:
                    errors = {"base": "invalid_profile"}
            schema = vol.Schema({
                vol.Required("profile_id"): str,
                vol.Required("name"): str,
                vol.Required("vehicle_kind", default="motorhome"): vol.In(["motorhome", "truck", "car"]),
                vol.Required("height_m", default=3.2): vol.Coerce(float),
                vol.Required("width_m", default=2.34): vol.Coerce(float),
                vol.Required("length_m", default=7.65): vol.Coerce(float),
                vol.Required("gross_weight_kg", default=4800): vol.Coerce(int),
                vol.Required("fuel_type", default="diesel"): vol.In(["diesel", "petrol", "electric", "hybrid", "other"]),
                vol.Required("axles", default=2): vol.Coerce(int),
            })
            return self.async_show_form(step_id="profile", data_schema=schema, errors=errors)

except ImportError:  # pragma: no cover - exercised only where HA is absent.
    CamperRoutePlannerConfigFlow = None  # type: ignore[assignment,misc]
    CamperRoutePlannerOptionsFlow = None  # type: ignore[assignment,misc]
