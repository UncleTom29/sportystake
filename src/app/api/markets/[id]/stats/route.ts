import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";

export const runtime = "nodejs";

const FORMS = ["W", "D", "L"];
function buildForm(seed: number): string[] {
  const out: string[] = [];
  let n = seed >>> 0;
  for (let i = 0; i < 5; i++) { n = (n * 1664525 + 1013904223) >>> 0; out.push(FORMS[n % 3]); }
  return out;
}

export const GET = withRequestId(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const s = store();
  const m = s.markets.find((x) => x.id === id || x.externalId === id);
  if (!m) return fail("NotFound", "Market not found", 404);

  const stats = {
    home: {
      form: buildForm(m.homeTeamId),
      possession: 50 + Math.round(Math.sin(m.fixtureId) * 8),
      shots: 8 + (m.homeTeamId % 6),
      shotsOnTarget: 3 + (m.homeTeamId % 4),
      corners: 4 + (m.homeTeamId % 4),
      fouls: 8 + (m.homeTeamId % 5),
      yellow: 1 + (m.homeTeamId % 3),
      red: 0,
    },
    away: {
      form: buildForm(m.awayTeamId),
      possession: 50 - Math.round(Math.sin(m.fixtureId) * 8),
      shots: 7 + (m.awayTeamId % 6),
      shotsOnTarget: 2 + (m.awayTeamId % 4),
      corners: 3 + (m.awayTeamId % 4),
      fouls: 9 + (m.awayTeamId % 5),
      yellow: 1 + (m.awayTeamId % 3),
      red: 0,
    },
    h2h: [
      { date: "2025-11-12", home: m.homeTeam, away: m.awayTeam, homeScore: 2, awayScore: 1 },
      { date: "2025-04-22", home: m.awayTeam, away: m.homeTeam, homeScore: 1, awayScore: 1 },
      { date: "2024-10-08", home: m.homeTeam, away: m.awayTeam, homeScore: 0, awayScore: 2 },
      { date: "2024-03-17", home: m.awayTeam, away: m.homeTeam, homeScore: 3, awayScore: 1 },
      { date: "2023-09-30", home: m.homeTeam, away: m.awayTeam, homeScore: 1, awayScore: 0 },
    ],
    oddsHistory: Array.from({ length: 24 }, (_, i) => ({
      hour: -23 + i,
      home: 2.0 + Math.sin(i / 3) * 0.2 + Math.random() * 0.05,
      draw: 3.3 + Math.cos(i / 4) * 0.15,
      away: 3.0 + Math.sin(i / 5 + 1) * 0.2,
    })),
  };
  return ok(stats);
});
