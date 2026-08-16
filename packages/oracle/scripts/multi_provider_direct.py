#!/usr/bin/env python3
"""
multi_provider_direct.py
Direct HTTP scrapers for 5 sportsbook providers (no browser):
  - 1xBet, Melbet, 22Bet, BetWinner (1xCorp LineFeed API)
  - BetKing (CDN API)

Output: JSON array of { bookmaker, match, league, home_odds, draw_odds, away_odds, match_id, match_time }
"""

import json
import socket
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

# ─── 1xCorp family ──────────────────────────────────────────────────────────────

PROVIDERS_1XCORP = {
    "1xbet":     {"host": "1xbet.ng",     "partner": 3},
    "melbet":    {"host": "melbet.com",    "partner": 8},
    "22bet":     {"host": "22bet.com",     "partner": 43},
    "betwinner": {"host": "betwinner.ng",  "partner": 152},
}

# Sport IDs confirmed active on 1xCorp LineFeed
SPORTS_1XCORP = [
    (1, "Football"),
    (2, "Ice Hockey"),
    (3, "Basketball"),
    (4, "Tennis"),
    (5, "Baseball"),
    (6, "Volleyball"),
    (7, "Rugby"),
    (8, "Handball"),
    (9, "Boxing"),
    (10, "Table Tennis"),
    (13, "American Football"),
    (16, "Badminton"),
    (21, "Darts"),
]

LINEFEED_TMPL = (
    "https://{host}/service-api/LineFeed/Get1x2_VZip"
    "?sports={sport_id}&count=200&lng=en&mode=4&country=132"
    "&partner={partner}&getEmpty=true&virtualSports=true"
)

# GetGameZip?id= endpoint: lowercase 'id' param works; 'GameId' does NOT.
GAMZIP_DETAIL_URL = (
    "https://1xbet.ng/service-api/LineFeed/GetGameZip"
    "?id={gid}&lang=en&country=132&partner=3&getEmpty=true"
)

# Market group IDs returned in GetGameZip?id= response
_G_1X2    = 1   # T=1 Home, T=2 Draw, T=3 Away
_G_AH     = 2   # T=7 HC1, T=8 HC2 (P = handicap line)
_G_H1_1X2 = 8   # T=4 H1-Home, T=5 H1-Draw, T=6 H1-Away
_G_OU     = 17  # T=9 Over, T=10 Under (P = goals line)
_G_BTTS   = 19  # T=180 Yes, T=181 No
_G_DNB    = 14  # T=182 DNB-Home, T=183 DNB-Away

# Per-sport configuration for GetGameZip detail enrichment.
# ou_preferred: tuple of preferred O/U line values, or None to auto-pick 3 middle lines.
# h1: First Half 1X2 (G=8) available.  btts: BTTS (G=19) available.  dnb: DNB (G=14) available.
SPORT_DETAIL_CONFIG: dict[str, dict] = {
    "Football":     {"ou_preferred": (1.5, 2.5, 3.5), "h1": True,  "btts": True,  "dnb": True},
    "Ice Hockey":   {"ou_preferred": (3.5, 4.5, 5.5), "h1": True,  "btts": True,  "dnb": True},
    "Handball":     {"ou_preferred": None,             "h1": True,  "btts": False, "dnb": True},
    "Basketball":   {"ou_preferred": None,             "h1": False, "btts": False, "dnb": False},
    "Tennis":       {"ou_preferred": None,             "h1": False, "btts": False, "dnb": False},
    "Table Tennis": {"ou_preferred": None,             "h1": False, "btts": False, "dnb": False},
    "Volleyball":   {"ou_preferred": None,             "h1": False, "btts": False, "dnb": False},
    "Baseball":     {"ou_preferred": None,             "h1": False, "btts": False, "dnb": False},
}


def _fetch_json(url: str, timeout: int = 20) -> dict | list | None:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"[WARN] HTTP {e.code} for {url}", file=sys.stderr)
    except Exception as e:
        print(f"[WARN] fetch error ({url}): {e}", file=sys.stderr)
    return None


def _ts_to_str(ts: int) -> str:
    try:
        return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return ""


# ─── 1xbet GetGameZip detail fetching ────────────────────────────────────────

def _parse_ou_lines(events: list, preferred=None) -> list[dict]:
    """Extract Over/Under odds.

    preferred=(l1, l2, …) picks specific lines; None auto-picks up to 3 lines
    from the middle of all available lines (useful for sports with variable totals).
    """
    lines: dict = {}
    for e in events:
        t, p, c = e.get("T"), e.get("P"), e.get("C")
        if p is None or c is None:
            continue
        if t == 9:   # Over
            lines.setdefault(p, {})["over"] = float(c)
        elif t == 10:  # Under
            lines.setdefault(p, {})["under"] = float(c)
    complete = sorted(
        k for k, v in lines.items()
        if "over" in v and "under" in v and v["over"] > 1 and v["under"] > 1
    )
    if preferred is not None:
        to_use = [p for p in preferred if p in complete]
    elif len(complete) <= 3:
        to_use = complete
    else:
        mid = len(complete) // 2
        to_use = complete[max(0, mid - 1): mid + 2]
    return [{"line": p, "over": lines[p]["over"], "under": lines[p]["under"]} for p in to_use]


def _augment_row_with_detail(row: dict, cfg: dict) -> None:
    """Fetch full game data for one row and add extra markets in-place.

    cfg comes from SPORT_DETAIL_CONFIG and controls which market groups are parsed.
    """
    gid = row.get("match_id")
    if not gid:
        return
    data = _fetch_json(GAMZIP_DETAIL_URL.format(gid=gid), timeout=10)
    if not data or not data.get("Success"):
        return
    val = data.get("Value") or {}
    events = val.get("E", [])

    # Group events by G (market group ID)
    groups: dict = {}
    for e in events:
        groups.setdefault(e.get("G", 0), []).append(e)

    # Over/Under (G=17) — preferred lines are sport-specific
    ou_lines = _parse_ou_lines(groups.get(_G_OU, []), preferred=cfg.get("ou_preferred"))
    if ou_lines:
        row["ou_lines"] = ou_lines

    # Both Teams to Score (G=19) — only for 3-way sports (football, ice hockey)
    if cfg.get("btts"):
        btts_yes = btts_no = None
        for e in groups.get(_G_BTTS, []):
            t, c = e.get("T"), e.get("C")
            if t == 180:
                btts_yes = float(c)
            elif t == 181:
                btts_no = float(c)
        if btts_yes and btts_no and btts_yes > 1 and btts_no > 1:
            row["btts_yes"] = btts_yes
            row["btts_no"] = btts_no

    # Draw No Bet (G=14) — only for 3-way sports
    if cfg.get("dnb"):
        dnb_home = dnb_away = None
        for e in groups.get(_G_DNB, []):
            t, c = e.get("T"), e.get("C")
            if t == 182:
                dnb_home = float(c)
            elif t == 183:
                dnb_away = float(c)
        if dnb_home and dnb_away and dnb_home > 1 and dnb_away > 1:
            row["dnb_home"] = dnb_home
            row["dnb_away"] = dnb_away

    # First Half 1X2 (G=8) — only for sports with halves (football, ice hockey, handball)
    if cfg.get("h1"):
        h1_home = h1_draw = h1_away = None
        for e in groups.get(_G_H1_1X2, []):
            t, c = e.get("T"), e.get("C")
            if t == 4:
                h1_home = float(c)
            elif t == 5:
                h1_draw = float(c)
            elif t == 6:
                h1_away = float(c)
        if h1_home and h1_away and h1_home > 1 and h1_away > 1:
            row["h1_home"] = h1_home
            if h1_draw and h1_draw > 1:
                row["h1_draw"] = h1_draw
            row["h1_away"] = h1_away


def scrape_1xcorp_details(rows_by_sport: dict, max_per_sport: int = 100) -> None:
    """Augment 1xbet rows with O/U, BTTS, DNB, H1 market data for all supported sports.

    Fetches GetGameZip?id= for each event in parallel (8 threads).
    Only processes rows from the '1xbet' provider.
    Modifies rows in-place — caller need not do anything extra.
    """
    to_enrich: list[tuple] = []
    for sport, cfg in SPORT_DETAIL_CONFIG.items():
        rows = [r for r in rows_by_sport.get(sport, []) if r.get("bookmaker") == "1xbet"][:max_per_sport]
        to_enrich.extend((row, cfg) for row in rows)
    if not to_enrich:
        return
    # Pre-resolve hostname once to warm the OS DNS cache before parallel threads
    # hit it simultaneously (macOS mDNSResponder throttles concurrent lookups).
    try:
        socket.getaddrinfo("1xbet.ng", 443, type=socket.SOCK_STREAM)
    except Exception:
        pass
    print(f"[INFO] Fetching detail markets for {len(to_enrich)} events across {len(SPORT_DETAIL_CONFIG)} sports …", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(_augment_row_with_detail, row, cfg): row for row, cfg in to_enrich}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f"[WARN] detail fetch error: {e}", file=sys.stderr)
    enriched = sum(1 for row, _ in to_enrich if "ou_lines" in row or "btts_yes" in row)
    print(f"[INFO]   detail enriched: {enriched}/{len(to_enrich)} events", file=sys.stderr)


def scrape_1xcorp(name: str, host: str, partner: int) -> list[dict]:
    results = []
    for sport_id, sport_name in SPORTS_1XCORP:
        url = LINEFEED_TMPL.format(host=host, partner=partner, sport_id=sport_id)
        data = _fetch_json(url)
        if not data or not data.get("Success"):
            print(f"[WARN] {name}/{sport_name}: bad response or !Success", file=sys.stderr)
            continue

        sport_results = []
        for ev in data.get("Value", []):
            home = ev.get("O1", "")
            away = ev.get("O2", "")
            if not home or not away:
                continue

            # Odds: E list with T=1 home, T=2 draw, T=3 away; C = float
            home_odds = draw_odds = away_odds = None
            for o in ev.get("E", []):
                t = o.get("T")
                c = o.get("C")
                if t == 1:
                    home_odds = c
                elif t == 2:
                    draw_odds = c
                elif t == 3:
                    away_odds = c

            # 2-outcome sports (tennis, table tennis, volleyball…) use T=2 for
            # "player 2 wins" — the same slot football uses for "draw". If T=3
            # was never emitted, T=2 is actually the away/player-2 outcome.
            if away_odds is None and draw_odds is not None:
                away_odds = draw_odds
                draw_odds = None

            if home_odds is None or away_odds is None:
                continue

            mid = str(ev.get("I", ""))

            sport_results.append({
                "bookmaker": name,
                "sport": sport_name,
                "match": f"{home} vs {away}",
                "league": ev.get("L", ""),
                "home_odds": home_odds,
                "draw_odds": draw_odds,
                "away_odds": away_odds,
                "match_id": mid,
                "match_time": _ts_to_str(ev.get("S", 0)),
            })

        print(f"[INFO]   {name}/{sport_name}: {len(sport_results)} events", file=sys.stderr)
        results.extend(sport_results)
        time.sleep(0.3)

    return results


# ─── BetKing ─────────────────────────────────────────────────────────────────

BETKING_URL = (
    "https://sportsapicdn-desktop.betking.com/api/feeds/prematch/mostpopularsports/en/1/7/3/"
)


def scrape_betking() -> list[dict]:
    data = _fetch_json(BETKING_URL)
    if not data:
        return []

    results = []
    # Response is a list with one element
    root = data[0] if isinstance(data, list) else data
    for area in root.get("AreaMatches", []):
        sport = area.get("SportName", "")
        for item in area.get("Items", []):
            item_name: str = item.get("ItemName", "")
            # ItemName format: "Team1 - Team2"
            if " - " in item_name:
                parts = item_name.split(" - ", 1)
                home, away = parts[0].strip(), parts[1].strip()
            else:
                home, away = item_name, ""

            league = item.get("TournamentName", "")
            match_id = str(item.get("ItemID", ""))
            match_time = item.get("ItemDate", "")

            # Parse odds from OddsCollection[0] → MatchOdds
            home_odds = draw_odds = away_odds = None
            for oc in item.get("OddsCollection", []):
                ot_name = (oc.get("OddsType") or {}).get("OddsTypeName", "")
                if ot_name != "1X2":
                    continue
                for mo in oc.get("MatchOdds", []):
                    odd_name = (mo.get("OddAttribute") or {}).get("OddName", "")
                    outcome = (mo.get("Outcome") or {}).get("OddOutcome")
                    if odd_name == "1":
                        home_odds = outcome
                    elif odd_name == "X":
                        draw_odds = outcome
                    elif odd_name == "2":
                        away_odds = outcome
                break  # only need first OddsCollection (1X2)

            if home_odds is None or away_odds is None:
                continue

            results.append({
                "bookmaker": "betking",
                "sport": sport,
                "match": f"{home} vs {away}",
                "league": league,
                "home_odds": home_odds,
                "draw_odds": draw_odds,
                "away_odds": away_odds,
                "match_id": match_id,
                "match_time": match_time,
            })

    return results


# ─── Betika ──────────────────────────────────────────────────────────────────

BETIKA_SPORTS_URL = "https://api.betika.com/v1/sports"
BETIKA_MATCHES_URL = "https://api.betika.com/v1/uo/matches"
BETIKA_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.betika.com",
    "Referer": "https://www.betika.com/",
}


def _betika_get_sports() -> list[tuple[str, str]]:
    """Fetch all available sports from Betika's /v1/sports endpoint."""
    req = urllib.request.Request(BETIKA_SPORTS_URL, headers=BETIKA_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        return [(s["sport_id"], s["sport_name"]) for s in data.get("data", [])]
    except Exception as e:
        print(f"[WARN] betika /v1/sports failed: {e}", file=sys.stderr)
        return [("14", "Soccer")]  # fallback


def scrape_betika(max_pages: int = 10) -> list[dict]:
    """Scrape Betika for all sports via their public matches API (no auth required)."""
    sports = _betika_get_sports()
    all_results = []

    for sport_id, sport_name in sports:
        results = []
        page = 1

        while page <= max_pages:
            url = f"{BETIKA_MATCHES_URL}?sport_id={sport_id}&limit=50&page={page}"
            req = urllib.request.Request(url, headers=BETIKA_HEADERS)
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    data = json.loads(r.read())
            except Exception as e:
                print(f"[WARN] betika {sport_name} page {page}: {e}", file=sys.stderr)
                break

            events = data.get("data", [])
            if not events:
                break

            for ev in events:
                home = ev.get("home_team", "")
                away = ev.get("away_team", "")
                if not home or not away:
                    continue

                # neutral_odd = draw in Betika's field naming
                try:
                    home_odds = float(ev.get("home_odd") or 0) or None
                    draw_odds = float(ev.get("neutral_odd") or 0) or None
                    away_odds = float(ev.get("away_odd") or 0) or None
                except (ValueError, TypeError):
                    home_odds = draw_odds = away_odds = None

                if home_odds is None or away_odds is None:
                    continue

                results.append({
                    "bookmaker": "betika",
                    "match": f"{home} vs {away}",
                    "league": ev.get("competition_name", ""),
                    "sport": ev.get("sport_name", sport_name),
                    "country": ev.get("category", ""),
                    "home_odds": home_odds,
                    "draw_odds": draw_odds,
                    "away_odds": away_odds,
                    "match_id": str(ev.get("match_id", "")),
                    "match_time": ev.get("start_time", ""),
                })

            meta = data.get("meta", {})
            total = int(meta.get("total") or 0)
            limit = int(meta.get("limit") or 50)
            if page * limit >= total:
                break
            page += 1
            time.sleep(0.3)

        print(f"[INFO]   betika/{sport_name}: {len(results)} events", file=sys.stderr)
        all_results.extend(results)
        time.sleep(0.5)

    return all_results


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    all_results = []

    # 1xCorp family — collect canonical 1xbet rows separately so we can enrich them
    xcorp_1xbet_rows: list[dict] = []
    for name, cfg in PROVIDERS_1XCORP.items():
        print(f"[INFO] Scraping {name} (all sports) ...", file=sys.stderr)
        rows = scrape_1xcorp(name, cfg["host"], cfg["partner"])
        print(f"[INFO]   {name}: {len(rows)} events", file=sys.stderr)
        if name == "1xbet":
            xcorp_1xbet_rows = rows
        all_results.extend(rows)
        time.sleep(0.5)  # gentle rate limit

    # Enrich 1xbet rows with additional market types for all supported sports
    sports_1xbet: dict[str, list] = {}
    for r in xcorp_1xbet_rows:
        sports_1xbet.setdefault(r.get("sport", ""), []).append(r)
    scrape_1xcorp_details(sports_1xbet)


    # BetKing
    print("[INFO] Scraping betking (all sports) ...", file=sys.stderr)
    rows = scrape_betking()
    print(f"[INFO]   betking: {len(rows)} events", file=sys.stderr)
    all_results.extend(rows)

    # Betika
    print("[INFO] Scraping betika (all sports) ...", file=sys.stderr)
    rows = scrape_betika()
    print(f"[INFO]   betika: {len(rows)} events", file=sys.stderr)
    all_results.extend(rows)

    print(json.dumps(all_results, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
