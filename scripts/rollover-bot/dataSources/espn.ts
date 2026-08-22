/**
 * ESPN's public (unauthenticated) JSON endpoints. No API key required.
 * Coverage is best-effort — only the leagues in LEAGUE_SLUGS are queried.
 * This is supplementary grounding only; the LLM gather stage does its own
 * live web search on top of this for anything not covered here.
 */

interface EspnNewsItem {
  headline: string;
  description?: string;
  published?: string;
}

// Maps our internal (sport, leagueName-substring) to ESPN's sport/league slug.
const LEAGUE_SLUGS: { sport: string; match: RegExp; slug: string }[] = [
  { sport: "football", match: /premier league/i, slug: "soccer/eng.1" },
  { sport: "football", match: /la liga/i, slug: "soccer/esp.1" },
  { sport: "football", match: /serie a/i, slug: "soccer/ita.1" },
  { sport: "football", match: /bundesliga/i, slug: "soccer/ger.1" },
  { sport: "football", match: /ligue 1/i, slug: "soccer/fra.1" },
  { sport: "football", match: /champions league/i, slug: "soccer/uefa.champions" },
  { sport: "football", match: /europa league/i, slug: "soccer/uefa.europa" },
  { sport: "basketball", match: /nba/i, slug: "basketball/nba" },
  { sport: "americanfootball", match: /nfl/i, slug: "football/nfl" },
  { sport: "baseball", match: /mlb/i, slug: "baseball/mlb" },
  { sport: "hockey", match: /nhl/i, slug: "hockey/nhl" },
  { sport: "tennis", match: /atp/i, slug: "tennis/atp" },
  { sport: "tennis", match: /wta/i, slug: "tennis/wta" },
  { sport: "mma", match: /ufc/i, slug: "mma/ufc" },
];

function resolveSlug(sport: string, leagueName: string): string | null {
  const hit = LEAGUE_SLUGS.find((l) => l.match.test(leagueName) || l.match.test(sport));
  return hit?.slug ?? null;
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetches recent news headlines for the given leagues (deduped by slug) and
 * returns only the ones mentioning at least one of the given team names —
 * a cheap proxy for injury/lineup/form signals worth handing to the LLM.
 */
export async function fetchRelevantNews(
  leagues: { sport: string; leagueName: string }[],
  teamNames: string[],
): Promise<string[]> {
  const slugs = Array.from(
    new Set(leagues.map((l) => resolveSlug(l.sport, l.leagueName)).filter((s): s is string => !!s)),
  );

  const lowerTeams = teamNames.map((t) => t.toLowerCase());
  const relevant: string[] = [];

  await Promise.all(
    slugs.map(async (slug) => {
      const data = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${slug}/news?limit=25`);
      const articles: EspnNewsItem[] = data?.articles ?? [];
      for (const a of articles) {
        const text = `${a.headline} ${a.description ?? ""}`;
        const mentionsTeam = lowerTeams.some((t) => text.toLowerCase().includes(t));
        if (mentionsTeam) relevant.push(a.headline);
      }
    }),
  );

  return relevant.slice(0, 40);
}
