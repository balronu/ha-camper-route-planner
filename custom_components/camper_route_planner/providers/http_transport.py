"""Secretsafe asynchronous transport for explicitly invoked Nakordoni calls.

The transport is deliberately dependency-injected. Home Assistant callers pass
the shared aiohttp session; tests use a small fake session and never leave the
process. It does not retry, refresh credentials, or initiate a request by
itself.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import json
import time
from typing import Any

from ..models import ProviderError

try:
    from aiohttp import ClientTimeout
except ImportError:  # pragma: no cover - HA supplies aiohttp; offline tests do not.
    @dataclass(frozen=True, slots=True)
    class ClientTimeout:  # type: ignore[no-redef]
        total: float
        connect: float

from .nakordoni_motorhome import ROUTE_ENDPOINT, USAGE_ENDPOINT, safe_request_id


SAFE_QUOTA_HEADERS = frozenset(
    {"x-devapi-limit", "x-devapi-remaining", "x-devapi-reset", "retry-after", "x-route-source"}
)

_ROUTE_LOCK = asyncio.Lock()
_LAST_ROUTE_START = 0.0


def _response_kind(content_type: str, body: bytes) -> str:
    if not body:
        return "empty"
    if "html" in content_type.casefold() or body.lstrip().lower().startswith((b"<!doctype html", b"<html")):
        return "html"
    try:
        json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return "invalid_json"
    return "json"


def _retryable_status(status: int | None) -> bool:
    return status in {408, 500, 502, 503, 504}


def _status_error(status: int | None) -> tuple[str, str]:
    messages = {
        400: ("invalid_request", "Der Routingdienst hat die Anfrage abgelehnt."),
        401: ("unauthorized", "Der Routingdienst hat die Zugangsdaten abgelehnt."),
        403: ("forbidden", "Der Routingdienst hat diese Anfrage nicht erlaubt."),
        404: ("not_found", "Der Routingdienst-Endpunkt wurde nicht gefunden."),
        408: ("provider_timeout", "Der Routingdienst hat die Anfrage nicht rechtzeitig beantwortet."),
        429: ("quota_exceeded", "Der Routingdienst hat sein Anfragelimit erreicht. Bitte versuche es später erneut."),
    }
    if status in messages:
        return messages[status]
    if status in {500, 502, 503, 504}:
        return "provider_unavailable", "Der Routingdienst ist vorübergehend nicht verfügbar. Bitte versuche es später erneut."
    return "invalid_response", "Der Routingdienst hat keine gültige Antwort geliefert. Bitte versuche es später erneut."


async def _read_body(response: Any) -> tuple[bytes, Any]:
    """Read a response once, with a small fake-session compatibility path."""
    reader = getattr(response, "read", None)
    if callable(reader):
        body = await reader()
        if isinstance(body, str):
            body = body.encode("utf-8", "replace")
        return bytes(body or b""), None
    try:
        return b"", await response.json(content_type=None)
    except (TypeError, ValueError):
        return b"", None


def _parse_payload(body: bytes, fallback: Any) -> tuple[Any, str]:
    if body:
        kind = _response_kind("", body)
        if kind != "json":
            return None, kind
        try:
            return json.loads(body.decode("utf-8")), kind
        except (UnicodeDecodeError, ValueError):
            return None, "invalid_json"
    if fallback is None:
        return None, "empty"
    return fallback, "json"


@dataclass(slots=True)
class NakordoniHttpTransport:
    """One bounded GET request using an already-owned Home Assistant session."""

    session: Any
    api_key: str
    timeout_s: float = 60.0
    connect_timeout_s: float = 10.0
    endpoint: str = ROUTE_ENDPOINT
    min_interval_s: float = 1.0
    max_busy_retries: int = 2

    async def __call__(self, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("Nakordoni API key is required")
        headers = {"Authorization": f"Bearer {self.api_key}"}
        global _LAST_ROUTE_START
        attempts = 0
        started = time.monotonic()
        async with _ROUTE_LOCK:
            while True:
                wait_s = self.min_interval_s - (time.monotonic() - _LAST_ROUTE_START)
                if wait_s > 0:
                    await asyncio.sleep(wait_s)
                _LAST_ROUTE_START = time.monotonic()
                attempts += 1
                try:
                    async with self.session.get(
                        self.endpoint,
                        params=parameters,
                        headers=headers,
                        timeout=ClientTimeout(total=self.timeout_s, connect=self.connect_timeout_s),
                        allow_redirects=False,
                    ) as response:
                        status = int(response.status)
                        content_type = str(response.headers.get("Content-Type", "")).split(";", 1)[0].strip().lower()
                        body, fallback = await _read_body(response)
                        payload, response_type = _parse_payload(body, fallback)
                        transport = {
                            "attempts": attempts,
                            "elapsed_s": round(time.monotonic() - started, 3),
                            "status": status,
                            "content_type": content_type or None,
                            "response_type": response_type,
                            "response_length": len(body) if body else None,
                        }
                        if payload is None or not isinstance(payload, dict):
                            code, message = _status_error(status) if status >= 400 else (
                                ("empty_response", "Der Routingdienst hat keine Antwort geliefert. Bitte versuche es später erneut.")
                                if response_type == "empty" else
                                ("html_response", "Der Routingdienst hat eine ungültige HTML-Antwort geliefert. Bitte versuche es später erneut.")
                                if response_type == "html" else
                                ("invalid_json", "Der Routingdienst hat kein gültiges JSON geliefert. Bitte versuche es später erneut.")
                                if response_type == "invalid_json" else
                                ("invalid_response", "Der Routingdienst hat keine gültige Antwort geliefert. Bitte versuche es später erneut.")
                            )
                            raise ProviderError(message, code=code, status=status, retryable=_retryable_status(status), details={"transport": transport})
                        result = dict(payload)
                        result.setdefault("status", status)
                        result["headers"] = {
                            key: str(value)
                            for key, value in response.headers.items()
                            if key.lower() in SAFE_QUOTA_HEADERS or key.lower() == "x-request-id"
                        }
                        raw_request_id = (
                            result["headers"].get("X-Request-Id")
                            or result["headers"].get("x-request-id")
                            or result.get("request_id")
                        )
                        request_id = safe_request_id(raw_request_id)
                        result.pop("request_id", None)
                        if request_id:
                            result["request_id"] = request_id
                        result["headers"] = {
                            key: value for key, value in result["headers"].items()
                            if key.lower() != "x-request-id"
                        }
                        transport["route_source"] = result["headers"].get("X-Route-Source") or result["headers"].get("x-route-source")
                        result["transport"] = transport
                        if status >= 400 and result.get("ok") is True:
                            result["ok"] = False
                        error = result.get("error") if isinstance(result.get("error"), dict) else {}
                        busy = status == 503 and error.get("code") == "busy"
                        if not busy or attempts > self.max_busy_retries:
                            return result
                        raw_retry = error.get("retry_after") or result["headers"].get("Retry-After") or result["headers"].get("retry-after")
                        try:
                            retry_after = max(0.0, min(float(raw_retry), 120.0))
                        except (TypeError, ValueError):
                            retry_after = 1.0
                        await asyncio.sleep(retry_after)
                except ProviderError:
                    raise
                except asyncio.TimeoutError as exc:
                    raise ProviderError("Der Routingdienst hat nicht rechtzeitig geantwortet. Bitte versuche es später erneut.", code="timeout", retryable=True, details={"transport": {"attempts": attempts, "elapsed_s": round(time.monotonic() - started, 3), "response_type": "timeout"}}) from exc
                except OSError as exc:
                    raise ProviderError("Die Netzwerkverbindung zum Routingdienst ist fehlgeschlagen. Bitte versuche es später erneut.", code="network_error", retryable=True, details={"transport": {"attempts": attempts, "elapsed_s": round(time.monotonic() - started, 3), "response_type": "network_error"}}) from exc
@dataclass(slots=True)
class NakordoniUsageTransport:
    """One explicit, non-routed account request using HA's session."""

    session: Any
    api_key: str
    timeout_s: float = 15.0
    connect_timeout_s: float = 5.0
    endpoint: str = USAGE_ENDPOINT

    async def __call__(self) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("Nakordoni API key is required")
        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with self.session.get(
            self.endpoint,
            headers=headers,
            timeout=ClientTimeout(total=self.timeout_s, connect=self.connect_timeout_s),
            allow_redirects=False,
        ) as response:
            try:
                payload = await response.json(content_type=None)
            except (TypeError, ValueError) as exc:
                raise ValueError("Nakordoni usage returned invalid JSON") from exc
            if not isinstance(payload, dict):
                raise ValueError("Nakordoni usage returned an invalid response")
            result = dict(payload)
            result.setdefault("status", int(response.status))
            result["headers"] = {
                key: str(value)
                for key, value in response.headers.items()
                if key.lower() in SAFE_QUOTA_HEADERS
            }
            if response.status >= 400 and result.get("ok") is True:
                result["ok"] = False
            return result
