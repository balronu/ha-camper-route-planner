"""Pure PKCE helpers for a future dedicated Nakordoni OAuth client."""

from __future__ import annotations

import base64
import hashlib
import secrets
from dataclasses import dataclass
from urllib.parse import urlencode

from .nakordoni_motorhome import AUTHORIZE_ENDPOINT, REDIRECT_URI, TOKEN_ENDPOINT, safe_provider_link


def create_pkce_verifier() -> str:
    return secrets.token_urlsafe(48)


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


@dataclass(frozen=True, slots=True)
class OAuthState:
    state: str
    verifier: str


def build_authorization_url(*, client_id: str, state: OAuthState, scope: str = "routing") -> str:
    if not client_id.strip():
        raise ValueError("client_id is required")
    return AUTHORIZE_ENDPOINT + "?" + urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": scope,
        "state": state.state,
        "code_challenge": pkce_challenge(state.verifier),
        "code_challenge_method": "S256",
    })


def validate_callback_state(expected: OAuthState, received_state: str) -> None:
    if not received_state or not secrets.compare_digest(expected.state, received_state):
        raise ValueError("OAuth state mismatch")


def normalize_token_response(payload: dict[str, object]) -> dict[str, object]:
    if payload.get("error") in {"invalid_grant", "invalid_api_key"}:
        raise ValueError(str(payload["error"]))
    if not payload.get("access_token"):
        raise ValueError("OAuth response did not contain an access token")
    result = {"access_token": payload["access_token"], "token_type": payload.get("token_type", "Bearer")}
    for key in ("refresh_token", "expires_in", "scope", "markets_approved", "markets_allowed", "markets_available", "upgrade_url"):
        if key in payload:
            result[key] = payload[key]
    return result


def token_endpoint() -> str:
    return TOKEN_ENDPOINT


def build_refresh_request(*, client_id: str, refresh_token: str) -> dict[str, str]:
    if not client_id.strip() or not refresh_token.strip():
        raise ValueError("client_id and refresh_token are required")
    return {"grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": client_id}


def validate_redirect(value: object) -> str | None:
    return safe_provider_link(value)
