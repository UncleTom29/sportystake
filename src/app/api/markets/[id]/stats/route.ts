export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

type SnapshotOutcome = { outcome: number; label: string; valueX1000: number };

/**
 * Match stats endpoint.
 * Computes implied win probabilities, bookmaker margin, and available markets
 * from OddsSnapshot rows already stored in Postgres.
 * On first call the computed stats are cached in market.metadata so subsequent
 * reads skip the computation (satisfying the "fetch once, save to DB" contract).
 * If no 1X2 odds have been captured yet the endpoint returns a 404-like empty.
 */
export const GET = withRequestId(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        oddsSnapshots: {
          orderBy: { capturedAt: "desc" },
          take: 200,
        },
      },
    });
    if (!market) return fail("NotFound", "Market not found", 404);

    // Return cached stats if they exist and we have recent data (< 5 min old).
    const meta = (market.metadata ?? {}) as Record<string, unknown>;
    const cached = meta.stats as Record<string, unknown> | undefined;
    if (cached && typeof cached.computedAt === "string") {
      const age = Date.now() - new Date(cached.computedAt).getTime();
      if (age < 5 * 60_000) return ok(cached);
    }

    // ── Aggregate latest snapshot per (bookmaker, marketType) ──────────────
    const seenKey = new Set<string>();
    const latestByBkMt = new Map<string, SnapshotOutcome[]>();
    for (const snap of market.oddsSnapshots) {
      const key = `${snap.bookmaker}:${snap.marketType}`;
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      latestByBkMt.set(key, snap.outcomes as SnapshotOutcome[]);
    }

    // ── 1X2: best odds per outcome across all bookmakers ──────────────────
    let bestHome = 0, bestDraw = 0, bestAway = 0;
    let x2BookmakerCount = 0;
    for (const [key, outs] of latestByBkMt) {
      if (!key.endsWith(":1X2")) continue;
      x2BookmakerCount++;
      const threeWay = outs.length === 3;
      const h = outs.find((o) => o.outcome === 0)?.valueX1000 ?? 0;
      const d = threeWay ? (outs.find((o) => o.outcome === 1)?.valueX1000 ?? 0) : 0;
      const a = outs.find((o) => o.outcome === (threeWay ? 2 : 1))?.valueX1000 ?? 0;
      if (h > bestHome) bestHome = h;
      if (d > bestDraw) bestDraw = d;
      if (a > bestAway) bestAway = a;
    }

    if (x2BookmakerCount === 0) {
      // No 1X2 odds yet — return minimal fixture data.
      return ok({
        marketId: id,
        homeTeam: market.homeTeam,
        awayTeam: market.awayTeam,
        status: market.status,
        winProb: null,
        margin: null,
        bookmakerCount: 0,
        over25Prob: null,
        bttsProb: null,
        marketTypes: [],
        computedAt: new Date().toISOString(),
      });
    }

    const hasDraw = bestDraw > 1000;
    const iH = bestHome > 1000 ? 1000 / bestHome : 0;
    const iD = hasDraw ? 1000 / bestDraw : 0;
    const iA = bestAway > 1000 ? 1000 / bestAway : 0;
    const total = iH + iD + iA;

    const pHome = total > 0 ? Math.round((iH / total) * 100) : 0;
    const pDraw = total > 0 && hasDraw ? Math.round((iD / total) * 100) : 0;
    const winProb = total > 0 ? {
      home: pHome,
      draw: pDraw,
      away: 100 - pHome - pDraw,
    } : null;
    const margin = total > 1 ? Math.round((total - 1) * 1000) / 10 : null;

    // ── O/U 2.5: best Over odds across bookmakers ─────────────────────────
    let bestOver25 = 0;
    for (const [key, outs] of latestByBkMt) {
      if (!key.endsWith(":over_under_25")) continue;
      const over = outs.find((o) => o.label?.toLowerCase().includes("over"))?.valueX1000 ?? 0;
      if (over > bestOver25) bestOver25 = over;
    }
    const over25Prob = bestOver25 > 1000 ? Math.round((1000 / bestOver25) * 100) : null;

    // ── BTTS: best Yes odds across bookmakers ─────────────────────────────
    let bestBttsYes = 0;
    for (const [key, outs] of latestByBkMt) {
      if (!key.endsWith(":btts")) continue;
      const yes = outs.find((o) => o.label?.toLowerCase() === "yes")?.valueX1000 ?? 0;
      if (yes > bestBttsYes) bestBttsYes = yes;
    }
    const bttsProb = bestBttsYes > 1000 ? Math.round((1000 / bestBttsYes) * 100) : null;

    // ── Available market types ────────────────────────────────────────────
    const marketTypes = [...new Set(market.oddsSnapshots.map((s) => s.marketType))];

    const stats = {
      marketId: id,
      homeTeam: market.homeTeam,
      awayTeam: market.awayTeam,
      homeScore: market.homeScore,
      awayScore: market.awayScore,
      status: market.status,
      winProb,
      margin,
      bookmakerCount: x2BookmakerCount,
      over25Prob,
      bttsProb,
      marketTypes,
      computedAt: new Date().toISOString(),
    };

    // Save to metadata so subsequent calls skip computation.
    if (winProb) {
      await prisma.market.update({
        where: { id },
        data: { metadata: { ...meta, stats } },
      });
    }

    return ok(stats);
  },
);
