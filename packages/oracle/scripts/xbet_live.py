#!/usr/bin/env python3
"""
xbet_live.py

Polls 1xbet's LiveFeed for every responsive sport ID and emits a flat JSON
array of in-play events with current score / period info, plus a `finished`
flag derived from the SC.FS (final-score) field 1xbet sets when an event
wraps up. Drives the settlement path in the sync-worker.

Each row:

    {
      "match_id":   "722176549",
      "match":      "Home vs Away",
      "sport":      "Football",
      "league":     "Italy. Serie A",
      "match_time": "2026-05-23T16:00:00Z",
      "score":   {"home": 1, "away": 0},
      "period":  "2nd half",          # optional
      "minute":  62,                  # best-effort, only if 1xbet supplies one
      "finished": false
    }
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
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

HOST_CANDIDATES = [
    "1xbet.co.ke",
    "1xbet.ug",
    "1xbet.cm",
    "22bet.ng",
    "betwinner.ng",
    "1x-bet.mobi",
    "1xbet.ng",
]
_active_host_idx = 0
_host_lock = threading.Lock()

def get_active_host() -> str:
    with _host_lock:
        return HOST_CANDIDATES[_active_host_idx % len(HOST_CANDIDATES)]

def rotate_host(failed_host: str) -> str:
    global _active_host_idx
    with _host_lock:
        if HOST_CANDIDATES[_active_host_idx % len(HOST_CANDIDATES)] == failed_host:
            _active_host_idx += 1
            print(f"[INFO] Rotated 1xbet mirror to: {HOST_CANDIDATES[_active_host_idx % len(HOST_CANDIDATES)]}", file=sys.stderr)
        return HOST_CANDIDATES[_active_host_idx % len(HOST_CANDIDATES)]

PARTNER = 3
COUNTRY = 132

def make_live_url(sid: int) -> str:
    host = get_active_host()
    return (
        f"https://{host}/service-api/LiveFeed/Get1x2_VZip"
        f"?sports={sid}&count=200&lng=en&mode=4&country={COUNTRY}&partner={PARTNER}"
    )

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

# Probe sport IDs 1..MAX_SPORT_ID. Live coverage is narrower than prematch.
MAX_SPORT_ID = 100
VIRTUAL_ID_THRESHOLD = 1_000_000_000


# Shared pacing + adaptive circuit breaker — same target/backend as
# xbet_full.py, which was observed getting 429'd under unthrottled concurrent
# bursts. Cheap to carry over here even though this script's own request
# volume (~1 call per sport ID) hasn't shown the same failures.

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


def _fetch_json(url_maker, timeout: int = 12, max_retries: int = 3) -> dict | None:
    for attempt in range(max_retries + 1):
        url = url_maker() if callable(url_maker) else url_maker
        req = urllib.request.Request(url, headers=HEADERS)
        _limiter.wait_turn()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                _limiter.report(r.status)
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            _limiter.report(e.code)
            if e.code in (406, 404):
                return None
            if e.code == 403:
                # Cloudflare challenge on current host — rotate mirror immediately and retry
                current_host = get_active_host()
                rotate_host(current_host)
                time.sleep(0.2)
                continue
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


def _row_from_event(ev: dict, sport_default: str) -> dict | None:
    home, away = ev.get("O1"), ev.get("O2")
    if not home or not away:
        return None
    mid = str(ev.get("I", ""))
    if not mid or int(mid) >= VIRTUAL_ID_THRESHOLD:
        return None

    sc = ev.get("SC") or {}
    fs = sc.get("FS") or {}
    ps = sc.get("PS") or []
    cp = sc.get("CP")  # current period index

    home_s = away_s = 0
    if fs:
        # FS is the running aggregate; once populated it's authoritative.
        try:
            home_s = int(fs.get("S1") or 0)
            away_s = int(fs.get("S2") or 0)
        except (TypeError, ValueError):
            pass
    elif ps:
        # Before FS populates, sum the per-period scores that have posted.
        for period in ps:
            val = period.get("Value") or {}
            try:
                home_s += int(val.get("S1") or 0)
                away_s += int(val.get("S2") or 0)
            except (TypeError, ValueError):
                pass

    period_name = None
    if cp and ps:
        for p in ps:
            if p.get("Key") == cp:
                period_name = (p.get("Value") or {}).get("NF")
                break

    # 1xbet sets I="Ended" / "Finished" / SLS="Finished" on finished rows
    status_label = str(sc.get("I") or ev.get("SLS") or "").lower()
    finished = any(w in status_label for w in ("finish", "ended", "complete", "full time", "ft"))

    return {
        "match_id":   mid,
        "match":      f"{home} vs {away}",
        "sport":      ev.get("SN") or sport_default,
        "league":     ev.get("L", ""),
        "country":    ev.get("CN", ""),
        "match_time": _ts_to_iso(ev.get("S", 0)) if ev.get("S") else "",
        "score":      {"home": home_s, "away": away_s},
        "period":     period_name,
        "minute":     int(sc["TS"] / 60) if sc.get("TS") else None,  # TS is seconds
        "finished":   finished,
    }


def _scrape_sport(sid: int) -> list[dict]:
    d = _fetch_json(lambda: make_live_url(sid))
    if not d or not d.get("Success"):
        return []
    events = d.get("Value") or []
    if not events:
        return []
    sport_name = events[0].get("SN", f"Sport-{sid}")
    out = []
    for ev in events:
        row = _row_from_event(ev, sport_name)
        if row is not None:
            out.append(row)
    return out


def main() -> int:
    t0 = time.time()
    try:
        socket.getaddrinfo(get_active_host(), 443, type=socket.SOCK_STREAM)
    except Exception:
        pass

    all_rows: list[dict] = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(_scrape_sport, sid) for sid in range(1, MAX_SPORT_ID + 1)]
        for f in as_completed(futs):
            try:
                all_rows.extend(f.result())
            except Exception as e:
                print(f"[WARN] live scrape err: {e}", file=sys.stderr)

    elapsed = time.time() - t0
    fin = sum(1 for r in all_rows if r.get("finished"))
    print(f"[INFO] live events: {len(all_rows)} ({fin} finished) in {elapsed:.1f}s",
          file=sys.stderr)
    print(json.dumps(all_rows, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
