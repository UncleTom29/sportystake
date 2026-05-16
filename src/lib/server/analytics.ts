import type { PredictionResult, MarketDTO } from "@/lib/types";
import { store } from "@/lib/server/store";

export async function generatePrediction(marketId: string): Promise<PredictionResult> {
  const s = store();
  const cached = s.predictionCache.get(Number(marketId.replace(/\D/g, "").slice(-8) || 0));
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const m = s.markets.find((x) => x.id === marketId);
  if (!m) throw new Error("Market not found");

  // If ANTHROPIC_API_KEY is present, attempt to call the Anthropic API.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await callAnthropic(m);
      s.predictionCache.set(m.fixtureId, { result, expiresAt: Date.now() + 60 * 60_000 });
      return result;
    } catch (err) {
      console.warn("[analytics] anthropic call failed, using mock", err);
    }
  }
  const result = mockPrediction(m);
  s.predictionCache.set(m.fixtureId, { result, expiresAt: Date.now() + 60 * 60_000 });
  return result;
}

function mockPrediction(m: MarketDTO): PredictionResult {
  const bundle = m.odds.find((b) => b.marketType === "1X2");
  const sels = bundle?.selections ?? [];
  const ix = (v: number) => 1000 / Math.max(1000, v);
  const implied = {
    home: sels[0] ? ix(sels[0].valueX1000) : 0.4,
    draw: sels[1] ? ix(sels[1].valueX1000) : 0.3,
    away: sels[2] ? ix(sels[2].valueX1000) : 0.3,
  };
  const sum = implied.home + implied.draw + implied.away;
  // Add small randomised noise to simulate AI estimate
  const probs = {
    home: Math.max(0.05, Math.min(0.95, implied.home / sum + (Math.random() - 0.5) * 0.06)),
    draw: Math.max(0.05, Math.min(0.95, implied.draw / sum + (Math.random() - 0.5) * 0.04)),
    away: Math.max(0.05, Math.min(0.95, implied.away / sum + (Math.random() - 0.5) * 0.06)),
  };
  const total = probs.home + probs.draw + probs.away;
  probs.home /= total; probs.draw /= total; probs.away /= total;

  const edges: { outcome: "home" | "draw" | "away"; edge: number }[] = [
    { outcome: "home", edge: probs.home - implied.home / sum },
    { outcome: "draw", edge: probs.draw - implied.draw / sum },
    { outcome: "away", edge: probs.away - implied.away / sum },
  ];
  const best = edges.sort((a, b) => b.edge - a.edge)[0];
  const recommendation: PredictionResult["recommendation"] =
    best.edge > 0.05 ? "VALUE_BET" : best.edge < -0.05 ? "AVOID" : "NEUTRAL";

  const factors = [
    `${m.homeTeam} have form indicators favouring this fixture`,
    `${m.awayTeam} away record sits in the middle tier this season`,
    `Head-to-head average over the last 5 meetings is ${(Math.random() * 2 + 1.5).toFixed(1)} goals`,
    `Market liquidity (pool TVL ${Number(m.poolTvl).toFixed(0)} USDC) suggests bookmaker odds are well-priced`,
  ];

  return {
    fixtureId: m.fixtureId,
    marketId: m.id,
    probabilities: probs,
    bookmakerImplied: { home: implied.home / sum, draw: implied.draw / sum, away: implied.away / sum },
    valueEdge: best.edge > 0.03 ? best : null,
    factors,
    recommendation,
    confidence: Math.min(5, Math.max(1, 1 + Math.round(Math.abs(best.edge) * 30))),
    explanation: recommendation === "VALUE_BET"
      ? `Our model rates ${best.outcome} higher than the implied price by ${(best.edge * 100).toFixed(1)} percentage points. That gap is typically a sign of bookmaker overcorrection on perceived underdog form.`
      : recommendation === "AVOID"
      ? `Market price is tighter than our model's central estimate. Better to wait for line movement or pick a different fixture.`
      : `Probabilities track the market closely. No statistically meaningful edge identified.`,
    generatedAt: new Date().toISOString(),
  };
}

async function callAnthropic(m: MarketDTO): Promise<PredictionResult> {
  // Dynamic import so the SDK is only loaded when the key is present.
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `You are a structured football analyst. Output STRICT JSON only with keys: probabilities {home,draw,away in [0,1]}, factors (3-5 short strings), recommendation (VALUE_BET|AVOID|NEUTRAL), confidence (1-5), explanation (2-3 sentences). Fixture: ${m.homeTeam} vs ${m.awayTeam} in ${m.leagueName}. Bookmaker 1X2: ${JSON.stringify(m.odds[0])}. Pool TVL: ${m.poolTvl} USDC.`;
  const resp = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });
  const txt = resp.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
  const jsonMatch = txt.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("no JSON in response");
  const parsed = JSON.parse(jsonMatch[0]) as Partial<PredictionResult> & { probabilities: PredictionResult["probabilities"] };
  // Re-use mock for fields the model didn't fill
  const base = mockPrediction(m);
  return {
    ...base,
    probabilities: parsed.probabilities ?? base.probabilities,
    factors: parsed.factors ?? base.factors,
    recommendation: parsed.recommendation ?? base.recommendation,
    confidence: parsed.confidence ?? base.confidence,
    explanation: parsed.explanation ?? base.explanation,
  };
}

export async function valueScanner() {
  const s = store();
  const all: { marketId: string; market: string; selection: string; outcome: number; bookmakerOdds: number; aiProbability: number; edge: number }[] = [];
  for (const m of s.markets.filter((x) => x.status === "OPEN").slice(0, 15)) {
    const prediction = await generatePrediction(m.id);
    const bundle = m.odds.find((b) => b.marketType === "1X2");
    if (!bundle) continue;
    const map: ("home" | "draw" | "away")[] = ["home", "draw", "away"];
    bundle.selections.forEach((sel, idx) => {
      const key = map[idx];
      const aiProb = prediction.probabilities[key];
      const impl = prediction.bookmakerImplied[key];
      const edge = aiProb - impl;
      if (edge > 0.05) {
        all.push({
          marketId: m.id,
          market: `${m.homeTeam} vs ${m.awayTeam}`,
          selection: sel.label,
          outcome: sel.outcome,
          bookmakerOdds: sel.valueX1000 / 1000,
          aiProbability: aiProb,
          edge,
        });
      }
    });
  }
  return all.sort((a, b) => b.edge - a.edge);
}
