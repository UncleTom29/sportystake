import type { CandidateMarket, WebCandidate } from "../types";
import { callOpenRouter, extractJson } from "./openrouter";

const GATHER_MODEL = process.env.OPENROUTER_GATHER_MODEL || "perplexity/sonar";

export interface GatherResult {
  briefing: string;
  webCandidates: WebCandidate[];
}

/**
 * Stage 1: hand the candidate fixture list to a web-search-grounded model.
 * It does two jobs, both relying on its own live search (the decide-stage
 * model has none):
 *  1. Surface anything that could move a line on OUR candidate fixtures —
 *     injuries, confirmed lineups, rest/travel, weather, breaking news.
 *  2. Optionally surface a handful of additional real, currently-priced
 *     opportunities at other bookmakers — useful because this app's own
 *     scraped catalog can be thin (e.g. stale/mis-tracked market status),
 *     and bets are placed manually wherever the best line is anyway.
 * Pre-fetched ESPN headlines and recent-form strings are folded in as
 * grounding so the model isn't starting from nothing.
 */
export async function gatherIntel(
  candidates: CandidateMarket[],
  espnHeadlines: string[],
  formByTeam: Map<string, string>,
): Promise<GatherResult> {
  const fixtureLines = candidates
    .slice(0, 60)
    .map((c) => {
      const homeForm = formByTeam.get(c.homeTeam);
      const awayForm = formByTeam.get(c.awayTeam);
      const formNote = homeForm || awayForm ? ` [form: ${c.homeTeam} ${homeForm ?? "?"} / ${c.awayTeam} ${awayForm ?? "?"}]` : "";
      return `- ${c.homeTeam} vs ${c.awayTeam} (${c.leagueName}, ${c.sport}) kicks off ${c.startTime}${formNote}`;
    })
    .join("\n");

  const headlinesBlock = espnHeadlines.length > 0 ? espnHeadlines.map((h) => `- ${h}`).join("\n") : "(none found)";

  const catalogNote =
    candidates.length < 20
      ? `Note: our own odds catalog only has ${candidates.length} fixtures right now (a known gap in our data pipeline), so please also actively search for a few additional real, currently-available betting opportunities across any sport at other bookmakers — not just intel on the fixtures listed below.`
      : `Our own odds catalog already has ${candidates.length} fixtures, so only surface additional web opportunities if something is genuinely compelling.`;

  const prompt = `You are a sports intelligence gatherer with live web search. Below is a list of upcoming fixtures across multiple sports, plus recent headlines that may or may not be relevant to them.

FIXTURES:
${fixtureLines}

RECENT HEADLINES (may mention these teams):
${headlinesBlock}

${catalogNote}

TASK 1: identify anything that materially affects the outcome or fair odds of the listed fixtures — confirmed injuries/suspensions to key players, confirmed/likely lineups, unusual rest/travel situations, weather for outdoor fixtures, or other breaking news. Only report fixtures where you found something concrete.

TASK 2: search for up to 6 additional real, currently-priced betting opportunities (any sport, any bookmaker) that look like genuine value — a mispriced line, a well-supported upset, etc. For each, you must have found an actual current price at a named real bookmaker via search — never estimate or guess a price.

Respond with ONLY valid JSON, no other text:
{"briefing":"plain-text briefing from TASK 1, organized by fixture, or a short note if nothing was found","webCandidates":[{"match":"Team A vs Team B","leagueName":"...","sport":"...","marketType":"...","label":"...","oddsDecimal":1.85,"bookmaker":"name of the real bookmaker/site you found this price at","startTime":"ISO timestamp","note":"1 sentence on why this looks like value"}]}

If TASK 2 found nothing genuinely compelling, return an empty "webCandidates" array — do not pad it with weak or invented options.`;

  const content = await callOpenRouter(GATHER_MODEL, [{ role: "user", content: prompt }]);
  try {
    const parsed = extractJson(content) as { briefing?: string; webCandidates?: WebCandidate[] };
    return {
      briefing: parsed.briefing ?? content,
      webCandidates: Array.isArray(parsed.webCandidates) ? parsed.webCandidates : [],
    };
  } catch {
    // Fall back to treating the whole response as the briefing if it didn't return valid JSON.
    return { briefing: content, webCandidates: [] };
  }
}
