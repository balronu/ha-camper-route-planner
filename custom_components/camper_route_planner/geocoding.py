"""Provider-neutral geocoding contract and Geoapify implementation."""

from __future__ import annotations

import asyncio
import time
from typing import Any
from urllib.parse import urlencode

from .const import GEOAPIFY_AUTOCOMPLETE_URL, GEOAPIFY_REVERSE_URL


class GeocodingError(RuntimeError):
    """Safe error code; credentials and provider payloads never leave this module."""


class GeoapifyGeocoder:
    """Backend-only Geoapify adapter with debounce-compatible cache and throttling."""

    def __init__(self, api_key: str, *, session: Any, clock=time.monotonic) -> None:
        self._api_key = api_key
        self._session = session
        self._clock = clock
        self._last_request = 0.0
        self._cache: dict[tuple[str, int], list[dict[str, Any]]] = {}
        self._reverse_cache: dict[tuple[float, float], str | None] = {}
        self._lock = asyncio.Lock()

    async def async_search(self, text: str, *, limit: int = 5) -> list[dict[str, Any]]:
        query = " ".join(str(text).split())
        limit = max(1, min(int(limit), 10))
        if len(query) < 2:
            return []
        cache_key = (query.casefold(), limit)
        if cache_key in self._cache:
            return [dict(item) for item in self._cache[cache_key]]
        async with self._lock:
            delay = 0.25 - (self._clock() - self._last_request)
            if delay > 0:
                await asyncio.sleep(delay)
            self._last_request = self._clock()
            url = GEOAPIFY_AUTOCOMPLETE_URL + "?" + urlencode({"text": query, "limit": limit, "format": "json", "apiKey": self._api_key})
            try:
                async with self._session.get(url) as response:
                    if response.status == 429:
                        raise GeocodingError("rate_limited")
                    if response.status >= 400:
                        raise GeocodingError("provider_error")
                    payload = await response.json()
            except GeocodingError:
                raise
            except Exception as exc:
                raise GeocodingError("unavailable") from exc
        results = []
        for item in payload.get("results", []) if isinstance(payload, dict) else []:
            try:
                lat, lon = float(item["lat"]), float(item["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if -90 <= lat <= 90 and -180 <= lon <= 180 and not (lat == 0 and lon == 0):
                results.append({"label": str(item.get("formatted") or item.get("address_line1") or query), "latitude": lat, "longitude": lon})
        self._cache[cache_key] = results
        return [dict(item) for item in results]

    async def async_reverse(self, latitude: float, longitude: float) -> str | None:
        """Resolve coordinates to one safe display label, or None when absent."""
        try:
            latitude, longitude = float(latitude), float(longitude)
        except (TypeError, ValueError) as exc:
            raise GeocodingError("invalid_coordinates") from exc
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180) or (latitude == 0 and longitude == 0):
            raise GeocodingError("invalid_coordinates")
        cache_key = (round(latitude, 5), round(longitude, 5))
        if cache_key in self._reverse_cache:
            return self._reverse_cache[cache_key]
        async with self._lock:
            delay = 0.25 - (self._clock() - self._last_request)
            if delay > 0:
                await asyncio.sleep(delay)
            self._last_request = self._clock()
            url = GEOAPIFY_REVERSE_URL + "?" + urlencode({"lat": cache_key[0], "lon": cache_key[1], "limit": 1, "format": "json", "apiKey": self._api_key})
            try:
                async with self._session.get(url) as response:
                    if response.status == 429:
                        raise GeocodingError("rate_limited")
                    if response.status >= 400:
                        raise GeocodingError("provider_error")
                    payload = await response.json()
            except GeocodingError:
                raise
            except Exception as exc:
                raise GeocodingError("unavailable") from exc
        address = None
        if isinstance(payload, dict):
            for item in payload.get("results", []):
                if isinstance(item, dict):
                    address = str(item.get("formatted") or item.get("address_line1") or "").strip() or None
                    if address:
                        break
        self._reverse_cache[cache_key] = address
        return address
