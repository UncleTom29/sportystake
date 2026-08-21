/**
 * Disappearance-based finish detection.
 *
 * 1xbet's LiveFeed almost never sets the explicit "finished"/"ended" status
 * string XbetLiveJob's `_row_from_event` checks for — in practice, a match
 * that wraps up simply stops appearing in the live listing on the next poll,
 * with no terminal row at all. That's the normal, common case, not an edge
 * case: a production sweep across every currently-live match returned 0
 * with the explicit flag set. So the explicit-flag path alone essentially
 * never fires, and every sports market it should have settled instead falls
 * through to the 4-hour stuck-market safety net in oracle-sync.worker.ts,
 * which cancels (refunds) rather than resolves — it has no score to resolve
 * *with*. That's the "stuck at 0-0, refund instead of a real result" bug.
 *
 * This module tracks live match ids tick-over-tick (every ~2 minutes, see
 * live-poller.job.ts's cron) and infers "finished" when a previously-live
 * match is absent for MISSING_TICKS_THRESHOLD consecutive polls, using the
 * last score observed while it was still live. Two guards keep this from
 * misfiring:
 *  - MISSING_TICKS_THRESHOLD requires the match to be gone for more than one
 *    poll before acting, so a single transient scrape gap (one sport id's
 *    request failing, a brief upstream hiccup) doesn't get misread as final.
 *  - MIN_MATCH_AGE_MINUTES requires enough wall-clock time to have passed
 *    since kickoff, so a match that appears live for one poll right at
 *    kickoff (a data glitch, a postponed/delayed start listed prematurely)
 *    and then vanishes isn't misread as an instant finish. Wall-clock time
 *    since kickoff is used rather than the in-game minute clock because the
 *    minute field is best-effort and can be null.
 *
 * The residual risk this accepts: if a goal happens in the real gap between
 * the last poll a match was seen live and the poll after which it's judged
 * finished (up to ~2 x poll interval), the score used is the last one
 * observed, not the true final one. That's a real accuracy tradeoff, but a
 * categorically better one than the status quo, where a naturally-finished
 * match is *never* resolved with a real score at all — only ever cancelled
 * hours later with none.
 */

export interface LiveRow {
  match_id: string;
  match: string;
  sport: string;
  league: string;
  country: string;
  match_time: string;
  score: { home: number; away: number };
  period: string | null;
  minute: number | null;
  finished: boolean;
}

export interface TrackedMatch {
  fixtureId: number;
  sport?: string;
  homeScore: number;
  awayScore: number;
  matchTime: string;
  missingTicks: number;
  /** True once this match has been observed live on 2+ separate ticks —
   *  disappearance-inference only ever applies once this is true, so a
   *  single glitchy/phantom sighting can never by itself be read as a
   *  finish once it vanishes on the very next poll. */
  confirmedLive: boolean;
}

export type LiveTrackingState = Record<string, TrackedMatch>;

export interface InferredFinish {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
}

export const MISSING_TICKS_THRESHOLD = 2;
export const MIN_MATCH_AGE_MINUTES = 20;
export const MAX_MISSING_TICKS_BEFORE_DROP = 60;

const VIRTUAL_ID_THRESHOLD = 1_000_000_000;

function minAgeForSport(sport?: string): number {
  const norm = (sport ?? "").toLowerCase();
  if (
    norm.includes("esport") ||
    norm.includes("fifa") ||
    norm.includes("table") ||
    norm.includes("dart") ||
    norm.includes("badminton") ||
    norm.includes("cybersport")
  ) {
    return 5;
  }
  return 20;
}

function ageMinutes(matchTime: string, now: number): number | null {
  const kickoff = Date.parse(matchTime);
  if (!Number.isFinite(kickoff)) return null;
  return (now - kickoff) / 60_000;
}

/**
 * Advances live-tracking state by one poll tick. Pure function — no I/O —
 * so it's testable independent of Redis/the scraper subprocess/pub-sub.
 *
 * @param previous  Tracking state persisted from the prior tick (empty on
 *                  cold start — everything just gets seeded, nothing inferred).
 * @param rows      This tick's live rows, straight from xbet_live.py.
 * @param now       Injected for deterministic tests; defaults to real time.
 */
export function reconcileLiveTracking(
  previous: LiveTrackingState,
  rows: LiveRow[],
  now: number = Date.now(),
): { nextState: LiveTrackingState; inferredFinished: InferredFinish[] } {
  const nextState: LiveTrackingState = {};
  const inferredFinished: InferredFinish[] = [];
  const seenThisTick = new Set<string>();

  for (const row of rows) {
    const fixtureId = Number.parseInt(row.match_id, 10);
    if (!Number.isFinite(fixtureId) || fixtureId >= VIRTUAL_ID_THRESHOLD) continue;
    seenThisTick.add(row.match_id);

    // The rare explicit flag still short-circuits here: don't keep tracking
    // a match the normal path is about to publish `market:finished` for.
    if (row.finished) continue;

    nextState[row.match_id] = {
      fixtureId,
      sport: row.sport,
      homeScore: row.score.home,
      awayScore: row.score.away,
      matchTime: row.match_time,
      missingTicks: 0,
      confirmedLive: row.match_id in previous, // seen on a prior tick too
    };
  }

  for (const [matchId, tracked] of Object.entries(previous)) {
    if (seenThisTick.has(matchId)) continue; // still live (or just resolved explicitly above) — handled

    const missingTicks = tracked.missingTicks + 1;
    const age = ageMinutes(tracked.matchTime, now);
    const minAge = minAgeForSport(tracked.sport);
    const eligible = tracked.confirmedLive && (age === null || age >= minAge);

    if (missingTicks >= MISSING_TICKS_THRESHOLD && eligible) {
      inferredFinished.push({
        fixtureId: tracked.fixtureId,
        homeScore: tracked.homeScore,
        awayScore: tracked.awayScore,
      });
      // Resolved — don't carry it forward into nextState.
      continue;
    }
    if (missingTicks >= MAX_MISSING_TICKS_BEFORE_DROP) {
      continue; // never confirmed / gave up reappearing — drop, not resolve
    }

    nextState[matchId] = { ...tracked, missingTicks };
  }

  return { nextState, inferredFinished };
}
