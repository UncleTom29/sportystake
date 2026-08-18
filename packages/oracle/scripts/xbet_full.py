#!/usr/bin/env python3
"""
xbet_full.py

Single-provider scraper for 1xbet.ng. Discovers every sport ID 1xbet exposes,
pulls the full prematch event list per sport, then fetches per-event market
detail via GetGameZip so we capture every available line/odds for every
mappable market group (1X2, totals at every offered line, BTTS, DNB, double
chance, whole/half-line asian handicaps). No genuine half-time-scoped market
has been identified in this response shape — see _build_double_chance's
docstring for how that gap was previously misfilled by a mislabeled group.
Individual team totals are deliberately not scraped — see the comment above
where _build_team_totals used to be for why.

Output: JSON array on stdout. Each row carries:

    {
      "bookmaker":  "1xbet",
      "match_id":   "722176549",
      "match":      "Bologna 1909 vs Internazionale Milano",
      "sport":      "Football",
      "league":     "Italy. Serie A",
      "country":    "Italy",
      "match_time": "2026-05-23T16:00:00Z",
      "home_odds":  3.008, "draw_odds": 3.6, "away_odds": 2.2,   # convenience
      "live_score":  "...",        # optional, for settlement
      "live_status": 2,            # optional, 1xbet status enum
      "markets": [
        {"key": "1X2", "label": "Match Result",
         "outcomes": [
           {"key": "1", "label": "Home", "odds": 3.008},
           {"key": "X", "label": "Draw", "odds": 3.6  },
           {"key": "2", "label": "Away", "odds": 2.2  },
         ]},
        {"key": "over_under_25", "label": "Total 2.5",
         "outcomes": [{"key":"over",  "label":"Over 2.5",  "odds":1.53},
                      {"key":"under", "label":"Under 2.5", "odds":2.32}]},
        … every other line/market the event exposes …
      ]
    }

bookmaker is always "1xbet". Logs go to stderr; only the JSON is written to
stdout so the calling Node process can pipe it straight into JSON.parse.
"""

# Defers annotation evaluation (PEP 563) so `X | None`-style hints below don't
# raise at import time on macOS's bundled /usr/bin/python3 (3.9), which can
# silently win the PATH race ahead of a newer interpreter depending on how the
# oracle process was launched. See also python-runtime.ts on the Node side.
from __future__ import annotations

import json
import random
import socket
import sys
import threading
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed, wait
from datetime import datetime, timezone

HOST    = "1xbet.ng"
PARTNER = 3
COUNTRY = 132  # Nigeria — Africa-facing partition (widest sport coverage).

LINE_URL = (
    f"https://{HOST}/service-api/LineFeed/Get1x2_VZip"
    f"?sports={{sid}}&count=200&lng=en&mode=4&country={COUNTRY}"
    f"&partner={PARTNER}&getEmpty=true&virtualSports=true"
)
GAMZIP_URL = (
    f"https://{HOST}/service-api/LineFeed/GetGameZip"
    f"?id={{gid}}&lang=en&country={COUNTRY}&partner={PARTNER}&getEmpty=true"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

# 1xbet uses small dense sport IDs; 100 is well above anything in production.
MAX_SPORT_ID = 100
# Cap per-sport detail fetches so total scrape stays under the 3-min cron tick.
DETAIL_CAP_PER_SPORT = 80
# 1xbet Simulated Reality League virtuals have IDs ≥ 1 billion — skip them.
VIRTUAL_ID_THRESHOLD = 1_000_000_000
# Stop submitting new detail fetches past this much wall-clock time so a slow
# or throttled run degrades to partial results instead of running into the
# Node caller's SCRAPER_TIMEOUT_MS (240s) and losing the whole cycle.
ENRICH_BUDGET_S = 190

# ─── 1xbet market group IDs (reverse-engineered from public LineFeed) ────────
# G = market group, T = outcome type, P = line parameter.

_G_1X2       = 1     # T=1 Home, T=2 Draw, T=3 Away
_G_AH        = 2     # T=7 home line (P=h), T=8 away line (P=-h)
_G_DC        = 8     # T=4 1X, T=5 12, T=6 X2 (double chance — see _build_double_chance)
_G_DNB       = 14    # T=182 Home, T=183 Away
_G_TOTAL     = 17    # T=9 over (P=line), T=10 under
_G_BTTS      = 19    # T=180 Yes, T=181 No


# ─── HTTP helpers ────────────────────────────────────────────────────────────
#
# 1xbet's own rate-limiter starts returning 429 once request bursts get too
# high — seen firsthand: 122/719 GetGameZip detail calls dropped in a single
# run at 8-way unthrottled concurrency. `_RateLimiter` smooths dispatch to a
# steady pace shared across every thread and every call site, and backs off
# harder, automatically, once 1xbet starts saying no — instead of continuing
# to hammer at the same rate for the rest of the run.

class _RateLimiter:
    REQUESTS_PER_SEC = 10.0
    TRIP_AFTER = 6          # consecutive 429s before backing off harder
    MAX_INTERVAL_S = 1.5

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._next_slot = time.monotonic()
        self._interval = 1.0 / self.REQUESTS_PER_SEC
        self._consecutive_429 = 0

    def wait_turn(self) -> None:
        with self._lock:
            now = time.monotonic()
            start = max(now, self._next_slot)
            self._next_slot = start + self._interval
        if start > now:
            time.sleep(start - now)

    def report(self, status: int | None) -> None:
        with self._lock:
            if status == 429:
                self._consecutive_429 += 1
                if self._consecutive_429 == self.TRIP_AFTER:
                    self._interval = min(self.MAX_INTERVAL_S, self._interval * 3)
                    print(
                        f"[WARN] circuit-breaker: {self._consecutive_429} consecutive "
                        f"429s — backing off to {self._interval:.2f}s between requests",
                        file=sys.stderr,
                    )
            elif status is not None:
                self._consecutive_429 = 0


_limiter = _RateLimiter()


def _retry_wait(attempt: int, err: urllib.error.HTTPError | None) -> float:
    if err is not None and err.headers is not None:
        retry_after = err.headers.get("Retry-After")
        if retry_after:
            try:
                return min(8.0, float(retry_after))
            except ValueError:
                pass
    return min(8.0, 0.5 * (2 ** attempt) + random.uniform(0, 0.25))


def _fetch_json(url: str, timeout: int = 15, max_retries: int = 2) -> dict | None:
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(max_retries + 1):
        _limiter.wait_turn()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                _limiter.report(r.status)
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            _limiter.report(e.code)
            if e.code == 406:
                return None
            if (e.code == 429 or e.code >= 500) and attempt < max_retries:
                time.sleep(_retry_wait(attempt, e))
                continue
            print(f"[WARN] HTTP {e.code}: {url}", file=sys.stderr)
            return None
        except Exception as e:
            _limiter.report(None)
            if attempt < max_retries:
                time.sleep(_retry_wait(attempt, None))
                continue
            print(f"[WARN] fetch error {e}: {url}", file=sys.stderr)
            return None
    return None


def _ts_to_iso(ts: int) -> str:
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return ""


def _line_suffix(line: float) -> str:
    """Encode a decimal line as the integer line × 10 (sign preserved).
    `2.5` → `"25"`, `-1.5` → `"-15"`, `0` → `"0"`. Matches the existing
    `over_under_XX` convention used by the frontend match-detail page."""
    return str(int(round(line * 10)))


# ─── Sport discovery ────────────────────────────────────────────────────────

def discover_sports() -> list[tuple[int, str]]:
    """Probe sport IDs 1..MAX_SPORT_ID. Keep IDs that return ≥ 1 event."""
    try:
        socket.getaddrinfo(HOST, 443, type=socket.SOCK_STREAM)
    except Exception:
        pass

    def probe(sid: int) -> tuple[int, str, int] | None:
        d = _fetch_json(LINE_URL.format(sid=sid), timeout=12)
        if not d or not d.get("Success"):
            return None
        events = d.get("Value") or []
        if not events:
            return None
        return sid, events[0].get("SN", f"Sport-{sid}"), len(events)

    out: list[tuple[int, str]] = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for f in as_completed([ex.submit(probe, sid) for sid in range(1, MAX_SPORT_ID + 1)]):
            r = f.result()
            if r:
                out.append((r[0], r[1]))
    out.sort()
    return out


# ─── Event listing per sport ─────────────────────────────────────────────────

def fetch_sport_events(sid: int, sport_name: str) -> list[dict]:
    """Return a normalised list of prematch events for one sport (1X2 only)."""
    d = _fetch_json(LINE_URL.format(sid=sid))
    if not d or not d.get("Success"):
        return []

    rows: list[dict] = []
    for ev in d.get("Value") or []:
        home, away = ev.get("O1"), ev.get("O2")
        if not home or not away:
            continue
        mid = str(ev.get("I", ""))
        if not mid or int(mid) >= VIRTUAL_ID_THRESHOLD:
            continue
        if home == "Home" and away == "Away":
            continue

        # 1X2 baseline from the list response (avoids one detail call for
        # sports we won't enrich further).
        h = d_ = a = None
        for o in ev.get("E", []):
            t, c = o.get("T"), o.get("C")
            if t == 1: h = c
            elif t == 2: d_ = c
            elif t == 3: a = c
        # 2-outcome sports report player 2 in slot T=2 when T=3 is absent.
        if a is None and d_ is not None:
            a, d_ = d_, None
        if h is None or a is None:
            continue

        rows.append({
            "bookmaker":  "1xbet",
            "sport":      ev.get("SN", sport_name),
            "sport_id":   ev.get("SI", sid),
            "match":      f"{home} vs {away}",
            "league":     ev.get("L", ""),
            "country":    ev.get("CN", ""),
            "home_odds":  h,
            "draw_odds":  d_,
            "away_odds":  a,
            "match_id":   mid,
            "match_time": _ts_to_iso(ev.get("S", 0)),
        })
    return rows


# ─── Market builders (per group → list of normalised market entries) ─────────

def _build_1x2(by_g: dict, home_name: str, away_name: str) -> list[dict]:
    h = d = a = None
    for e in by_g.get(_G_1X2, []):
        t, c = e.get("T"), e.get("C")
        if t == 1: h = c
        elif t == 2: d = c
        elif t == 3: a = c
    if h is None or a is None:
        return []
    outs = [{"key": "1", "label": home_name, "odds": float(h)}]
    if d is not None and float(d) > 1:
        outs.append({"key": "X", "label": "Draw", "odds": float(d)})
    outs.append({"key": "2", "label": away_name, "odds": float(a)})
    return [{"key": "1X2", "label": "Match Result", "outcomes": outs}]


def _build_totals(by_g: dict, group_id: int, key_prefix: str, label_prefix: str) -> list[dict]:
    """Generic over/under builder. Emits one entry per offered line."""
    lines: dict[float, dict] = {}
    over_t, under_t = (9, 10) if group_id == _G_TOTAL else (11, 12)
    for e in by_g.get(group_id, []):
        t, p, c = e.get("T"), e.get("P"), e.get("C")
        if p is None or c is None: continue
        if t == over_t:  lines.setdefault(float(p), {})["over"]  = float(c)
        if t == under_t: lines.setdefault(float(p), {})["under"] = float(c)
    out: list[dict] = []
    for line in sorted(lines):
        v = lines[line]
        o, u = v.get("over"), v.get("under")
        if not (o and u and o > 1 and u > 1): continue
        suf = _line_suffix(line)
        out.append({
            "key":   f"{key_prefix}_{suf}",
            "label": f"{label_prefix} {line}",
            "outcomes": [
                {"key": "over",  "label": f"Over {line}",  "odds": o},
                {"key": "under", "label": f"Under {line}", "odds": u},
            ],
        })
    return out


def _build_btts(by_g: dict) -> list[dict]:
    yes = no = None
    for e in by_g.get(_G_BTTS, []):
        t, c = e.get("T"), e.get("C")
        if t == 180: yes = float(c)
        if t == 181: no  = float(c)
    if not (yes and no and yes > 1 and no > 1):
        return []
    return [{
        "key": "btts", "label": "Both Teams to Score",
        "outcomes": [
            {"key": "yes", "label": "Yes", "odds": yes},
            {"key": "no",  "label": "No",  "odds": no},
        ],
    }]


def _build_dnb(by_g: dict, home_name: str, away_name: str) -> list[dict]:
    h = a = None
    for e in by_g.get(_G_DNB, []):
        t, c = e.get("T"), e.get("C")
        if t == 182: h = float(c)
        if t == 183: a = float(c)
    if not (h and a and h > 1 and a > 1):
        return []
    return [{
        "key": "draw_no_bet", "label": "Draw No Bet",
        "outcomes": [
            {"key": "1", "label": home_name, "odds": h},
            {"key": "2", "label": away_name, "odds": a},
        ],
    }]


def _build_double_chance(by_g: dict) -> list[dict]:
    """T=4/5/6 under this group are 1X/12/X2 respectively — verified against
    GetGameZip live data across several real fixtures by cross-checking each
    value against the vig-free combination of the corresponding 1X2 odds
    (e.g. 1X should sit close to 1/(1/oddsHome + 1/oddsDraw)); every sample
    matched within a normal single-bookmaker margin, including a heavy
    favorite case where the combined X2 price correctly clamped just above
    1.00. This group was previously (incorrectly) treated as a half-time
    1X2 market — no group carrying genuine half-time-scoped 1X2 odds was
    found in this response shape, so that label was never backed by real
    half-time data; this fixes the mislabeling rather than removing it."""
    one_x = one_two = x_two = None
    for e in by_g.get(_G_DC, []):
        t, c = e.get("T"), e.get("C")
        if t == 4: one_x = c
        elif t == 5: one_two = c
        elif t == 6: x_two = c
    outs = []
    if one_x and float(one_x) > 1:
        outs.append({"key": "1X", "label": "1X", "odds": float(one_x)})
    if one_two and float(one_two) > 1:
        outs.append({"key": "12", "label": "12", "odds": float(one_two)})
    if x_two and float(x_two) > 1:
        outs.append({"key": "X2", "label": "X2", "odds": float(x_two)})
    if len(outs) < 2:
        return []
    return [{"key": "double_chance", "label": "Double Chance", "outcomes": outs}]


def _build_asian_handicap(by_g: dict, home_name: str, away_name: str) -> list[dict]:
    """Pair T=7 (P=home line) with T=8 (P=-home line). Emit every paired line."""
    home_lines: dict[float, float] = {}
    away_lines: dict[float, float] = {}
    for e in by_g.get(_G_AH, []):
        t, p, c = e.get("T"), e.get("P"), e.get("C")
        if p is None or c is None: continue
        if t == 7: home_lines[float(p)] = float(c)
        if t == 8: away_lines[float(p)] = float(c)
    out: list[dict] = []
    for line in sorted(home_lines):
        if -line not in away_lines: continue
        ho, ao = home_lines[line], away_lines[-line]
        if not (ho > 1 and ao > 1): continue
        # Quarter lines (e.g. -0.25, +0.75) don't survive the ×10-integer
        # round-trip _line_suffix/the frontend rely on for encoding — and
        # settlement.ts's resolveAsianHandicapBet already refuses to
        # auto-resolve them (splits stake across two half-lines under true
        # Asian handicap rules, which BettingCore's win/lose/void has no way
        # to express). Never offering them here keeps what's bettable in
        # sync with what can actually be labeled correctly AND settled.
        if abs(line * 2 - round(line * 2)) > 1e-9: continue
        suf = _line_suffix(line)
        # Human-friendly handicap labels: positive home line = "AH home +X",
        # negative = "AH home -X". Same applies to away with opposite sign.
        h_sign = "+" if line > 0 else ""
        a_sign = "+" if -line > 0 else ""
        out.append({
            "key":   f"asian_handicap_{suf}",
            "label": f"Asian Handicap {line:+g}",
            "outcomes": [
                {"key": "1", "label": f"{home_name} ({h_sign}{line:g})",  "odds": ho},
                {"key": "2", "label": f"{away_name} ({a_sign}{-line:g})", "odds": ao},
            ],
        })
    return out


## Individual team totals (1xbet G=15, T=11 over / T=12 under, P=line) are
## deliberately NOT scraped. The feed carries no team tag on these entries —
## when both teams' lines are offered they land in the same (T, P)-keyed
## bucket with no way to tell which team a given "Over 1.5" belongs to, so
## neither a correct label nor a safe settlement (homeScore vs awayScore
## needs to know which side) is possible from this response shape. A
## previous attempt published them anyway under a generic 'team_total_*'
## key the frontend never actually parsed correctly (it expected a
## 'team_total_<home|away>_<line>' shape this never produced), so the tab
## was live but every row's label was garbled — and even a fixed label
## would still have been unresolvable, so removed rather than repaired.


# ─── Per-event detail enrichment ─────────────────────────────────────────────

def _augment(row: dict) -> None:
    """Fetch GetGameZip and attach every market we can map."""
    gid = row.get("match_id")
    if not gid:
        return
    d = _fetch_json(GAMZIP_URL.format(gid=gid), timeout=12)
    if not d or not d.get("Success"):
        return
    val = d.get("Value") or {}

    by_g: dict = {}
    for e in val.get("E", []):
        by_g.setdefault(e.get("G"), []).append(e)

    # Settlement signals — present once the event is in-play or finished.
    if "SC" in val: row["live_score"]  = val.get("SC")
    if "SS" in val: row["live_status"] = val.get("SS")

    home_name = (row.get("match") or "").split(" vs ", 1)[0] or "Home"
    away_name = (row.get("match") or "").split(" vs ", 1)[1] if " vs " in (row.get("match") or "") else "Away"

    markets: list[dict] = []
    markets.extend(_build_1x2(by_g, home_name, away_name))
    markets.extend(_build_totals(by_g, _G_TOTAL, "over_under", "Total"))
    markets.extend(_build_btts(by_g))
    markets.extend(_build_dnb(by_g, home_name, away_name))
    markets.extend(_build_double_chance(by_g))
    markets.extend(_build_asian_handicap(by_g, home_name, away_name))

    if markets:
        row["markets"] = markets


def augment_all(rows: list[dict], deadline: float) -> None:
    if not rows:
        return
    print(f"[INFO] Enriching {len(rows)} events with detail markets…", file=sys.stderr)
    # 6 workers, paced through the shared rate limiter below — trims peak
    # concurrent connections without materially slowing down a healthy run.
    ex = ThreadPoolExecutor(max_workers=6)
    try:
        futures = [ex.submit(_augment, r) for r in rows]
        budget = max(0.0, deadline - time.time())
        done, pending = wait(futures, timeout=budget)
        if pending:
            print(
                f"[WARN] enrichment budget exhausted — {len(pending)}/{len(rows)} "
                f"events left unenriched this cycle",
                file=sys.stderr,
            )
        for f in done:
            try:
                f.result()
            except Exception as e:
                print(f"[WARN] augment err: {e}", file=sys.stderr)
    finally:
        # cancel_futures drops anything still queued; already-running requests
        # (bounded by max_workers) are left to finish so we don't leak sockets.
        ex.shutdown(wait=True, cancel_futures=True)
    enriched = sum(1 for r in rows if "markets" in r)
    print(f"[INFO]   detail-enriched: {enriched}/{len(rows)} events", file=sys.stderr)


# ─── Entry point ─────────────────────────────────────────────────────────────

def main() -> int:
    t0 = time.time()
    print("[INFO] Discovering sports…", file=sys.stderr)
    sports = discover_sports()
    print(f"[INFO]   {len(sports)} sport IDs respond with events", file=sys.stderr)

    all_rows: list[dict] = []
    for sid, name in sports:
        rows = fetch_sport_events(sid, name)
        print(f"[INFO]   sid={sid:>3} {name:25} -> {len(rows)} events", file=sys.stderr)
        all_rows.extend(rows)

    # Enrich a bounded subset per sport so total runtime stays predictable.
    enrich_targets: list[dict] = []
    by_sport: dict[int, list[dict]] = {}
    for r in all_rows:
        by_sport.setdefault(r.get("sport_id") or 0, []).append(r)
    for _sid, rows in by_sport.items():
        enrich_targets.extend(rows[:DETAIL_CAP_PER_SPORT])
    augment_all(enrich_targets, deadline=t0 + ENRICH_BUDGET_S)

    # Strip the helper field — the TS layer never reads sport_id.
    for r in all_rows:
        r.pop("sport_id", None)
        # Always at least emit the 1X2 market so the listing has odds to render
        # even for events we didn't enrich.
        if "markets" not in r:
            outs = [{"key": "1", "label": (r.get("match") or "Home vs Away").split(" vs ", 1)[0],
                     "odds": float(r["home_odds"])}]
            if r.get("draw_odds") is not None and float(r["draw_odds"]) > 1:
                outs.append({"key": "X", "label": "Draw", "odds": float(r["draw_odds"])})
            outs.append({"key": "2",
                         "label": (r.get("match") or "Home vs Away").split(" vs ", 1)[1] if " vs " in (r.get("match") or "") else "Away",
                         "odds": float(r["away_odds"])})
            r["markets"] = [{"key": "1X2", "label": "Match Result", "outcomes": outs}]

    elapsed = time.time() - t0
    print(f"[INFO] DONE: {len(all_rows)} events in {elapsed:.1f}s", file=sys.stderr)
    print(json.dumps(all_rows, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
