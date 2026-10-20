#!/usr/bin/env python3
"""Bounded Nakordoni test runner; dry-run by default.

The key is read only from NAKORDONI_API_KEY or NAKORDONI_API_KEY_FILE. It is
never accepted as a command-line argument, printed, persisted, or included in
the JSON report. A live run requires both --live and --confirm-live.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from custom_components.camper_route_planner.config_flow_support import normalize_api_key
from custom_components.camper_route_planner.models import RouteRequest, RouteWaypoint, VehicleProfile
from custom_components.camper_route_planner.providers.nakordoni_motorhome import ROUTE_ENDPOINT, build_motorhome_parameters

MAX_REQUESTS = 8

# Coordinates are intentionally limited to reproducible city-to-city and toll
# cases. Restriction cases 5-7 remain pending until a road segment is verified.
CASES: dict[str, dict[str, Any]] = {
    "1": {"name": "München → Verona", "origin": (48.1374, 11.5755), "destination": (45.4384, 10.9916)},
    "2": {"name": "Saarbrücken → Basel", "origin": (49.2402, 6.9969), "destination": (47.5596, 7.5886)},
    "3": {"name": "Basel → Luzern", "origin": (47.5596, 7.5886), "destination": (47.0502, 8.3093)},
    "4": {"name": "Luzern → Bellinzona", "origin": (47.0502, 8.3093), "destination": (46.1950, 9.0222)},
    "8": {"name": "Länderübergreifende Mautstrecke", "origin": (48.1374, 11.5755), "destination": (45.4384, 10.9916)},
}


def _request(case: dict[str, Any]) -> RouteRequest:
    profile = VehicleProfile("phase2i-reference", "Phase 2I reference motorhome", "motorhome", 3.20, 2.34, 7.65, 4800, "diesel", axles=2)
    return RouteRequest(RouteWaypoint(*case["origin"]), RouteWaypoint(*case["destination"]), profile)


def _read_key() -> str:
    value = os.environ.get("NAKORDONI_API_KEY")
    if value is None and os.environ.get("NAKORDONI_API_KEY_FILE"):
        value = Path(os.environ["NAKORDONI_API_KEY_FILE"]).read_text(encoding="utf-8")
    return normalize_api_key(value)


def _redacted_response(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {"response_type": type(payload).__name__}
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    route = data.get("route") if isinstance(data.get("route"), dict) else {}
    tolls = data.get("tolls") if isinstance(data.get("tolls"), dict) else {}
    return {
        "ok": payload.get("ok") is True,
        "status": payload.get("status"),
        "error_code": (payload.get("error") or {}).get("code") if isinstance(payload.get("error"), dict) else None,
        "distance_m": route.get("distance_m"),
        "duration_s": route.get("duration_s"),
        "tolls": {key: tolls.get(key) for key in ("priced", "status", "complete", "estimate", "total_eur", "coverage_note")},
    }


def run(case_ids: list[str], *, live: bool, confirm_live: bool, max_requests: int) -> int:
    if len(case_ids) > MAX_REQUESTS or max_requests > MAX_REQUESTS:
        raise SystemExit(f"request limit cannot exceed {MAX_REQUESTS}")
    selected = case_ids[:max_requests]
    report: list[dict[str, Any]] = []
    for case_id in selected:
        case = CASES.get(case_id)
        if case is None:
            report.append({"case": case_id, "status": "PENDING", "reason": "No verified coordinates for this restriction case"})
            continue
        params = build_motorhome_parameters(_request(case))
        item: dict[str, Any] = {"case": case_id, "name": case["name"], "mode": "live" if live else "dry-run", "request": params}
        if not live:
            item["status"] = "DRY_RUN_NO_REQUEST"
            report.append(item)
            continue
        if not confirm_live:
            raise SystemExit("live mode requires --confirm-live")
        key = _read_key()
        query = urlencode(params, doseq=True)
        request = Request(f"{ROUTE_ENDPOINT}?{query}", headers={"Authorization": f"Bearer {key}", "Accept": "application/json"})
        try:
            with urlopen(request, timeout=20) as response:  # noqa: S310 - explicit, bounded operator tool.
                payload = json.load(response)
            item["status"] = "LIVE_RESPONSE"
            item["response"] = _redacted_response(payload)
        except HTTPError as error:
            item["status"] = "LIVE_HTTP_ERROR"
            item["http_status"] = error.code
        except (URLError, TimeoutError, OSError) as error:
            item["status"] = "LIVE_NETWORK_ERROR"
            item["error_type"] = type(error).__name__
        report.append(item)
    print(json.dumps({"mode": "live" if live else "dry-run", "request_count": sum(item.get("status") == "LIVE_RESPONSE" for item in report), "results": report}, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", action="append", dest="case_ids", choices=["1", "2", "3", "4", "5", "6", "7", "8"])
    parser.add_argument("--max-requests", type=int, default=8)
    parser.add_argument("--live", action="store_true", help="Allow network calls; dry-run is the default")
    parser.add_argument("--confirm-live", action="store_true", help="Second explicit confirmation required with --live")
    args = parser.parse_args()
    return run(args.case_ids or ["1", "2", "3", "4", "8"], live=args.live, confirm_live=args.confirm_live, max_requests=args.max_requests)


if __name__ == "__main__":
    raise SystemExit(main())
