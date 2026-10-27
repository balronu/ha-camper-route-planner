"""Constants for the staged Camper Route Planner integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "camper_route_planner"
NAME: Final = "Camper Route Planner"
VERSION: Final = "0.1.1-beta.9"

CONF_PROVIDER: Final = "provider"
CONF_API_KEY: Final = "api_key"
CONF_REMOVE_API_KEY: Final = "remove_api_key"
CONF_LIVE_ENABLED: Final = "live_enabled"
CONF_PROFILE_ID: Final = "profile_id"
CONF_PROFILE: Final = "profile"
CONF_MAP_PROVIDER: Final = "map_provider"
CONF_CARTO_API_KEY: Final = "carto_api_key"
CONF_REMOVE_CARTO_API_KEY: Final = "remove_carto_api_key"
CONF_GEOCODING_API_KEY: Final = "geocoding_api_key"
CONF_REMOVE_GEOCODING_API_KEY: Final = "remove_geocoding_api_key"
CONF_VEHICLE_ACTION: Final = "vehicle_action"

PROVIDER_MOCK: Final = "mock"
PROVIDER_NAKORDONI: Final = "nakordoni"
PROVIDER_NAKORDONI_MOTORHOME: Final = "nakordoni_motorhome"
VEHICLE_ACTION_NONE: Final = "none"
VEHICLE_ACTION_EDIT: Final = "edit"
VEHICLE_ACTION_ADD: Final = "add"
VEHICLE_ACTION_DELETE: Final = "delete"
MAP_PROVIDER_NONE: Final = "none"
MAP_PROVIDER_CARTO: Final = "carto"
CARTO_TILE_URL: Final = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key={key}"
CARTO_TILE_ATTRIBUTION: Final = "© OpenStreetMap contributors, © CARTO"

STORAGE_VERSION: Final = 2
STORAGE_KEY: Final = f"{DOMAIN}.storage"
SERVICE_CALCULATE_ROUTE: Final = "calculate_route"

ATTR_ORIGIN: Final = "origin"
ATTR_DESTINATION: Final = "destination"
ATTR_VIA: Final = "via"
ATTR_PROFILE_ID: Final = "profile_id"
ATTR_ROUTE_NAME: Final = "route_name"
ATTR_TRAFFIC: Final = "traffic"
DEFAULT_ZOE_TRACKER: Final = "device_tracker.wohnmobil_zoe"
GEOCODING_PROVIDER_GEOAPIFY: Final = "geoapify"
GEOAPIFY_AUTOCOMPLETE_URL: Final = "https://api.geoapify.com/v1/geocode/autocomplete"
GEOAPIFY_REVERSE_URL: Final = "https://api.geoapify.com/v1/geocode/reverse"
