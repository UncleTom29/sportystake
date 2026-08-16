#!/usr/bin/env python3
"""
getline_scraper.py
Fetches per-event detailed markets from 1xCorp's GetLine endpoint.

Input  (stdin): JSON array of integer game IDs, e.g. [123456, 789012, ...]
Output (stdout): JSON array of NormalizedOdds-compatible objects:
  [
    {
      "fixtureId": 123456,
      "bookmakerName": "1xbet",
      "updatedAt": "2026-05-20T01:00:00Z",
      "markets": [
        {
          "market": "over_under_25",
          "outcomes": [
            {"key": "over",  "label": "O 2.5", "decimal": 1.85, "valueX1000": 1850},
            {"key": "under", "label": "U 2.5", "decimal": 1.95, "valueX1000": 1950}
          ]
        },
        ...
      ]
    },
    ...
  ]
"""

import json
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Canonical 1xCorp provider (partner + host)
GETLINE_HOST    = "1xbet.ng"
GETLINE_PARTNER = 3

GETLINE_TMPL = (
    "https://{host}/service-api/LineFeed/GetLine"
    "?GameId={game_id}&lang=en&country=132"
    "&partner={partner}&getEmpty=true"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

# ─── Market-type mapping ─────────────────────────────────────────────────────
#
# 1xCorp GetLine groups (GN = group name, G = group id) contain outcome arrays.
# We map known group names to our internal market-type strings.
#
# Outcome type codes (T field):
#   1=Home, 2=Draw, 3=Away           (1X2)
#   4=1X, 5=12, 6=X2                 (double chance)
#   7=Home+, 8=Away+                 (asian handicap — P field = line)
#   9=Over, 10=Under                 (totals — P field = line)
#   11=Yes, 12=No                    (btts / both teams to score)
#   13=Home DNB, 14=Away DNB         (draw no bet)
#  (Half-time uses T=1/2/3 inside a GN that contains "Half")

HALF_TIME_GN_FRAGMENTS = ["half", "1st half", "first half", "ht"]


def _gn_contains(gn: str, fragments: list[str]) -> bool:
    low = gn.lower()
    return any(f in low for f in fragments)


def _round3(v: float) -> float:
    return round(v, 3)


def _v1000(v: float) -> int:
    return round(v * 1000)


def _parse_group(gn: str, outcomes_raw: list[dict]) -> list[dict] | None:
    """
    Convert one GetLine market group into a list of our internal market dicts:
      [{"market": "over_under_25", "outcomes": [...]}]
    Returns None if the group is unrecognised or has no valid odds.
    """
    gn_low = gn.lower()
    parsed: list[dict] = []

    # ── Over / Under (totals) ──────────────────────────────────────────────
    if "total" in gn_low and not _gn_contains(gn_low, HALF_TIME_GN_FRAGMENTS):
        by_line: dict[str, tuple[float | None, float | None]] = {}
        for o in outcomes_raw:
            t = o.get("T")
            c = o.get("C")
            p = o.get("P")
            if not c or c <= 1.0:
                continue
            if p is None:
                continue
            line_key = f"{p:.1f}".replace(".0", "").rstrip("0").rstrip(".")
            # normalise to e.g. "2.5", "1.5", "3.5"
            try:
                line_float = float(p)
            except (ValueError, TypeError):
                continue
            line_str = f"{line_float:.1f}"  # e.g. "2.5"
            over, under = by_line.get(line_str, (None, None))
            if t == 9:
                over = float(c)
            elif t == 10:
                under = float(c)
            else:
                continue
            by_line[line_str] = (over, under)

        for line_str, (over, under) in by_line.items():
            if over and under and over > 1 and under > 1:
                # "2.5" → "over_under_25", "3.5" → "over_under_35"
                mtype = "over_under_" + line_str.replace(".", "")
                parsed.append({
                    "market": mtype,
                    "outcomes": [
                        {"key": "over",  "label": f"O {line_str}", "decimal": _round3(over),  "valueX1000": _v1000(over)},
                        {"key": "under", "label": f"U {line_str}", "decimal": _round3(under), "valueX1000": _v1000(under)},
                    ],
                })
        return parsed or None

    # ── Asian Handicap ─────────────────────────────────────────────────────
    if "handicap" in gn_low and not _gn_contains(gn_low, HALF_TIME_GN_FRAGMENTS):
        by_line: dict[str, tuple[float | None, float | None]] = {}  # type: ignore[assignment]
        for o in outcomes_raw:
            t = o.get("T")
            c = o.get("C")
            p = o.get("P", 0)
            if not c or c <= 1.0:
                continue
            try:
                line_float = float(p)
            except (ValueError, TypeError):
                continue
            line_str = f"{line_float:+.1f}"  # e.g. "+0.0", "-1.5"
            home, away = by_line.get(line_str, (None, None))
            if t == 7:
                home = float(c)
            elif t == 8:
                away = float(c)
            else:
                continue
            by_line[line_str] = (home, away)

        for line_str, (home, away) in by_line.items():
            if home and away and home > 1 and away > 1:
                parsed.append({
                    "market": "asian_handicap",
                    "outcomes": [
                        {"key": "home", "label": f"1 ({line_str})", "decimal": _round3(home), "valueX1000": _v1000(home)},
                        {"key": "away", "label": f"2 ({line_str})", "decimal": _round3(away), "valueX1000": _v1000(away)},
                    ],
                })
        # Only keep the 0-line handicap (most useful single-row display)
        zero_line = next((m for m in parsed if m["outcomes"][0]["label"].startswith("1 (+0")), None)
        return [zero_line] if zero_line else (parsed[:1] if parsed else None)

    # ── Double Chance ──────────────────────────────────────────────────────
    if "double" in gn_low and "chance" in gn_low:
        sels = []
        for o in outcomes_raw:
            t = o.get("T")
            c = o.get("C")
            if not c or c <= 1.0:
                continue
            if t == 4:
                sels.append({"key": "1X", "label": "1X", "decimal": _round3(c), "valueX1000": _v1000(c)})
            elif t == 5:
                sels.append({"key": "12", "label": "12", "decimal": _round3(c), "valueX1000": _v1000(c)})
            elif t == 6:
                sels.append({"key": "X2", "label": "X2", "decimal": _round3(c), "valueX1000": _v1000(c)})
        return [{"market": "double_chance", "outcomes": sels}] if len(sels) >= 2 else None

    # ── Both Teams to Score ────────────────────────────────────────────────
    if "both" in gn_low and ("score" in gn_low or "goal" in gn_low):
        sels = []
        for o in outcomes_raw:
            t = o.get("T")
            c = o.get("C")
            if not c or c <= 1.0:
                continue
            if t == 11:
                sels.append({"key": "yes", "label": "Yes", "decimal": _round3(c), "valueX1000": _v1000(c)})
            elif t == 12:
                sels.append({"key": "no",  "label": "No",  "decimal": _round3(c), "valueX1000": _v1000(c)})
        return [{"market": "btts", "outcomes": sels}] if len(sels) == 2 else None

    # ── Draw No Bet ────────────────────────────────────────────────────────
    if "draw no bet" in gn_low or "dnb" in gn_low:
        sels = []
        for o in outcomes_raw:
            t = o.get("T")
            c = o.get("C")
            if not c or c <= 1.0:
                continue
            if t == 13:
                sels.append({"key": "home", "label": "Home", "decimal": _round3(c), "valueX1000": _v1000(c)})
            elif t == 14:
                sels.append({"key": "away", "label": "Away", "decimal": _round3(c), "valueX1000": _v1000(c)})
        return [{"market": "draw_no_bet", "outcomes": sels}] if len(sels) == 2 else None

    # ── Half-Time Result ───────────────────────────────────────────────────
    if _gn_contains(gn_low, HALF_TIME_GN_FRAGMENTS) and ("result" in gn_low or "winner" in gn_low or "1x2" in gn_low):
        sels = []
        for o in outcomes_raw:
            t = o.get("T")
            c = o.get("C")
            if not c or c <= 1.0:
                continue
            if t == 1:
                sels.append({"key": "1", "label": "1",  "decimal": _round3(c), "valueX1000": _v1000(c)})
            elif t == 2:
                sels.append({"key": "X", "label": "X",  "decimal": _round3(c), "valueX1000": _v1000(c)})
            elif t == 3:
                sels.append({"key": "2", "label": "2",  "decimal": _round3(c), "valueX1000": _v1000(c)})
        return [{"market": "half_time_result", "outcomes": sels}] if len(sels) >= 2 else None

    return None


def _fetch_json(url: str, timeout: int = 15) -> dict | None:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"[WARN] HTTP {e.code} for {url}", file=sys.stderr)
    except Exception as e:
        print(f"[WARN] fetch error ({url}): {e}", file=sys.stderr)
    return None


def fetch_getline(game_id: int) -> dict | None:
    url = GETLINE_TMPL.format(
        host=GETLINE_HOST,
        game_id=game_id,
        partner=GETLINE_PARTNER,
    )
    data = _fetch_json(url)
    if not data or not data.get("Success"):
        return None

    value = data.get("Value")
    if not value:
        return None

    # GE = list of market groups
    groups = value.get("GE") or []
    if not groups:
        print(f"[WARN] GetLine {game_id}: no GE groups in response", file=sys.stderr)
        return None

    now_iso = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    all_markets: list[dict] = []

    for grp in groups:
        gn = grp.get("GN") or grp.get("N") or ""
        if not gn:
            continue
        # Outcomes may be in E or ME
        outcomes_raw = grp.get("E") or grp.get("ME") or []
        if not outcomes_raw:
            # Some versions nest them inside sub-groups
            for sub in grp.get("GE") or []:
                sub_gn = sub.get("GN") or sub.get("N") or gn
                sub_outcomes = sub.get("E") or sub.get("ME") or []
                result = _parse_group(sub_gn, sub_outcomes)
                if result:
                    all_markets.extend(result)
            continue

        result = _parse_group(gn, outcomes_raw)
        if result:
            all_markets.extend(result)

    if not all_markets:
        return None

    return {
        "fixtureId": game_id,
        "bookmakerName": "1xbet",
        "updatedAt": now_iso,
        "markets": all_markets,
    }


def main() -> int:
    raw = sys.stdin.read().strip()
    if not raw:
        print("[]")
        return 0

    try:
        game_ids: list[int] = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON input: {e}", file=sys.stderr)
        return 1

    results: list[dict] = []
    for i, gid in enumerate(game_ids):
        result = fetch_getline(int(gid))
        if result:
            results.append(result)
            mcount = len(result["markets"])
            print(f"[INFO] GetLine {gid}: {mcount} markets", file=sys.stderr)
        else:
            print(f"[WARN] GetLine {gid}: no data", file=sys.stderr)

        # Gentle rate-limiting: 50ms between requests
        if i < len(game_ids) - 1:
            time.sleep(0.05)

    print(json.dumps(results))
    return 0


if __name__ == "__main__":
    sys.exit(main())
