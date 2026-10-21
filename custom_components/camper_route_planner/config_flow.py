"""Home Assistant Config Flow, with live Nakordoni routing kept disabled."""

from __future__ import annotations

from typing import Any

from .config_flow_support import normalize_api_key, validate_user_input
from .const import (CONF_API_KEY, CONF_CARTO_API_KEY, CONF_GEOCODING_API_KEY, CONF_LIVE_ENABLED, CONF_MAP_PROVIDER,
                    CONF_PROVIDER, CONF_REMOVE_API_KEY, CONF_REMOVE_CARTO_API_KEY, DOMAIN, MAP_PROVIDER_CARTO,
                    MAP_PROVIDER_NONE, PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME, CONF_REMOVE_GEOCODING_API_KEY, DEFAULT_ZOE_TRACKER)
from .models import VehicleProfile

try:  # Home Assistant is intentionally not required by the offline test runner.
    import voluptuous as vol
    from homeassistant import config_entries
    from homeassistant.const import CONF_NAME
    from homeassistant.helpers import selector

    def _api_key_selector():
        try:
            return selector.TextSelector({"type": "password"})
        except TypeError:  # pragma: no cover
            return selector.TextSelector(selector.TextSelectorConfig(type="password"))

    class CamperRoutePlannerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
        """Set up an isolated provider configuration."""

        VERSION = 1

        async def async_step_user(self, user_input: dict[str, Any] | None = None):
            errors: dict[str, str] = {}
            if user_input is not None:
                errors = validate_user_input(user_input)
                if not errors:
                    provider = user_input[CONF_PROVIDER]
                    api_key = normalize_api_key(user_input[CONF_API_KEY]) if provider in (PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME) else ""
                    return self.async_create_entry(title=user_input.get(CONF_NAME, "Camper Route Planner"), data={
                        CONF_PROVIDER: user_input[CONF_PROVIDER],
                        CONF_API_KEY: api_key,
                        CONF_LIVE_ENABLED: False,
                        CONF_MAP_PROVIDER: user_input.get(CONF_MAP_PROVIDER, MAP_PROVIDER_NONE),
                        CONF_CARTO_API_KEY: user_input.get(CONF_CARTO_API_KEY, "").strip(),
                        CONF_GEOCODING_API_KEY: "",
                    })
            schema = vol.Schema({vol.Required(CONF_NAME, default="Camper Route Planner"): str, vol.Required(CONF_PROVIDER, default=PROVIDER_MOCK): vol.In([PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME]), vol.Optional(CONF_API_KEY): _api_key_selector(), vol.Optional(CONF_MAP_PROVIDER, default=MAP_PROVIDER_NONE): vol.In([MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO]), vol.Optional(CONF_CARTO_API_KEY, default=""): str})
            return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

        @staticmethod
        def async_get_options_flow(config_entry):
            return CamperRoutePlannerOptionsFlow()


    class CamperRoutePlannerOptionsFlow(config_entries.OptionsFlow):
        """Edit non-secret provider settings without enabling live routing."""

        def _current_values(self) -> dict[str, Any]:
            """Return the effective values, with options overriding data."""
            return {**self.config_entry.data, **self.config_entry.options}

        async def async_step_init(self, user_input: dict[str, Any] | None = None):
            if user_input is not None:
                current = self._current_values()
                submitted = {**current, **user_input}
                provider = user_input.get(CONF_PROVIDER, current.get(CONF_PROVIDER, PROVIDER_MOCK))
                if provider not in (PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME):
                    submitted[CONF_API_KEY] = ""
                elif user_input.get(CONF_REMOVE_API_KEY):
                    submitted[CONF_API_KEY] = ""
                elif str(user_input.get(CONF_API_KEY, "")).strip():
                    submitted[CONF_API_KEY] = user_input[CONF_API_KEY]
                else:
                    submitted[CONF_API_KEY] = current.get(CONF_API_KEY, "")
                if not str(user_input.get(CONF_CARTO_API_KEY, "")).strip():
                    submitted[CONF_CARTO_API_KEY] = current.get(CONF_CARTO_API_KEY, "")
                if user_input.get(CONF_REMOVE_CARTO_API_KEY):
                    submitted[CONF_CARTO_API_KEY] = ""
                if user_input.get(CONF_REMOVE_GEOCODING_API_KEY):
                    submitted[CONF_GEOCODING_API_KEY] = ""
                elif str(user_input.get(CONF_GEOCODING_API_KEY, "")).strip():
                    submitted[CONF_GEOCODING_API_KEY] = user_input[CONF_GEOCODING_API_KEY].strip()
                else:
                    submitted[CONF_GEOCODING_API_KEY] = current.get(CONF_GEOCODING_API_KEY, "")
                errors = validate_user_input(submitted)
                if not errors:
                    if provider in (PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME):
                        submitted[CONF_API_KEY] = normalize_api_key(submitted[CONF_API_KEY])
                    self._provider_input = {
                        **current,
                        **user_input,
                        CONF_API_KEY: submitted.get(CONF_API_KEY, ""),
                        CONF_CARTO_API_KEY: submitted.get(CONF_CARTO_API_KEY, ""),
                        CONF_LIVE_ENABLED: False,
                    }
                    return await self.async_step_profile()
                return self.async_show_form(step_id="init", data_schema=self._schema(), errors=errors)
            return self.async_show_form(step_id="init", data_schema=self._schema())

        def _schema(self):
            current = self._current_values()
            return vol.Schema({vol.Required(CONF_PROVIDER, default=current.get(CONF_PROVIDER, PROVIDER_MOCK)): vol.In([PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME]), vol.Optional(CONF_API_KEY): _api_key_selector(), vol.Optional(CONF_REMOVE_API_KEY, default=False): bool, vol.Optional(CONF_MAP_PROVIDER, default=current.get(CONF_MAP_PROVIDER, MAP_PROVIDER_NONE)): vol.In([MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO]), vol.Optional(CONF_CARTO_API_KEY, default=""): str, vol.Optional(CONF_REMOVE_CARTO_API_KEY, default=False): bool, vol.Optional(CONF_GEOCODING_API_KEY): _api_key_selector(), vol.Optional(CONF_REMOVE_GEOCODING_API_KEY, default=False): bool})

        async def async_step_profile(self, user_input: dict[str, Any] | None = None):
            errors: dict[str, str] = {}
            if user_input is not None:
                try:
                    profile = VehicleProfile(
                        profile_id=user_input["profile_id"], name=user_input["name"], vehicle_kind=user_input["vehicle_kind"],
                        height_m=float(user_input["height_m"]), width_m=float(user_input["width_m"]), length_m=float(user_input["length_m"]),
                        gross_weight_kg=int(user_input["gross_weight_kg"]), fuel_type=user_input["fuel_type"],
                        axles=int(user_input.get("axles", 2)),
                        tracker_entity_id=(user_input.get("tracker_entity_id") or (DEFAULT_ZOE_TRACKER if str(user_input["name"]).strip().casefold() == "zoe" else None)),
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
                vol.Optional("tracker_entity_id", default=""): str,
            })
            return self.async_show_form(step_id="profile", data_schema=schema, errors=errors)

except ImportError:  # pragma: no cover - exercised only where HA is absent.
    CamperRoutePlannerConfigFlow = None  # type: ignore[assignment,misc]
    CamperRoutePlannerOptionsFlow = None  # type: ignore[assignment,misc]
