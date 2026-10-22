"""Home Assistant Config/Options Flow for provider, map and vehicle settings."""

from __future__ import annotations

from typing import Any

from .config_flow_support import normalize_api_key, validate_user_input
from .const import (
    CONF_API_KEY, CONF_CARTO_API_KEY, CONF_GEOCODING_API_KEY, CONF_LIVE_ENABLED,
    CONF_MAP_PROVIDER, CONF_PROVIDER, CONF_REMOVE_API_KEY,
    CONF_REMOVE_CARTO_API_KEY, CONF_REMOVE_GEOCODING_API_KEY, DEFAULT_ZOE_TRACKER,
    CONF_VEHICLE_ACTION, DOMAIN, MAP_PROVIDER_CARTO, MAP_PROVIDER_NONE,
    PROVIDER_MOCK, PROVIDER_NAKORDONI, PROVIDER_NAKORDONI_MOTORHOME,
    VEHICLE_ACTION_ADD, VEHICLE_ACTION_EDIT, VEHICLE_ACTION_NONE,
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

    def _select_selector(options: tuple[str, ...], translation_key: str):
        config = {"options": list(options), "translation_key": translation_key}
        try:
            return selector.SelectSelector(config)
        except TypeError:  # pragma: no cover
            return selector.SelectSelector(selector.SelectSelectorConfig(**config))

    _VISIBLE_PROVIDERS = (PROVIDER_MOCK, PROVIDER_NAKORDONI_MOTORHOME)
    _VEHICLE_ACTIONS = (VEHICLE_ACTION_NONE, VEHICLE_ACTION_EDIT, VEHICLE_ACTION_ADD)

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
                vol.Required(CONF_PROVIDER, default=PROVIDER_MOCK): _select_selector(_VISIBLE_PROVIDERS, "provider"),
                vol.Optional(CONF_API_KEY): _api_key_selector(),
                vol.Optional(CONF_MAP_PROVIDER, default=MAP_PROVIDER_NONE): _select_selector((MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO), "map_provider"),
                vol.Optional(CONF_CARTO_API_KEY, default=""): str,
                vol.Optional(CONF_GEOCODING_API_KEY, default=""): _api_key_selector(),
            })
            return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

        @staticmethod
        def async_get_options_flow(config_entry):
            return CamperRoutePlannerOptionsFlow()

    class CamperRoutePlannerOptionsFlow(config_entries.OptionsFlow):
        def _current_values(self) -> dict[str, Any]:
            data = dict(self.config_entry.data)
            options = dict(self.config_entry.options)
            values = {**data, **options}
            # Older beta flows could leave an empty options value while the
            # real key still lived in ConfigEntry.data. An explicit remove
            # marker is the only case where that empty value must win.
            for key, remove_key in (
                (CONF_API_KEY, CONF_REMOVE_API_KEY),
                (CONF_CARTO_API_KEY, CONF_REMOVE_CARTO_API_KEY),
                (CONF_GEOCODING_API_KEY, CONF_REMOVE_GEOCODING_API_KEY),
            ):
                if key in options and not str(options.get(key) or "").strip() and str(data.get(key) or "").strip() and not options.get(remove_key):
                    values[key] = data[key]
            return values

        def _runtime(self):
            return self.hass.data.get(DOMAIN, {}).get(self.config_entry.entry_id)

        def _profiles(self) -> tuple[VehicleProfile, ...]:
            runtime = self._runtime()
            return runtime.store.profiles() if runtime is not None else ()

        def _secret_status(self, key: str) -> str:
            german = str(getattr(getattr(self.hass, "config", None), "language", "en")).lower().startswith("de")
            stored = str(self._current_values().get(key, "") or "").strip()
            return ("gespeichert" if stored else "nicht gespeichert") if german else ("stored" if stored else "not stored")

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
            if user_input.get(CONF_REMOVE_API_KEY):
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
            if str(submitted.get(CONF_API_KEY, "")).strip():
                submitted[CONF_API_KEY] = normalize_api_key(submitted[CONF_API_KEY])
            self._provider_input = {key: value for key, value in {**current, **user_input, **{
                CONF_API_KEY: submitted.get(CONF_API_KEY, ""),
                CONF_CARTO_API_KEY: submitted.get(CONF_CARTO_API_KEY, ""),
                CONF_GEOCODING_API_KEY: submitted.get(CONF_GEOCODING_API_KEY, ""),
                CONF_LIVE_ENABLED: False,
            }}.items() if key != CONF_VEHICLE_ACTION}
            vehicle_action = user_input.get(CONF_VEHICLE_ACTION, VEHICLE_ACTION_NONE)
            if vehicle_action == VEHICLE_ACTION_NONE:
                return self.async_create_entry(data=self._provider_input)
            if vehicle_action == VEHICLE_ACTION_EDIT and not self._profiles():
                return await self._show_init({"base": "no_profiles_to_edit"})
            if vehicle_action == VEHICLE_ACTION_EDIT:
                return await self.async_step_vehicle_menu()
            self._editing_profile_id = None
            return await self.async_step_profile()

        def _schema(self):
            current = self._current_values()
            current_provider = current.get(CONF_PROVIDER, PROVIDER_MOCK)
            # ``nakordoni`` is the old disabled skeleton. Keep it intact in
            # stored entries and require an explicit user choice before any
            # transition; never reinterpret it as the motorhome provider.
            provider_default = current_provider if current_provider in _VISIBLE_PROVIDERS else PROVIDER_MOCK
            return vol.Schema({
                vol.Required(CONF_PROVIDER, default=provider_default): _select_selector(_VISIBLE_PROVIDERS, "provider"),
                vol.Optional(CONF_API_KEY): _api_key_selector(),
                vol.Optional(CONF_REMOVE_API_KEY, default=False): bool,
                vol.Optional(CONF_MAP_PROVIDER, default=current.get(CONF_MAP_PROVIDER, MAP_PROVIDER_NONE)): _select_selector((MAP_PROVIDER_NONE, MAP_PROVIDER_CARTO), "map_provider"),
                vol.Optional(CONF_CARTO_API_KEY): str,
                vol.Optional(CONF_REMOVE_CARTO_API_KEY, default=False): bool,
                vol.Optional(CONF_GEOCODING_API_KEY): _api_key_selector(),
                vol.Optional(CONF_REMOVE_GEOCODING_API_KEY, default=False): bool,
                vol.Required(CONF_VEHICLE_ACTION, default=VEHICLE_ACTION_NONE): _select_selector(_VEHICLE_ACTIONS, "vehicle_action"),
            })

        async def async_step_vehicle_menu(self, user_input: dict[str, Any] | None = None):
            profiles = self._profiles()
            if user_input is not None:
                action = str(user_input.get("vehicle_action", ""))
                if action == VEHICLE_ACTION_NONE:
                    return self.async_create_entry(data=getattr(self, "_provider_input", {CONF_LIVE_ENABLED: False}))
                self._editing_profile_id = None if action == "add" else action
                return await self.async_step_profile()
            german = str(getattr(getattr(self.hass, "config", None), "language", "en")).lower().startswith("de")
            add_label = "Neues Fahrzeug hinzufügen" if german else "Add new vehicle"
            no_change_label = "Keine Änderungen an Fahrzeugen" if german else "No vehicle changes"
            options = {VEHICLE_ACTION_NONE: no_change_label, "add": add_label} | {profile.profile_id: profile.name for profile in profiles}
            return self.async_show_form(step_id="vehicle_menu", data_schema=vol.Schema({vol.Required(CONF_VEHICLE_ACTION, default=VEHICLE_ACTION_NONE): vol.In(options)}))

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
            tracker_key = vol.Optional("tracker_entity_id", default=profile.tracker_entity_id) if profile and profile.tracker_entity_id else vol.Optional("tracker_entity_id")
            return vol.Schema({
                vol.Required("profile_id", default=defaults["profile_id"]): str,
                vol.Required("name", default=defaults["name"]): str,
                vol.Required("vehicle_kind", default=defaults["vehicle_kind"]): _select_selector(("motorhome", "truck", "car"), "vehicle_kind"),
                vol.Required("height_m", default=defaults["height_m"]): vol.Coerce(float),
                vol.Required("width_m", default=defaults["width_m"]): vol.Coerce(float),
                vol.Required("length_m", default=defaults["length_m"]): vol.Coerce(float),
                vol.Required("gross_weight_kg", default=defaults["gross_weight_kg"]): vol.Coerce(int),
                vol.Required("fuel_type", default=defaults["fuel_type"]): _select_selector(("diesel", "petrol", "electric", "hybrid", "other"), "fuel_type"),
                vol.Required("axles", default=defaults["axles"]): vol.Coerce(int),
                tracker_key: _entity_selector(),
                **({vol.Optional("delete_profile", default=False): bool} if profile else {}),
            })

        async def async_step_profile(self, user_input: dict[str, Any] | None = None):
            errors: dict[str, str] = {}
            editing_id = getattr(self, "_editing_profile_id", None)
            existing = next((profile for profile in self._profiles() if profile.profile_id == editing_id), None) if editing_id else None
            if user_input is not None:
                if existing and user_input.get("delete_profile"):
                    self._deleting_profile = existing
                    return await self.async_step_vehicle_delete()
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
            german = str(getattr(getattr(self.hass, "config", None), "language", "en")).lower().startswith("de")
            mode = ("Fahrzeugprofil bearbeiten" if german else "Edit vehicle profile") if existing else ("Neues Fahrzeug hinzufügen" if german else "Add new vehicle")
            return self.async_show_form(step_id="profile", data_schema=self._profile_schema(existing), errors=errors, description_placeholders={"mode": mode})

        async def async_step_vehicle_delete(self, user_input: dict[str, Any] | None = None):
            profile = getattr(self, "_deleting_profile", None)
            runtime = self._runtime()
            if profile is None or runtime is None:
                return await self._show_init({"base": "invalid_profile"})
            routes = runtime.store.routes_for_profile(profile.profile_id)
            if user_input is not None:
                if not user_input.get("confirm_delete"):
                    return self.async_show_form(
                        step_id="vehicle_delete", data_schema=self._delete_schema(),
                        errors={"base": "delete_confirmation_required"},
                        description_placeholders={"name": profile.name, "route_count": str(len(routes))},
                    )
                if routes and not user_input.get("delete_routes"):
                    return self.async_show_form(
                        step_id="vehicle_delete", data_schema=self._delete_schema(),
                        errors={"base": "profile_has_routes"},
                        description_placeholders={"name": profile.name, "route_count": str(len(routes))},
                    )
                await runtime.store.async_delete_profile(profile.profile_id, delete_routes=bool(user_input.get("delete_routes")))
                return self.async_create_entry(data=getattr(self, "_provider_input", {CONF_LIVE_ENABLED: False}))
            return self.async_show_form(
                step_id="vehicle_delete", data_schema=self._delete_schema(),
                description_placeholders={"name": profile.name, "route_count": str(len(routes))},
            )

        @staticmethod
        def _delete_schema():
            return vol.Schema({
                vol.Required("confirm_delete", default=False): bool,
                vol.Optional("delete_routes", default=False): bool,
            })

except ImportError:  # pragma: no cover - exercised without HA.
    CamperRoutePlannerConfigFlow = None  # type: ignore[assignment,misc]
    CamperRoutePlannerOptionsFlow = None  # type: ignore[assignment,misc]
