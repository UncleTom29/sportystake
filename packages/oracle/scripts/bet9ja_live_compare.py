#!/usr/bin/env python3
"""Compare Bet9ja live endpoint rows with local parser output.

This checks that the parser used by naijabet_extended_probe.py matches the
current live Bet9ja payload shape/values for configured competitions.
"""

from __future__ import annotations

import argparse
from typing import Dict, Tuple

import requests

from naijabet_extended_probe import BET9JA_HEADERS, LEAGUES, fetch_bet9ja


def live_rows(group_id: int, timeout_s: int) -> Dict[str, Tuple[float | None, float | None, float | None]]:
    url = (
        "https://sports.bet9ja.com/desktop/feapi/PalimpsestAjax/GetEventsInGroupV2"
        f"?GROUPID={group_id}&DISP=0&GROUPMARKETID=1&matches=true"
    )
    payload = requests.get(url, headers=BET9JA_HEADERS, timeout=timeout_s).json()
    events = ((payload.get("D") or {}).get("E") or [])

    out: Dict[str, Tuple[float | None, float | None, float | None]] = {}
    for event in events:
        odds = event.get("O") or {}
        match = str(event.get("DS") or "").strip()
        if not match:
            continue
        out[match] = (
            float(odds["S_1X2_1"]) if odds.get("S_1X2_1") is not None else None,
            float(odds["S_1X2_X"]) if odds.get("S_1X2_X") is not None else None,
            float(odds["S_1X2_2"]) if odds.get("S_1X2_2") is not None else None,
        )
    return out


def parser_rows(group_id: int, league_name: str, timeout_s: int) -> Dict[str, Tuple[float | None, float | None, float | None]]:
    rows = fetch_bet9ja("Soccer", league_name, group_id, timeout_s)
    out: Dict[str, Tuple[float | None, float | None, float | None]] = {}
    for row in rows:
        out[row.match] = (
            row.odds.get("home"),
            row.odds.get("draw"),
            row.odds.get("away"),
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Bet9ja live endpoint vs parser comparison")
    parser.add_argument("--league", default="PREMIERLEAGUE", help="League key from LEAGUES map")
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--max-samples", type=int, default=5)
    args = parser.parse_args()

    league_key = args.league.upper()
    if league_key not in LEAGUES:
        print(f"unknown league: {league_key}")
        print(f"available: {', '.join(sorted(LEAGUES.keys()))}")
        return 1

    group_id = int(LEAGUES[league_key]["bet9ja"])
    live = live_rows(group_id, args.timeout)
    parsed = parser_rows(group_id, league_key, args.timeout)

    common = sorted(set(live.keys()) & set(parsed.keys()))
    only_live = sorted(set(live.keys()) - set(parsed.keys()))
    only_parsed = sorted(set(parsed.keys()) - set(live.keys()))

    mismatches = []
    for match in common:
        if live[match] != parsed[match]:
            mismatches.append((match, live[match], parsed[match]))

    print("league:", league_key)
    print("group_id:", group_id)
    print("live_rows:", len(live))
    print("parsed_rows:", len(parsed))
    print("common_rows:", len(common))
    print("only_live:", len(only_live))
    print("only_parsed:", len(only_parsed))
    print("mismatches:", len(mismatches))

    if common:
        print("sample_common:")
        for match in common[: max(1, args.max_samples)]:
            h, d, a = live[match]
            print(f"  - {match}: {h} / {d} / {a}")

    if mismatches:
        print("sample_mismatches:")
        for match, l, p in mismatches[: max(1, args.max_samples)]:
            print(f"  - {match}: live={l} parsed={p}")

    if only_live:
        print("sample_only_live:")
        for match in only_live[: max(1, args.max_samples)]:
            print(f"  - {match}")

    if only_parsed:
        print("sample_only_parsed:")
        for match in only_parsed[: max(1, args.max_samples)]:
            print(f"  - {match}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
