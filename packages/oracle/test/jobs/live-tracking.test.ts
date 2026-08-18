import { describe, it, expect } from 'vitest';
import {
  reconcileLiveTracking,
  MISSING_TICKS_THRESHOLD,
  MIN_MATCH_AGE_MINUTES,
  MAX_MISSING_TICKS_BEFORE_DROP,
  type LiveRow,
  type LiveTrackingState,
} from '../../src/jobs/live-tracking.js';

const KICKOFF = Date.parse('2026-08-14T20:00:00Z');
const TICK_MS = 2 * 60_000; // matches the real ~2m poll cadence

function row(overrides: Partial<LiveRow> = {}): LiveRow {
  return {
    match_id: '745366912',
    match: 'Home vs Away',
    sport: 'Football',
    league: 'Test League',
    country: 'Test',
    match_time: new Date(KICKOFF).toISOString(),
    score: { home: 1, away: 0 },
    period: '2nd half',
    minute: 70,
    finished: false,
    ...overrides,
  };
}

// A match old enough to clear MIN_MATCH_AGE_MINUTES as of `now`.
const OLD_ENOUGH_NOW = KICKOFF + (MIN_MATCH_AGE_MINUTES + 5) * 60_000;

describe('reconcileLiveTracking', () => {
  it('seeds a freshly-seen match as not-yet-confirmed, infers nothing', () => {
    const { nextState, inferredFinished } = reconcileLiveTracking({}, [row()], KICKOFF);
    expect(inferredFinished).toEqual([]);
    expect(nextState['745366912']).toMatchObject({ missingTicks: 0, confirmedLive: false });
  });

  it('confirms a match once seen on a second tick', () => {
    const { nextState: t1 } = reconcileLiveTracking({}, [row()], KICKOFF);
    const { nextState: t2 } = reconcileLiveTracking(t1, [row()], KICKOFF + TICK_MS);
    expect(t2['745366912']).toMatchObject({ missingTicks: 0, confirmedLive: true });
  });

  it('does not infer finished after only one missing tick (below MISSING_TICKS_THRESHOLD)', () => {
    let state: LiveTrackingState = {};
    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF));
    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF + TICK_MS)); // confirmed now
    const { nextState, inferredFinished } = reconcileLiveTracking(state, [], OLD_ENOUGH_NOW);
    expect(inferredFinished).toEqual([]);
    expect(nextState['745366912']).toMatchObject({ missingTicks: 1, confirmedLive: true });
  });

  it('infers finished once confirmed, missing for MISSING_TICKS_THRESHOLD ticks, and old enough', () => {
    let state: LiveTrackingState = {};
    ({ nextState: state } = reconcileLiveTracking(state, [row({ score: { home: 2, away: 1 } })], KICKOFF));
    ({ nextState: state } = reconcileLiveTracking(state, [row({ score: { home: 2, away: 1 } })], KICKOFF + TICK_MS));
    expect(state['745366912'].confirmedLive).toBe(true);

    // Two consecutive misses, both past the age floor.
    ({ nextState: state } = reconcileLiveTracking(state, [], OLD_ENOUGH_NOW));
    const result = reconcileLiveTracking(state, [], OLD_ENOUGH_NOW + TICK_MS);

    expect(result.inferredFinished).toEqual([
      { fixtureId: 745366912, homeScore: 2, awayScore: 1 },
    ]);
    expect(result.nextState['745366912']).toBeUndefined(); // resolved, no longer tracked
  });

  it('never infers finished for a match only ever seen once (not confirmedLive), even past the threshold', () => {
    let state: LiveTrackingState = {};
    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF)); // single sighting only
    expect(state['745366912'].confirmedLive).toBe(false);

    let inferred: unknown[] = [];
    for (let i = 1; i <= MISSING_TICKS_THRESHOLD + 2; i++) {
      const result = reconcileLiveTracking(state, [], OLD_ENOUGH_NOW + i * TICK_MS);
      state = result.nextState;
      inferred = inferred.concat(result.inferredFinished);
    }
    expect(inferred).toEqual([]);
  });

  it('drops (without inferring finished) a never-confirmed match after MAX_MISSING_TICKS_BEFORE_DROP', () => {
    let state: LiveTrackingState = {};
    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF));

    let inferred: unknown[] = [];
    for (let i = 1; i <= MAX_MISSING_TICKS_BEFORE_DROP; i++) {
      const result = reconcileLiveTracking(state, [], OLD_ENOUGH_NOW + i * TICK_MS);
      state = result.nextState;
      inferred = inferred.concat(result.inferredFinished);
    }
    expect(inferred).toEqual([]);
    expect(state['745366912']).toBeUndefined();
  });

  it('does not infer finished while too young, even once confirmed and missing — but does once old enough', () => {
    let state: LiveTrackingState = {};
    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF));
    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF + TICK_MS)); // confirmed

    // Goes missing immediately (well before MIN_MATCH_AGE_MINUTES has elapsed).
    const tooYoungNow = KICKOFF + 5 * 60_000;
    let result = reconcileLiveTracking(state, [], tooYoungNow);
    state = result.nextState;
    result = reconcileLiveTracking(state, [], tooYoungNow + TICK_MS);
    expect(result.inferredFinished).toEqual([]); // still too young — held, not resolved
    state = result.nextState;
    expect(state['745366912']).toBeDefined();

    // Time passes past the age floor while it's still missing.
    result = reconcileLiveTracking(state, [], OLD_ENOUGH_NOW);
    expect(result.inferredFinished).toEqual([
      { fixtureId: 745366912, homeScore: 1, awayScore: 0 },
    ]);
  });

  it('resets missingTicks and upgrades confirmedLive on reappearance after a single-tick gap', () => {
    let state: LiveTrackingState = {};
    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF));
    ({ nextState: state } = reconcileLiveTracking(state, [], KICKOFF + TICK_MS)); // 1 miss
    expect(state['745366912'].missingTicks).toBe(1);

    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF + 2 * TICK_MS)); // back
    expect(state['745366912']).toMatchObject({ missingTicks: 0, confirmedLive: true });
  });

  it('ignores the rare explicit finished flag here — normal path handles it, and it drops from tracking', () => {
    let state: LiveTrackingState = {};
    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF));
    ({ nextState: state } = reconcileLiveTracking(state, [row()], KICKOFF + TICK_MS));
    expect(state['745366912']).toBeDefined();

    const { nextState, inferredFinished } = reconcileLiveTracking(
      state,
      [row({ finished: true, score: { home: 3, away: 1 } })],
      KICKOFF + 2 * TICK_MS,
    );
    expect(inferredFinished).toEqual([]); // this module never double-reports the explicit path
    expect(nextState['745366912']).toBeUndefined();
  });

  it('ignores virtual-sport ids and malformed match ids', () => {
    const { nextState } = reconcileLiveTracking(
      {},
      [row({ match_id: '1000000001' }), row({ match_id: 'not-a-number' })],
      KICKOFF,
    );
    expect(Object.keys(nextState)).toEqual([]);
  });
});
