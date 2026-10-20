"""Pure Nakordoni usage/quota normalization; no network polling."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .nakordoni_motorhome import safe_provider_link


@dataclass(frozen=True, slots=True)
class QuotaUsage:
    plan: str | None
    limit: int | None
    used: int | None
    remaining: int | None
    reset_at: str | None
    markets: tuple[str, ...]
    trip_pass_active: bool | None
    trip_pass_expires_at: str | None
    upgrade_url: str | None
    pass_url: str | None


def _int(value: Any) -> int | None:
    return int(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def normalize_usage(payload: dict[str, Any], *, quota_class: str = "route") -> QuotaUsage:
    quota = payload.get("quotas", {}).get(quota_class, {}) if isinstance(payload.get("quotas"), dict) else {}
    if not isinstance(quota, dict):
        quota = {}
    trip = payload.get("trip_pass", {})
    if not isinstance(trip, dict):
        trip = {}
    return QuotaUsage(
        plan=str(payload["plan"]) if payload.get("plan") else None,
        limit=_int(quota.get("limit")), used=_int(quota.get("used")), remaining=_int(quota.get("remaining")),
        reset_at=str(quota["reset_at"]) if quota.get("reset_at") else None,
        markets=tuple(str(item) for item in payload.get("markets", []) if isinstance(item, str)),
        trip_pass_active=trip.get("active") if isinstance(trip.get("active"), bool) else None,
        trip_pass_expires_at=str(trip["expires_at"]) if trip.get("expires_at") else None,
        upgrade_url=safe_provider_link(payload.get("upgrade_url")), pass_url=safe_provider_link(payload.get("pass_url")),
    )


def refresh_allowed(last_refresh: datetime | None, *, now: datetime | None = None, interval_minutes: int = 15) -> bool:
    if last_refresh is None:
        return True
    current = now or datetime.now(timezone.utc)
    if last_refresh.tzinfo is None:
        last_refresh = last_refresh.replace(tzinfo=timezone.utc)
    return current >= last_refresh + timedelta(minutes=interval_minutes)

