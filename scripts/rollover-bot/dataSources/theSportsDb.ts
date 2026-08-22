/**
 * TheSportsDB free tier (public key "3"). No signup required. Used to pull
 * a team's recent-form string (last 5 results) as extra context for the LLM
 * — best-effort, silently skipped on any lookup failure or unmapped team.
 */

const FREE_KEY = "3";
const BASE = `https://www.thesportsdb.com/api/v1/json/${FREE_KEY}`;

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function findTeamId(teamName: string): Promise<string | null> {
  const data = await fetchJson(`${BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`);
  const team = data?.teams?.[0];
  return team?.idTeam ?? null;
}

function formLetter(event: any, teamId: string): "W" | "D" | "L" | null {
  const homeScore = Number(event.intHomeScore);
  const awayScore = Number(event.intAwayScore);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  const isHome = event.idHomeTeam === teamId;
  if (homeScore === awayScore) return "D";
  const homeWon = homeScore > awayScore;
  return (isHome && homeWon) || (!isHome && !homeWon) ? "W" : "L";
}

/** Returns a form string like "W-W-D-L-W" (most recent first), or null. */
export async function fetchRecentForm(teamName: string): Promise<string | null> {
  const teamId = await findTeamId(teamName);
  if (!teamId) return null;

  const data = await fetchJson(`${BASE}/eventslast.php?id=${teamId}`);
  const events: any[] = data?.results ?? [];
  if (events.length === 0) return null;

  const letters = events
    .map((e) => formLetter(e, teamId))
    .filter((l): l is "W" | "D" | "L" => l !== null)
    .slice(0, 5);

  return letters.length > 0 ? letters.join("-") : null;
}
