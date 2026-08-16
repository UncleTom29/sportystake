#!/usr/bin/env python3
"""Extended NaijaBet probe using latest known upstream endpoints + IDs/config.

This script does not depend on NaijaBet_Api internals so it can keep working
when normalizers break. It fetches raw bookmaker payloads and extracts a wider
set of markets from Bet9ja, including non-football competitions discovered
dynamically from Bet9ja GetSports.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple

import requests

BET9JA_HEADERS = {
    "user-agent": "Chrome/94.0.4606.81",
    "referer": "https://sports.bet9ja.com",
}

NAIRABET_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://nairabet.com/",
}

# Upstream templates from jayteealao/NaijaBet_Api NaijaBet_Api/id.py
ENDPOINTS = {
    "bet9ja": {
        "sports": "https://sports.bet9ja.com/desktop/feapi/PalimpsestAjax/GetSports"
        "?DISP=0&v_cache_version=1.164.0.135",
        "leagues": "https://sports.bet9ja.com/desktop/feapi/PalimpsestAjax/GetEventsInGroupV2"
        "?GROUPID={leagueid}&DISP=0&GROUPMARKETID=1&matches=true",
    },
    "nairabet": {
        "leagues": "https://sports-api.nairabet.com/v2/events?country=NG&locale=en&group=g3"
        "&platform=desktop&sportId=SOCCER&competitionId={leagueid}&limit=10",
        "leaguesDNB": "https://sports-api.nairabet.com/v2/events?country=NG&locale=en&group=g3"
        "&platform=desktop&sportId=SOCCER&competitionId={leagueid}&marketId=DNB&limit=10",
    },
    "sportybet": {
        "upcoming": "https://www.sportybet.com/api/ng/factsCenter/pcUpcomingEvents",
    },
}

# Upstream IDs from jayteealao/NaijaBet_Api NaijaBet_Api/id.py (latest at time of implementation)
LEAGUES = {
    "PREMIERLEAGUE": {"bet9ja": 170880, "nairabet": "EN_PR"},
    "CHAMPIONSHIP": {"bet9ja": 170881, "nairabet": "EN_CH"},
    "LEAGUE_ONE": {"bet9ja": 995354, "nairabet": "EN_L1"},
    "LEAGUE_TWO": {"bet9ja": 995355, "nairabet": "EN_L2"},
    "BUNDESLIGA": {"bet9ja": 180923, "nairabet": "DE_BL"},
    "BUNDESLIGA_2": {"bet9ja": 180924, "nairabet": "DE_B2"},
    "LALIGA": {"bet9ja": 180928, "nairabet": "ES_PL"},
    "LIGUE_1": {"bet9ja": 950503, "nairabet": "FR_L1"},
    "LIGUE_2": {"bet9ja": 958691, "nairabet": "FR_L2"},
    "SERIEA": {"bet9ja": 167856, "nairabet": "IT_SA"},
}


@dataclass
class ProbeResult:
    bookmaker: str
    sport: str
    league: str
    match_id: int | str
    match: str
    start_time: str
    odds: Dict[str, Any]


@dataclass
class CompetitionTarget:
    sport: str
    league: str
    bet9ja_id: int


def to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except Exception:
        return None


def parse_bet9ja_markets(odds_map: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "home": to_float(odds_map.get("S_1X2_1")),
        "draw": to_float(odds_map.get("S_1X2_X")),
        "away": to_float(odds_map.get("S_1X2_2")),
        "home_or_draw": to_float(odds_map.get("S_DC_1X")),
        "home_or_away": to_float(odds_map.get("S_DC_12")),
        "draw_or_away": to_float(odds_map.get("S_DC_X2")),
        "btts_yes": to_float(odds_map.get("S_GGNG_Y")),
        "btts_no": to_float(odds_map.get("S_GGNG_N")),
        "odd_goals": to_float(odds_map.get("S_OE_OD")),
        "even_goals": to_float(odds_map.get("S_OE_EV")),
        "first_half_home": to_float(odds_map.get("S_1X21T_1")),
        "first_half_draw": to_float(odds_map.get("S_1X21T_X")),
        "first_half_away": to_float(odds_map.get("S_1X21T_2")),
    }

    totals: Dict[str, Dict[str, float | None]] = {}
    for key, raw in odds_map.items():
        m = re.match(r"^S_OU@([0-9]+(?:\.[0-9]+)?)_([OU])$", str(key))
        if not m:
            continue
        line = m.group(1)
        side = "over" if m.group(2) == "O" else "under"
        totals.setdefault(line, {})[side] = to_float(raw)

    if totals:
        out["totals"] = totals

    return {k: v for k, v in out.items() if v is not None and v != {}}


def discover_bet9ja_competitions(
    timeout_s: int,
    sports_filter: Sequence[str],
    max_per_sport: int,
    include_antepost: bool,
) -> List[CompetitionTarget]:
    url = ENDPOINTS["bet9ja"]["sports"]
    resp = requests.get(url, headers=BET9JA_HEADERS, timeout=timeout_s)
    resp.raise_for_status()

    payload = resp.json()
    pal = ((payload.get("D") or {}).get("PAL") or {})

    filter_tokens = [x.strip().lower() for x in sports_filter if x.strip()]
    out: List[CompetitionTarget] = []
    seen: set[int] = set()
    count_by_sport: Dict[str, int] = {}

    if not isinstance(pal, dict):
        return out

    for sport_node in pal.values():
        if not isinstance(sport_node, dict):
            continue

        sport = str(sport_node.get("S_DESC") or "").strip() or "Unknown"
        sport_l = sport.lower()

        if not include_antepost and sport_l.startswith("antepost"):
            continue
        if filter_tokens and not any(tok in sport_l for tok in filter_tokens):
            continue

        groups = sport_node.get("SG") or {}
        if not isinstance(groups, dict):
            continue

        for region in groups.values():
            if not isinstance(region, dict):
                continue
            competitions = region.get("G") or {}
            if not isinstance(competitions, dict):
                continue

            for comp_id_raw, comp in competitions.items():
                if count_by_sport.get(sport, 0) >= max_per_sport:
                    break
                try:
                    comp_id = int(str(comp_id_raw))
                except Exception:
                    continue
                if comp_id <= 0 or comp_id in seen:
                    continue

                league_name = ""
                if isinstance(comp, dict):
                    league_name = str(comp.get("G_DESC") or "").strip()
                league_name = league_name or f"group-{comp_id}"

                out.append(
                    CompetitionTarget(
                        sport=sport,
                        league=league_name,
                        bet9ja_id=comp_id,
                    )
                )
                seen.add(comp_id)
                count_by_sport[sport] = count_by_sport.get(sport, 0) + 1

    return out


def fetch_bet9ja(sport: str, league_name: str, league_id: int, timeout_s: int) -> List[ProbeResult]:
    url = ENDPOINTS["bet9ja"]["leagues"].format(leagueid=league_id)
    resp = requests.get(url, headers=BET9JA_HEADERS, timeout=timeout_s)
    resp.raise_for_status()

    payload = resp.json()
    events = ((payload.get("D") or {}).get("E") or [])

    out: List[ProbeResult] = []
    for event in events:
        odds = parse_bet9ja_markets(event.get("O") or {})
        out.append(
            ProbeResult(
                bookmaker="bet9ja",
                sport=sport,
                league=league_name,
                match_id=event.get("ID"),
                match=str(event.get("DS") or ""),
                start_time=str(event.get("STARTDATE") or ""),
                odds=odds,
            )
        )
    return out


def fetch_nairabet(sport: str, league_name: str, competition_id: str, timeout_s: int) -> List[ProbeResult]:
    url = ENDPOINTS["nairabet"]["leagues"].format(leagueid=competition_id)
    resp = requests.get(url, headers=NAIRABET_HEADERS, timeout=timeout_s)
    resp.raise_for_status()

    payload = resp.json()
    categories = (((payload.get("data") or {}).get("categories") or [])[:1])
    if not categories:
        return []

    comps = categories[0].get("competitions") or []
    out: List[ProbeResult] = []
    for comp in comps:
        for event in comp.get("events") or []:
            markets = event.get("markets") or []
            m0 = markets[0] if markets else {}
            outcomes = m0.get("outcomes") or []
            odds = {
                "home": to_float(outcomes[0].get("value")) if len(outcomes) > 0 else None,
                "draw": to_float(outcomes[1].get("value")) if len(outcomes) > 1 else None,
                "away": to_float(outcomes[2].get("value")) if len(outcomes) > 2 else None,
            }
            odds = {k: v for k, v in odds.items() if v is not None}
            names = event.get("eventNames") or []
            match = " - ".join(names) if isinstance(names, list) else str(names)
            start = event.get("startTime")
            start_iso = (
                datetime.fromtimestamp(start / 1000, tz=timezone.utc).isoformat()
                if isinstance(start, (int, float))
                else ""
            )
            out.append(
                ProbeResult(
                    bookmaker="nairabet",
                    sport=sport,
                    league=league_name,
                    match_id=event.get("id", ""),
                    match=match,
                    start_time=start_iso,
                    odds=odds,
                )
            )
    return out


def fetch_sportybet(timeout_s: int) -> List[ProbeResult]:
    # SportyBet currently blocks this endpoint in simple headless mode for many requests.
    # Keep the probe explicit so we can report contract/access changes quickly.
    url = ENDPOINTS["sportybet"]["upcoming"]
    headers = {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "accept": "application/json, text/plain, */*",
        "origin": "https://www.sportybet.com",
        "referer": "https://www.sportybet.com/ng/sport/football/",
        "content-type": "application/json",
    }
    payload = [
        {
            "sportId": "sr:sport:1",
            "marketId": "1,18,10,29,11,26,36,14",
        }
    ]

    resp = requests.post(url, headers=headers, json=payload, timeout=timeout_s)
    resp.raise_for_status()
    data = resp.json()

    if isinstance(data, dict):
        code = data.get("bizCode")
        message = data.get("message")
        if code not in (0, 10000):
            raise RuntimeError(f"sportybet blocked or invalid contract: bizCode={code} message={message}")

        # Parser path for future compatibility when API becomes available in this mode.
        payload_data = data.get("data")
        if not isinstance(payload_data, list):
            return []

        out: List[ProbeResult] = []
        for group in payload_data:
            events = []
            if isinstance(group, dict):
                events = group.get("events") or group.get("matches") or []
            if not isinstance(events, list):
                continue

            for event in events:
                if not isinstance(event, dict):
                    continue
                home = str(event.get("homeTeamName") or event.get("homeName") or "").strip()
                away = str(event.get("awayTeamName") or event.get("awayName") or "").strip()
                match = f"{home} - {away}" if (home or away) else str(event.get("matchName") or "")

                odds: Dict[str, Any] = {}
                market_values = event.get("markets") or event.get("marketList") or []
                if isinstance(market_values, list):
                    for market in market_values:
                        if not isinstance(market, dict):
                            continue
                        outcomes = market.get("outcomes") or []
                        if not isinstance(outcomes, list):
                            continue
                        values = [to_float((x or {}).get("odds") or (x or {}).get("value")) for x in outcomes]
                        if len(values) >= 3 and all(v is not None for v in values[:3]):
                            odds["home"] = values[0]
                            odds["draw"] = values[1]
                            odds["away"] = values[2]
                            break

                out.append(
                    ProbeResult(
                        bookmaker="sportybet",
                        sport="Soccer",
                        league=str(event.get("tournamentName") or event.get("competitionName") or "Unknown"),
                        match_id=str(event.get("eventId") or event.get("id") or ""),
                        match=match,
                        start_time=str(event.get("matchTime") or event.get("startTime") or ""),
                        odds={k: v for k, v in odds.items() if v is not None},
                    )
                )

        return out

    raise RuntimeError("sportybet returned unexpected payload")


def fetch_sportybet_playwright(timeout_s: int) -> List[ProbeResult]:
    script_path = Path(__file__).with_name("sportybet_playwright_probe.mjs")
    cmd = [
        "node",
        str(script_path),
        "--json",
        "--timeout-ms",
        str(max(5000, timeout_s * 1000)),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        detail = stderr or stdout or f"exit {result.returncode}"
        raise RuntimeError(f"sportybet playwright probe failed: {detail}")

    try:
        payload = json.loads(result.stdout or "{}")
    except Exception as exc:
        raise RuntimeError(f"sportybet playwright returned invalid JSON: {exc}") from exc

    rows_data = payload.get("rows") if isinstance(payload, dict) else []
    if not isinstance(rows_data, list):
        return []

    out: List[ProbeResult] = []
    for row in rows_data:
        if not isinstance(row, dict):
            continue
        odds_raw = row.get("odds") if isinstance(row.get("odds"), dict) else {}
        odds = {
            "home": to_float(odds_raw.get("home")),
            "draw": to_float(odds_raw.get("draw")),
            "away": to_float(odds_raw.get("away")),
        }
        odds = {k: v for k, v in odds.items() if v is not None}

        out.append(
            ProbeResult(
                bookmaker="sportybet",
                sport=str(row.get("sport") or "Soccer"),
                league=str(row.get("league") or "Unknown"),
                match_id=str(row.get("match_id") or ""),
                match=str(row.get("match") or ""),
                start_time=str(row.get("start_time") or ""),
                odds=odds,
            )
        )

    return out


def fetch_multi_providers(timeout_s: int, providers: str = "") -> List[ProbeResult]:
    """Fetch odds from multiple African sportsbooks using multi-provider scraper.

    Args:
        timeout_s: Timeout per provider in seconds.
        providers: Comma-separated provider list. If empty, use all configured.
    """
    script_path = Path(__file__).with_name("multi_provider_scraper.mjs")
    cmd = [
        "node",
        str(script_path),
        "--json",
        "--timeout-ms",
        str(max(5000, timeout_s * 1000)),
    ]
    if providers.strip():
        cmd.extend(["--providers", providers])

    result = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=timeout_s * len(providers.split(",")) + 60)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        detail = stderr or stdout or f"exit {result.returncode}"
        raise RuntimeError(f"multi-provider scraper failed: {detail}")

    try:
        payload = json.loads(result.stdout or "{}")
    except Exception as exc:
        raise RuntimeError(f"multi-provider scraper returned invalid JSON: {exc}") from exc

    results = payload.get("results") if isinstance(payload, dict) else []
    if not isinstance(results, list):
        return []

    out: List[ProbeResult] = []
    for provider_result in results:
        if not isinstance(provider_result, dict):
            continue
        rows_data = provider_result.get("rows") if isinstance(provider_result.get("rows"), list) else []

        for row in rows_data:
            if not isinstance(row, dict):
                continue
            odds_raw = row.get("odds") if isinstance(row.get("odds"), dict) else {}
            odds = {
                "home": to_float(odds_raw.get("home")),
                "draw": to_float(odds_raw.get("draw")),
                "away": to_float(odds_raw.get("away")),
            }
            odds = {k: v for k, v in odds.items() if v is not None}

            out.append(
                ProbeResult(
                    bookmaker=str(row.get("bookmaker") or "unknown"),
                    sport=str(row.get("sport") or "Soccer"),
                    league=str(row.get("league") or "Unknown"),
                    match_id=str(row.get("match_id") or ""),
                    match=str(row.get("match") or ""),
                    start_time=str(row.get("start_time") or ""),
                    odds=odds,
                )
            )

    return out


def summarize(results: Iterable[ProbeResult]) -> Dict[str, Any]:
    rows = list(results)
    sports = sorted({r.sport for r in rows})
    leagues = sorted({r.league for r in rows})
    matches = sorted({str(r.match_id) for r in rows if r.match_id is not None})
    odds_fields = sorted({k for r in rows for k in r.odds.keys() if k != "totals"})

    totals_lines = sorted({line for r in rows for line in (r.odds.get("totals") or {}).keys()}, key=float)
    by_sport: Dict[str, int] = {}
    by_league: Dict[str, int] = {}
    for r in rows:
        by_sport[r.sport] = by_sport.get(r.sport, 0) + 1
        by_league[r.league] = by_league.get(r.league, 0) + 1

    return {
        "sports_count": len(sports),
        "sports": sports,
        "leagues_count": len(leagues),
        "leagues": leagues,
        "matches_total_rows": len(rows),
        "matches_unique": len(matches),
        "odds_fields": odds_fields,
        "totals_lines": totals_lines,
        "rows_by_sport": by_sport,
        "rows_by_league": by_league,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Extended NaijaBet endpoint + ID probe")
    parser.add_argument(
        "--bookmaker",
        choices=["bet9ja", "nairabet", "sportybet", "both", "all"],
        default="bet9ja",
    )
    parser.add_argument(
        "--mode",
        choices=["curated", "discover", "all"],
        default="all",
        help="curated: fixed upstream IDs, discover: Bet9ja GetSports discovery, all: both",
    )
    parser.add_argument(
        "--sports",
        default="",
        help="Comma-separated sport name filters for discovery mode, e.g. soccer,tennis,basketball",
    )
    parser.add_argument(
        "--max-competitions-per-sport",
        type=int,
        default=10,
        help="Discovery fetch cap per sport",
    )
    parser.add_argument(
        "--include-antepost",
        action="store_true",
        help="Include antepost sport branches during discovery",
    )
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument(
        "--sportybet-mode",
        choices=["http", "playwright"],
        default="http",
        help="SportyBet data fetch mode. 'playwright' uses a real browser session.",
    )
    parser.add_argument(
        "--multi-providers",
        choices=["none", "subset", "all"],
        default="none",
        help="Multi-provider scraping. 'all' includes bet9ja,1xbet,betking,22bet,mozzartbet,melbet,betwinner,nairabet,accessbet,betika. 'subset' uses faster providers only.",
    )
    parser.add_argument(
        "--provider-list",
        default="",
        help="Comma-separated list of provider keys to scrape (overrides --multi-providers). Keys: bet9ja,oneXbet,betKing,bet22,mozzartbet,melbet,betWinner,nairabet,accessBET,betika",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON payload instead of text summary")
    args = parser.parse_args()

    sports_filter = [s.strip() for s in args.sports.split(",") if s.strip()]

    all_results: List[ProbeResult] = []
    errors: List[Tuple[str, str, str]] = []
    curated_targets: List[CompetitionTarget] = []
    discovered_targets: List[CompetitionTarget] = []

    if args.mode in ("curated", "all"):
        for league_name, ids in LEAGUES.items():
            curated_targets.append(
                CompetitionTarget(
                    sport="Soccer",
                    league=league_name,
                    bet9ja_id=int(ids["bet9ja"]),
                )
            )

    if args.mode in ("discover", "all") and args.bookmaker in ("bet9ja", "both", "all"):
        try:
            discovered_targets = discover_bet9ja_competitions(
                timeout_s=args.timeout,
                sports_filter=sports_filter,
                max_per_sport=max(1, args.max_competitions_per_sport),
                include_antepost=args.include_antepost,
            )
        except Exception as exc:
            errors.append(("bet9ja", "discovery", str(exc)))

    bet9ja_targets: List[CompetitionTarget] = []
    seen_bet9ja_ids: set[int] = set()
    for target in [*curated_targets, *discovered_targets]:
        if target.bet9ja_id in seen_bet9ja_ids:
            continue
        seen_bet9ja_ids.add(target.bet9ja_id)
        bet9ja_targets.append(target)

    if args.bookmaker in ("bet9ja", "both", "all"):
        for target in bet9ja_targets:
            try:
                all_results.extend(fetch_bet9ja(target.sport, target.league, target.bet9ja_id, args.timeout))
            except Exception as exc:
                errors.append(("bet9ja", f"{target.sport}:{target.league}", str(exc)))

    if args.mode in ("curated", "all"):
        for league_name, ids in LEAGUES.items():
            if args.bookmaker in ("nairabet", "both", "all"):
                try:
                    all_results.extend(fetch_nairabet("Soccer", league_name, str(ids["nairabet"]), args.timeout))
                except Exception as exc:
                    errors.append(("nairabet", league_name, str(exc)))

    if args.bookmaker in ("sportybet", "all"):
        try:
            if args.sportybet_mode == "playwright":
                all_results.extend(fetch_sportybet_playwright(args.timeout))
            else:
                all_results.extend(fetch_sportybet(args.timeout))
        except Exception as exc:
            errors.append(("sportybet", args.sportybet_mode, str(exc)))

    # Multi-provider scraping
    if args.multi_providers != "none" or args.provider_list.strip():
        provider_list = args.provider_list.strip()
        if not provider_list and args.multi_providers == "all":
            provider_list = "bet9ja,oneXbet,betKing,bet22,mozzartbet,melbet,betWinner,nairabet,accessBET,betika"
        elif not provider_list and args.multi_providers == "subset":
            provider_list = "bet9ja,oneXbet,betKing,betWinner,nairabet"

        if provider_list:
            try:
                all_results.extend(fetch_multi_providers(args.timeout, provider_list))
            except Exception as exc:
                errors.append(("multi-providers", args.multi_providers, str(exc)))

    payload = {
        "config": {
            "bookmaker": args.bookmaker,
            "mode": args.mode,
            "sports_filter": sports_filter,
            "max_competitions_per_sport": args.max_competitions_per_sport,
            "include_antepost": args.include_antepost,
            "sportybet_mode": args.sportybet_mode,
            "multi_providers_mode": args.multi_providers,
            "provider_list": args.provider_list,
            "leagues_configured": len(LEAGUES),
            "bet9ja_targets_total": len(bet9ja_targets),
            "bet9ja_targets_curated": len(curated_targets),
            "bet9ja_targets_discovered": len(discovered_targets),
            "endpoint_templates": ENDPOINTS,
            "league_ids": LEAGUES,
        },
        "summary": summarize(all_results),
        "errors": [{"bookmaker": b, "league": l, "error": e} for (b, l, e) in errors],
    }

    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        s = payload["summary"]
        print("bookmaker:", args.bookmaker)
        print("mode:", args.mode)
        if sports_filter:
            print("sports filter:", ", ".join(sports_filter))
        print("bet9ja targets total:", payload["config"]["bet9ja_targets_total"])
        print("  - curated:", payload["config"]["bet9ja_targets_curated"])
        print("  - discovered:", payload["config"]["bet9ja_targets_discovered"])
        print("sports with rows:", s["sports_count"])
        print("sports:", ", ".join(s["sports"]))
        print("leagues configured:", payload["config"]["leagues_configured"])
        print("leagues with rows:", s["leagues_count"])
        print("matches total rows:", s["matches_total_rows"])
        print("matches unique:", s["matches_unique"])
        print("odds fields:", ", ".join(s["odds_fields"]))
        print("totals lines:", ", ".join(s["totals_lines"]) if s["totals_lines"] else "-")
        print("rows by sport:")
        for k in sorted(s["rows_by_sport"].keys()):
            print(f"  - {k}: {s['rows_by_sport'][k]}")
        print("rows by league:")
        for k in sorted(s["rows_by_league"].keys()):
            print(f"  - {k}: {s['rows_by_league'][k]}")
        if payload["errors"]:
            print("errors:")
            for err in payload["errors"]:
                print(f"  - {err['bookmaker']} {err['league']}: {err['error']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
