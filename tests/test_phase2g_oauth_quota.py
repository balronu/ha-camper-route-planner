import unittest
from datetime import datetime, timedelta, timezone

from custom_components.camper_route_planner.providers.oauth import OAuthState, build_authorization_url, build_refresh_request, normalize_token_response, pkce_challenge, validate_callback_state
from custom_components.camper_route_planner.providers.usage import normalize_usage, refresh_allowed


class Phase2GOAuthQuotaTests(unittest.TestCase):
    def test_pkce_and_state(self):
        state = OAuthState("state-1", "verifier-1")
        url = build_authorization_url(client_id="client", state=state)
        self.assertIn("code_challenge_method=S256", url)
        self.assertIn(pkce_challenge("verifier-1"), url)
        validate_callback_state(state, "state-1")
        with self.assertRaises(ValueError):
            validate_callback_state(state, "wrong")

    def test_invalid_grant_is_controlled(self):
        with self.assertRaises(ValueError):
            normalize_token_response({"error": "invalid_grant"})
        self.assertEqual(build_refresh_request(client_id="client", refresh_token="refresh")["grant_type"], "refresh_token")

    def test_usage_and_safe_links(self):
        usage = normalize_usage({"data": {"plan": {"name": "Explorer"}, "quotas": {"route": {"limit": 10, "used": 2, "remaining": 8, "reset_at": "2026-10-21T00:00:00Z"}}, "pass": {"active": False}, "upgrade_url": "https://nakordoni.eu/upgrade", "pass_url": "https://evil.example/pass"}})
        self.assertEqual(usage.remaining, 8)
        self.assertIsNone(usage.pass_url)

    def test_refresh_interval_is_fifteen_minutes(self):
        now = datetime.now(timezone.utc)
        self.assertFalse(refresh_allowed(now - timedelta(minutes=14), now=now))
        self.assertTrue(refresh_allowed(now - timedelta(minutes=15), now=now))
