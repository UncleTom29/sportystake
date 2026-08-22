/**
 * LiveScoreFeed
 *
 * Real-time match scores and full-time results aggregator from global sports feeds.
 * Provides real-time score verification, period tracking, and final whistle scores
 * across all major football (soccer), basketball, tennis, and hockey matches.
 */

interface LiveScoreMatch {
  home: string;
  away: string;
  homeNorm: string;
  awayNorm: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "FINISHED" | "LIVE" | "OPEN";
  rawStatus: string;
  league: string;
}

interface CacheEntry {
  timestamp: number;
  matches: LiveScoreMatch[];
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30s cache

function normalizeTeamName(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|afc|cf|sc|fk|united|city|town|de|la|el|the|club|athletic|rovers|wanderers)\b/gi, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function getFormattedDate(date?: Date): string {
  const d = date || new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export async function fetchLiveScoreMatches(sport: string = "soccer", targetDate?: Date): Promise<LiveScoreMatch[]> {
  const sportKey = sport.toLowerCase().includes("basket")
    ? "basketball"
    : sport.toLowerCase().includes("tenni")
    ? "tennis"
    : sport.toLowerCase().includes("hock")
    ? "hockey"
    : "soccer";

  const dateStr = getFormattedDate(targetDate);
  const cacheKey = `${sportKey}:${dateStr}`;

  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.matches;
  }

  const url = `https://prod-public-api.livescore.com/v1/api/app/date/${sportKey}/${dateStr}/0`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 15 },
    });

    if (!res.ok) {
      return cached ? cached.matches : [];
    }

    const data = (await res.json()) as { Stages?: Array<{ Cnm?: string; Snm?: string; Events?: Array<any> }> };
    const results: LiveScoreMatch[] = [];

    for (const stage of data.Stages || []) {
      const league = `${stage.Cnm || ""} - ${stage.Snm || ""}`;
      for (const ev of stage.Events || []) {
        const t1 = ev.T1?.[0]?.Nm || "";
        const t2 = ev.T2?.[0]?.Nm || "";
        const s1 = ev.Tr1;
        const s2 = ev.Tr2;
        const eps = ev.Eps || "";

        const finished = ["FT", "AET", "AP", "Postp.", "Canc.", "Finished", "Ended"].includes(eps);
        const isLive = !finished && !["NS", "Postp.", "Canc.", ""].includes(eps);

        const homeScore =
          s1 !== undefined && s1 !== null && s1 !== "" && !isNaN(Number(s1))
            ? Number(s1)
            : finished
            ? 0
            : null;
        const awayScore =
          s2 !== undefined && s2 !== null && s2 !== "" && !isNaN(Number(s2))
            ? Number(s2)
            : finished
            ? 0
            : null;

        results.push({
          home: t1,
          away: t2,
          homeNorm: normalizeTeamName(t1),
          awayNorm: normalizeTeamName(t2),
          homeScore,
          awayScore,
          status: finished ? "FINISHED" : isLive ? "LIVE" : "OPEN",
          rawStatus: eps,
          league,
        });
      }
    }

    memoryCache.set(cacheKey, {
      timestamp: Date.now(),
      matches: results,
    });

    return results;
  } catch (err) {
    return cached ? cached.matches : [];
  }
}

/**
 * Searches for a match across today and yesterday (to catch matches that crossed midnight).
 */
export async function findScoreForTeams(
  homeTeam: string,
  awayTeam: string,
  sport: string = "soccer",
  matchTime?: Date,
): Promise<LiveScoreMatch | null> {
  const normHome = normalizeTeamName(homeTeam);
  const normAway = normalizeTeamName(awayTeam);
  if (!normHome || !normAway) return null;

  // Search today's matches
  const todayMatches = await fetchLiveScoreMatches(sport, matchTime);
  let found = matchInList(normHome, normAway, todayMatches);
  if (found) return found;

  // Search yesterday if match might have kicked off earlier
  const yesterday = new Date((matchTime || new Date()).getTime() - 24 * 60 * 60 * 1000);
  const yesterdayMatches = await fetchLiveScoreMatches(sport, yesterday);
  found = matchInList(normHome, normAway, yesterdayMatches);
  if (found) return found;

  return null;
}

function matchInList(normHome: string, normAway: string, matches: LiveScoreMatch[]): LiveScoreMatch | null {
  for (const m of matches) {
    const homeMatches =
      m.homeNorm === normHome ||
      (m.homeNorm.length >= 4 && normHome.includes(m.homeNorm)) ||
      (normHome.length >= 4 && m.homeNorm.includes(normHome));

    const awayMatches =
      m.awayNorm === normAway ||
      (m.awayNorm.length >= 4 && normAway.includes(m.awayNorm)) ||
      (normAway.length >= 4 && m.awayNorm.includes(normAway));

    if (homeMatches && awayMatches) {
      return m;
    }
  }
  return null;
}
