import type { CandidateMarket, PicksResult, RolloverState, Selection, WebCandidate } from "../types";
import { picksLlmSchema } from "../schema";
import { callOpenRouter, extractJson } from "./openrouter";

const DECIDE_MODEL = process.env.OPENROUTER_DECIDE_MODEL || "deepseek/deepseek-v4-pro";

function catalogLines(candidates: CandidateMarket[]): string {
  return candidates
    .slice(0, 200)
    .flatMap((c) =>
      c.outcomes.map(
        (o) =>
          `marketId=${c.marketId} outcome=${o.outcome} marketType=${o.marketType} | ${c.homeTeam} vs ${c.awayTeam} (${c.leagueName}, ${c.sport}) @ ${c.startTime} | pick="${o.label}" odds=${o.oddsDecimal.toFixed(2)} spread=${o.priceSpreadPct}%`,
      ),
    )
    .join("\n");
}

function webCandidateLines(webCandidates: WebCandidate[]): string {
  if (webCandidates.length === 0) return "(none found by the gather stage)";
  return webCandidates
    .map(
      (w, i) =>
        `webId=${i} | ${w.match} (${w.leagueName}, ${w.sport}) @ ${w.startTime} | pick="${w.label}" odds=${w.oddsDecimal.toFixed(2)} @ ${w.bookmaker} | ${w.note}`,
    )
    .join("\n");
}

function findOutcome(candidates: CandidateMarket[], marketId: string, outcome: number, label: string) {
  const market = candidates.find((c) => c.marketId === marketId);
  const outcomeEntry = market?.outcomes.find((o) => o.outcome === outcome);
  if (!market || !outcomeEntry) return null;
  // The model must reason about the exact catalog line it selects — if the label it
  // echoed back doesn't match the real label for this marketId/outcome, its reasoning
  // was almost certainly written for a different (possibly invented) bet. Reject rather
  // than display a rationale that doesn't describe the actual selection.
  if (outcomeEntry.label.trim().toLowerCase() !== label.trim().toLowerCase()) return null;
  return { market, outcomeEntry };
}

function findWebCandidate(webCandidates: WebCandidate[], webId: number, label: string) {
  const candidate = webCandidates[webId];
  if (!candidate) return null;
  if (candidate.label.trim().toLowerCase() !== label.trim().toLowerCase()) return null;
  return candidate;
}

/**
 * Stage 2: the decide model picks exactly 2 selections (or explicitly skips
 * the day) using the real odds catalog + gather-stage intel + rollover
 * state. The odds/marketId/label in the final result always come from our
 * own fetched catalog, never from the model's output text — this is what
 * prevents hallucinated markets from ever reaching the display.
 */
export async function selectPicks(
  candidates: CandidateMarket[],
  intelBriefing: string,
  webCandidates: WebCandidate[],
  state: RolloverState,
): Promise<PicksResult> {
  const dayContext =
    state.status === "active"
      ? `You are on day ${state.day} of a 10-day rollover. Current bankroll: ${state.bankrollUnits.toFixed(2)} units.`
      : `This starts a new 10-day rollover at day 1 with a base stake of ${state.baseStakeUnits} unit(s).`;

  const prompt = `You are a professional sports betting analyst finding genuine value edges. ${dayContext}

Bets here are placed manually at whatever bookmaker has the best line — not necessarily this app's own odds feed. So you have two ways to source each selection, both drawn from lines that ACTUALLY EXIST below (you have no live search yourself — a separate search-grounded stage already gathered the WEB CANDIDATES list; you may only choose from what it found, never invent your own):

1. "app" source — a line from the ODDS CATALOG (this app's own scraped, cross-bookmaker-checked odds). Prefer this when it shows real value: it's the higher-confidence source.
2. "web" source — a line from the WEB CANDIDATES list (already verified as real, current prices by a search-grounded model). Use this when nothing in the catalog clears the bar for a given leg.

Pick EXACTLY 2 selections to combine into one accumulator for today (each may independently be "app" or "web" sourced), OR decide to skip today if nothing shows a clear edge from either list. It is fine and expected to skip most days — only bet when you see real value.

A real edge looks like: a bookmaker's price implying a probability meaningfully lower than the true chance of that outcome, informed by team form, the intelligence briefing below, market inefficiency (wide price spread between bookmakers on the same outcome), or statistical mispricing. Do not pick favorites just because they're likely to win — the point is value vs the price, not just win probability. Selections may be from any sport, any two different matches, any market type — but each MUST be a line literally present in one of the two lists below; do not invent a market/line that isn't listed (e.g. a handicap when only 1X2 is shown for that fixture).

For every selection, copy the "label" field EXACTLY as it appears on the line you're choosing (from either list) — this is used to verify your reasoning matches the real selection.

INTELLIGENCE BRIEFING:
${intelBriefing}

ODDS CATALOG (marketId / outcome / marketType / fixture / pick / decimal odds / cross-bookmaker price spread):
${catalogLines(candidates)}

WEB CANDIDATES (webId / fixture / pick / decimal odds @ bookmaker / note — found via live search, use "web" source + this webId to select one):
${webCandidateLines(webCandidates)}

Respond with ONLY valid JSON, no other text, in exactly one of these two shapes:

{"verdict":"BET","selections":[{"source":"app","marketId":"...","outcome":0,"marketType":"...","label":"exact label copied from the catalog line","reasoning":"why this specific selection is value, 1-2 sentences, about this exact line"},{"source":"web","webId":0,"label":"exact label copied from the web candidate line","reasoning":"..."}],"summary":"1-2 sentence overall thesis for the day's accumulator"}

{"verdict":"SKIP","skipReason":"why nothing today meets the bar"}`;

  const correction = `

REMINDER: your previous attempt referenced a marketId/outcome whose real catalog "label" did not match the "label" you echoed back — meaning you reasoned about a bet that isn't the one you selected. Double-check: for each selection, find its exact line in the ODDS CATALOG above and copy that line's marketId, outcome, marketType, and label verbatim, and make sure your reasoning is about that specific line only.`;

  const MAX_ATTEMPTS = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const content = await callOpenRouter(DECIDE_MODEL, [
        { role: "user", content: attempt === 1 ? prompt : prompt + correction },
      ]);
      const parsed = picksLlmSchema.parse(extractJson(content));

      if (parsed.verdict === "SKIP") {
        return { verdict: "SKIP", selections: [], combinedOdds: 0, summary: "", skipReason: parsed.skipReason };
      }

      const selections: Selection[] = [];
      for (const s of parsed.selections) {
        if (s.source === "app") {
          const found = findOutcome(candidates, s.marketId, s.outcome, s.label);
          if (!found) {
            throw new Error(
              `Model returned app-sourced marketId=${s.marketId} outcome=${s.outcome} label="${s.label}", which does not match the fetched odds catalog (either the market doesn't exist or the label doesn't match, meaning the reasoning was likely for a different bet).`,
            );
          }
          const { market, outcomeEntry } = found;
          selections.push({
            source: "app",
            marketId: market.marketId,
            match: `${market.homeTeam} vs ${market.awayTeam}`,
            leagueName: market.leagueName,
            sport: market.sport,
            marketType: outcomeEntry.marketType,
            outcome: outcomeEntry.outcome,
            label: outcomeEntry.label,
            oddsDecimal: outcomeEntry.oddsDecimal,
            startTime: market.startTime,
            reasoning: s.reasoning,
          });
        } else {
          const found = findWebCandidate(webCandidates, s.webId, s.label);
          if (!found) {
            throw new Error(
              `Model returned web-sourced webId=${s.webId} label="${s.label}", which does not match any web candidate found by the gather stage.`,
            );
          }
          selections.push({
            source: "web",
            match: found.match,
            leagueName: found.leagueName,
            sport: found.sport,
            marketType: found.marketType,
            label: found.label,
            oddsDecimal: found.oddsDecimal,
            startTime: found.startTime,
            bookmaker: found.bookmaker,
            reasoning: s.reasoning,
          });
        }
      }

      const combinedOdds = selections.reduce((acc, s) => acc * s.oddsDecimal, 1);
      return { verdict: "BET", selections, combinedOdds, summary: parsed.summary };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_ATTEMPTS) break;
      console.log(`  (decide attempt ${attempt} failed: ${lastError.message} — retrying...)`);
    }
  }

  throw new Error(`Decide stage failed after ${MAX_ATTEMPTS} attempts. Last error: ${lastError?.message}`);
}
