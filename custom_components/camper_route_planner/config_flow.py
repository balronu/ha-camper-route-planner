"""Home Assistant Config/Options Flow for provider, map and vehicle settings."""

from __future__ import annotations

from typing import Any

from .config_flow_support import normalize_api_key, validate_user_input
from .const import (
    CONF_API_KEY, CONF_CARTO_API_KEY, CONF_GEOCODING_API_KEY, CONF_LIVE_ENABLED,
    CONF_MAP_PROVIDER, CONF_PROVIDER, CONF_REMOVE_API_KEY,
    CONF_REMOVE_CARTO_API_KEY, CONF_REMOVE_GEOCODING_API_KEY, DEFAULT_ZOE_TRACKER,
    DOMAIN, MAP_PROVIDER_CARTO, MAP_PROVIDER_NONE, PROVIDER_MOCK,
    PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME,
)
from .models import VehicleProfile

try:
    import voluptuous as vol
    from homeassistant import config_entries
    from homeassistant.const import CONF_NAME
    from homeassistant.helpers import selector

    def _api_key_selector():
        try:
            return selector.TextSelector({"type": "password"})
        except TypeError:  # pragma: no cover
            return selector.TextSelector(selector.TextSelectorConfig(type="password"))

    def _entity_selector():
        try:
            return selector.EntitySelector({"domain": "device_tracker"})
        except TypeError:  # pragma: no cover
            return selector.EntitySelector(selector.EntitySelectorConfig(domain="device_tracker"))

    class CamperRoutePlannerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
        VERSION = 1

        async def async_step_user(self, user_input: dict[str, Any] | None = None):
            errors: dict[str, str] = {}
            if user_input is not None:
                errors = validate_user_input(user_input)
                if not errors:
                    provider = user_input[CONF_PROVIDER]
                    api_key = normalize_api_key(user_input[CONF_API_KEY]) if provider in (PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME) else ""
                    return self.async_create_entry(title=user_input.get(CONF_NAME, "Camper Route Planner"), data={
                        CONF_PROVIDER: provider, CONF_API_KEY: api_key, CONF_LIVE_ENABLED: False,
                        CONF_MAP_PROVIDER: user_input.get(CONF_MAP_PROVIDER, MAP_PROVIDER_NONE),
                        CONF_CARTO_API_KEY: user_input.get(CONF_CARTO_API_KEY, "").strip(),
                        CONF_GEOCODING_API_KEY: user_input.get(CONF_GEOCODING_API_KEY, "").strip(),
                    })
            schema = vol.Schema({
                vol.Required(CONF_NAME, default="Camper Route Planner"): str,
                vol.Required(CONF_PROVIDER, default=PROVIDER_MOCK): vol.In([PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME]),
                vol.Optional(CONF_API_KEY): _api_key_selector(),
                vol.Optional(CONF_MAP_PROVIDER, default=MAP_PROVIDER_NONE): vol.In([MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO]),
                vol.Optional(CONF_CARTO_API_KEY, default=""): str,
                vol.Optional(CONF_GEOCODING_API_KEY, default=""): _api_key_selector(),
            })
            return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

        @staticmethod
        def async_get_options_flow(config_entry):
            return CamperRoutePlannerOptionsFlow()

    class CamperRoutePlannerOptionsFlow(config_entries.OptionsFlow):
        def _current_values(self) -> dict[str, Any]:
            return {**self.config_entry.data, **self.config_entry.options}

        def _runtime(self):
            return self.hass.data.get(DOMAIN, {}).get(self.config_entry.entry_id)

        def _profiles(self) -> tuple[VehicleProfile, ...]:
            runtime = self._runtime()
            return runtime.store.profiles() if runtime is not None else ()

        def _secret_status(self, key: str) -> str:
            return "stored" if str(self._current_values().get(key, "") or "").strip() else "not_stored"

        async def _show_init(self, errors: dict[str, str] | None = None):
            return self.async_show_form(
                step_id="init", data_schema=self._schema(), errors=errors or {},
                description_placeholders={
                    "geocoding_status": self._secret_status(CONF_GEOCODING_API_KEY),
                    "carto_status": self._secret_status(CONF_CARTO_API_KEY),
                    "nakordoni_status": self._secret_status(CONF_API_KEY),
                },
            )

        async def async_step_init(self, user_input: dict[str, Any] | None = None):
            if user_input is None:
                return await self._show_init()
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
            if user_input.get(CONF_REMOVE_CARTO_API_KEY):
                submitted[CONF_CARTO_API_KEY] = ""
            elif not str(user_input.get(CONF_CARTO_API_KEY, "")).strip():
                submitted[CONF_CARTO_API_KEY] = current.get(CONF_CARTO_API_KEY, "")
            if user_input.get(CONF_REMOVE_GEOCODING_API_KEY):
                submitted[CONF_GEOCODING_API_KEY] = ""
            elif not str(user_input.get(CONF_GEOCODING_API_KEY, "")).strip():
                submitted[CONF_GEOCODING_API_KEY] = current.get(CONF_GEOCODING_API_KEY, "")
            else:
                submitted[CONF_GEOCODING_API_KEY] = user_input[CONF_GEOCODING_API_KEY].strip()
            errors = validate_user_input(submitted)
            if errors:
                return await self._show_init(errors)
            if provider in (PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME):
                submitted[CONF_API_KEY] = normalize_api_key(submitted[CONF_API_KEY])
            self._provider_input = {**current, **user_input, **{
                CONF_API_KEY: submitted.get(CONF_API_KEY, ""),
                CONF_CARTO_API_KEY: submitted.get(CONF_CARTO_API_KEY, ""),
                CONF_GEOCODING_API_KEY: submitted.get(CONF_GEOCODING_API_KEY, ""),
                CONF_LIVE_ENABLED: False,
            }}
            if self._profiles():
                return await self.async_step_vehicle_menu()
            self._editing_profile_id = None
            return await self.async_step_profile()

        def _schema(self):
            current = self._current_values()
            return vol.Schema({
                vol.Required(CONF_PROVIDER, default=current.get(CONF_PROVIDER, PROVIDER_MOCK)): vol.In([PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME]),
                vol.Optional(CONF_API_KEY): _api_key_selector(),
                vol.Optional(CONF_REMOVE_API_KEY, default=False): bool,
                vol.Optional(CONF_MAP_PROVIDER, default=current.get(CONF_MAP_PROVIDER, MAP_PROVIDER_NONE)): vol.In([MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO]),
                vol.Optional(CONF_CARTO_API_KEY): str,
                vol.Optional(CONF_REMOVE_CARTO_API_KEY, default=False): bool,
                vol.Optional(CONF_GEOCODING_API_KEY): _api_key_selector(),
                vol.Optional(CONF_REMOVE_GEOCODING_API_KEY, default=False): bool,
            })

        async def async_step_vehicle_menu(self, user_input: dict[str, Any] | None = None):
            profiles = self._profiles()
            if user_input is not None:
                action = str(user_input.get("vehicle_action", ""))
                self._editing_profile_id = None if action == "add" else action
                return await self.async_step_profile()
            options = {"add": "add"} | {profile.profile_id: profile.name for profile in profiles}
            return self.async_show_form(step_id="vehicle_menu", data_schema=vol.Schema({vol.Required("vehicle_action", default="add"): vol.In(options)}))

        def _profile_schema(self, profile: VehicleProfile | None = None):
            defaults = {
                "profile_id": profile.profile_id if profile else "",
                "name": profile.name if profile else "",
                "vehicle_kind": profile.vehicle_kind if profile else "motorhome",
                "height_m": profile.height_m if profile else 3.2,
                "width_m": profile.width_m if profile else 2.34,
                "length_m": profile.length_m if profile else 7.65,
                "gross_weight_kg": profile.gross_weight_kg if profile else 4800,
                "fuel_type": profile.fuel_type if profile else "diesel",
                "axles": profile.axles if profile else 2,
                "tracker_entity_id": profile.tracker_entity_id if profile else "",
            }
            return vol.Schema({
                vol.Required("profile_id", default=defaults["profile_id"]): str,
                vol.Required("name", default=defaults["name"]): str,
                vol.Required("vehicle_kind", default=defaults["vehicle_kind"]): vol.In(["motorhome", "truck", "car"]),
                vol.Required("height_m", default=defaults["height_m"]): vol.Coerce(float),
                vol.Required("width_m", default=defaults["width_m"]): vol.Coerce(float),
                vol.Required("length_m", default=defaults["length_m"]): vol.Coerce(float),
                vol.Required("gross_weight_kg", default=defaults["gross_weight_kg"]): vol.Coerce(int),
                vol.Required("fuel_type", default=defaults["fuel_type"]): vol.In(["diesel", "petrol", "electric", "hybrid", "other"]),
                vol.Required("axles", default=defaults["axles"]): vol.Coerce(int),
                vol.Optional("tracker_entity_id", default=defaults["tracker_entity_id"]): _entity_selector(),
            })

        async def async_step_profile(self, user_input: dict[str, Any] | None = None):
            errors: dict[str, str] = {}
            editing_id = getattr(self, "_editing_profile_id", None)
            existing = next((profile for profile in self._profiles() if profile.profile_id == editing_id), None) if editing_id else None
            if user_input is not None:
                try:
                    profile = VehicleProfile(
                        profile_id=editing_id or user_input["profile_id"], name=user_input["name"], vehicle_kind=user_input["vehicle_kind"],
                        height_m=float(user_input["height_m"]), width_m=float(user_input["width_m"]), length_m=float(user_input["length_m"]),
                        gross_weight_kg=int(user_input["gross_weight_kg"]), fuel_type=user_input["fuel_type"], axles=int(user_input.get("axles", 2)),
                        tracker_entity_id=user_input.get("tracker_entity_id") or (DEFAULT_ZOE_TRACKER if str(user_input["name"]).strip().casefold() == "zoe" else None),
                    )
                    runtime = self._runtime()
                    if runtime is None:
                        raise ValueError("runtime unavailable")
                    await runtime.store.async_save_profile(profile)
                    return self.async_create_entry(data=getattr(self, "_provider_input", {CONF_LIVE_ENABLED: False}))
                except (KeyError, TypeError, ValueError):
                    errors = {"base": "invalid_profile"}
            return self.async_show_form(step_id="profile", data_schema=self._profile_schema(existing), errors=errors, description_placeholders={"mode": "edit" if existing else "add"})

except ImportError:  # pragma: no cover - exercised without HA.
    CamperRoutePlannerConfigFlow = None  # type: ignore[assignment,misc]
    CamperRoutePlannerOptionsFlow = None  # type: ignore[assignment,misc]
