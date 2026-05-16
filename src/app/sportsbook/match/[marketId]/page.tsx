"use client";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { matches } from "@/lib/mockData";
import { useBetSlip } from "@/lib/betSlipStore";
import OddsButton from "@/components/sportsbook/OddsButton";
import Badge from "@/components/ui/Badge";
import {
  ChevronLeft, LiveIcon, ZapIcon, ShieldIcon, TrendUp, TrendDown, SparkleIcon,
} from "@/components/icons/UIIcons";

type MarketSection = {
  id: string;
  label: string;
  rows: { label: string; selections: { label: string; odds: number }[] }[];
};

function buildMarkets(m: typeof matches[0]): MarketSection[] {
  return [
    {
      id: "1X2",
      label: "Match Result",
      rows: [
        {
          label: "1X2",
          selections: [
            { label: m.homeTeam + " Win", odds: m.homeOdds },
            ...(m.drawOdds ? [{ label: "Draw", odds: m.drawOdds }] : []),
            { label: m.awayTeam + " Win", odds: m.awayOdds },
          ],
        },
        {
          label: "Double Chance",
          selections: [
            { label: `${m.homeShort}/Draw`, odds: +(m.homeOdds * 0.6).toFixed(2) },
            { label: `${m.homeShort}/${m.awayShort}`, odds: +(m.homeOdds * 0.55).toFixed(2) },
            { label: `Draw/${m.awayShort}`, odds: +(m.awayOdds * 0.6).toFixed(2) },
          ],
        },
      ],
    },
    {
      id: "over_under",
      label: "Over / Under",
      rows: [
        {
          label: "Goals",
          selections: [
            { label: "O 0.5", odds: 1.10 }, { label: "U 0.5", odds: 6.50 },
            { label: "O 1.5", odds: 1.32 }, { label: "U 1.5", odds: 3.25 },
            { label: "O 2.5", odds: m.totalOverOdds ?? 1.87 }, { label: "U 2.5", odds: m.totalUnderOdds ?? 1.93 },
            { label: "O 3.5", odds: 2.85 }, { label: "U 3.5", odds: 1.42 },
            { label: "O 4.5", odds: 4.60 }, { label: "U 4.5", odds: 1.15 },
          ],
        },
      ],
    },
    {
      id: "btts",
      label: "Both Teams to Score",
      rows: [
        {
          label: "BTTS",
          selections: [
            { label: "Yes", odds: 1.68 },
            { label: "No", odds: 2.10 },
          ],
        },
      ],
    },
    {
      id: "handicap",
      label: "Asian Handicap",
      rows: [
        {
          label: `${m.homeTeam} -0.5`,
          selections: [
            { label: m.homeTeam, odds: +(m.homeOdds * 1.1).toFixed(2) },
            { label: m.awayTeam, odds: +(m.awayOdds * 0.9).toFixed(2) },
          ],
        },
        {
          label: `${m.homeTeam} -1.5`,
          selections: [
            { label: m.homeTeam, odds: +(m.homeOdds * 1.5).toFixed(2) },
            { label: m.awayTeam, odds: +(m.awayOdds * 0.7).toFixed(2) },
          ],
        },
      ],
    },
  ];
}

const FORM_HOME = ["W", "W", "D", "W", "L"] as const;
const FORM_AWAY = ["W", "D", "L", "W", "W"] as const;

const H2H = [
  { date: "12 Jan 2025", home: "Arsenal", away: "Man City", score: "2–1", winner: "home" },
  { date: "05 Oct 2024", home: "Man City", away: "Arsenal", score: "3–1", winner: "home" },
  { date: "31 Mar 2024", home: "Arsenal", away: "Man City", score: "0–0", winner: "draw" },
  { date: "08 Oct 2023", home: "Man City", away: "Arsenal", score: "1–0", winner: "home" },
  { date: "26 Apr 2023", home: "Arsenal", away: "Man City", score: "3–3", winner: "draw" },
];

type Tab = "1X2" | "over_under" | "btts" | "handicap";

export default function MatchDetailPage({ params }: { params: Promise<{ marketId: string }> }) {
  const { marketId } = use(params);
  const match = matches.find((m) => m.id === marketId);
  const [tab, setTab] = useState<Tab>("1X2");
  const { addSelection, hasSelection } = useBetSlip();

  if (!match) return notFound();

  const markets = buildMarkets(match);
  const activeMarket = markets.find((m) => m.id === tab) ?? markets[0];

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-5">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-[12px] text-[var(--color-ink-3)]">
        <Link href="/sportsbook" className="flex items-center gap-1 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" />
          Sportsbook
        </Link>
        <span>/</span>
        <span>{match.league}</span>
        <span>/</span>
        <span className="text-white">{match.homeTeam} vs {match.awayTeam}</span>
      </div>

      {/* Match header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,231,1,0.06),transparent_60%)]" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
              {match.league} · {match.country}
            </span>
            {match.isLive ? (
              <Badge variant="danger" className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                LIVE {match.liveMinute}
              </Badge>
            ) : (
              <span className="mono text-[12px] text-[var(--color-ink-2)]">{match.time}</span>
            )}
          </div>

          <div className="flex items-center justify-center gap-8">
            <div className="text-center flex-1">
              <div
                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-black"
                style={{ borderColor: match.homeColor, background: `${match.homeColor}20` }}
              >
                {match.homeShort}
              </div>
              <p className="text-[15px] font-bold text-white">{match.homeTeam}</p>
              <div className="mt-1 flex items-center justify-center gap-1">
                {FORM_HOME.map((r, i) => (
                  <FormBadge key={i} result={r} />
                ))}
              </div>
            </div>

            <div className="text-center">
              {match.isLive ? (
                <>
                  <p className="mono text-5xl font-black">
                    {match.homeScore ?? 0}–{match.awayScore ?? 0}
                  </p>
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-[var(--color-live)]">
                    <LiveIcon className="h-3.5 w-3.5" />
                    {match.liveMinute}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-bold text-[var(--color-ink-2)]">VS</p>
                  <p className="mono mt-1 text-[11px] text-[var(--color-ink-3)]">{match.time}</p>
                </>
              )}
            </div>

            <div className="text-center flex-1">
              <div
                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-black"
                style={{ borderColor: match.awayColor, background: `${match.awayColor}20` }}
              >
                {match.awayShort}
              </div>
              <p className="text-[15px] font-bold text-white">{match.awayTeam}</p>
              <div className="mt-1 flex items-center justify-center gap-1">
                {FORM_AWAY.map((r, i) => (
                  <FormBadge key={i} result={r} />
                ))}
              </div>
            </div>
          </div>

          {/* Pool info */}
          <div className="mt-4 flex items-center justify-center gap-4 rounded-md bg-[var(--color-bg-1)] py-2 text-[12px]">
            <div className="flex items-center gap-1.5 text-[var(--color-ink-2)]">
              <ShieldIcon className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
              Pool TVL: <span className="mono font-bold text-white">$4,280 USDC</span>
            </div>
            <div className="h-4 w-px bg-[var(--color-line-1)]" />
            <Link href="/pools" className="flex items-center gap-1 text-[var(--color-brand-500)] hover:underline">
              <SparkleIcon className="h-3 w-3" />
              Add liquidity
            </Link>
          </div>
        </div>
      </div>

      {/* Market tabs */}
      <div className="mt-4 flex items-center gap-1 overflow-x-auto scrollbar-none rounded-md border border-[var(--color-line-1)] bg-[var(--color-bg-1)] p-1">
        {markets.map((m) => (
          <button
            key={m.id}
            onClick={() => setTab(m.id as Tab)}
            className={`h-8 shrink-0 rounded px-3 text-[12px] font-semibold transition-colors ${
              tab === m.id
                ? "bg-[var(--color-bg-3)] text-white"
                : "text-[var(--color-ink-2)] hover:text-white"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Market selections */}
      <div className="mt-3 rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
        {tab === "over_under" ? (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-line-1)] text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                <th className="pb-2 text-left">Goals</th>
                <th className="pb-2 text-center">Over</th>
                <th className="pb-2 text-center">Under</th>
              </tr>
            </thead>
            <tbody>
              {activeMarket.rows[0].selections.reduce((pairs, sel, i) => {
                if (i % 2 === 0) pairs.push([sel]);
                else pairs[pairs.length - 1].push(sel);
                return pairs;
              }, [] as { label: string; odds: number }[][]).map((pair, i) => {
                const line = pair[0].label.replace("O ", "");
                return (
                  <tr key={i} className="border-b border-[var(--color-line-1)] last:border-0">
                    <td className="mono py-2 font-bold text-[var(--color-ink-2)]">{line}</td>
                    {pair.map((sel) => (
                      <td key={sel.label} className="py-2 text-center">
                        <OddsButton
                          matchId={match.id}
                          market={`ou_${line}`}
                          selection={sel.label}
                          matchLabel={`${match.homeTeam} vs ${match.awayTeam}`}
                          odds={sel.odds}
                          isSelected={hasSelection(match.id, `ou_${line}_${sel.label}`)}
                          onSelect={() => addSelection({ matchId: match.id, matchLabel: `${match.homeTeam} vs ${match.awayTeam}`, market: `ou_${line}_${sel.label}`, selection: sel.label, odds: sel.odds })}
                          label={sel.label}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="space-y-3">
            {activeMarket.rows.map((row) => (
              <div key={row.label}>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">{row.label}</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(row.selections.length, 3)}, 1fr)` }}>
                  {row.selections.map((sel) => (
                    <OddsButton
                      key={sel.label}
                      matchId={match.id}
                      market={`${tab}_${row.label}`}
                      selection={sel.label}
                      matchLabel={`${match.homeTeam} vs ${match.awayTeam}`}
                      odds={sel.odds}
                      isSelected={hasSelection(match.id, `${tab}_${row.label}`)}
                      onSelect={() => addSelection({ matchId: match.id, matchLabel: `${match.homeTeam} vs ${match.awayTeam}`, market: `${tab}_${row.label}`, selection: sel.label, odds: sel.odds })}
                      label={sel.label}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats + H2H grid */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* H2H */}
        <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Head to Head</p>
          <div className="space-y-2">
            {H2H.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className="w-20 shrink-0 text-[var(--color-ink-3)]">{g.date}</span>
                <span className="flex-1 truncate text-white">{g.home} vs {g.away}</span>
                <span
                  className="mono font-bold"
                  style={{
                    color: g.winner === "draw"
                      ? "var(--color-warn)"
                      : g.winner === "home"
                      ? "var(--color-brand-500)"
                      : "var(--color-ink-2)",
                  }}
                >
                  {g.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Odds movement chart placeholder */}
        <div className="rounded-xl border border-[var(--color-line-1)] bg-[var(--color-bg-2)] p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-3)]">Odds Movement (24h)</p>
          <OddsChart match={match} />
        </div>
      </div>
    </div>
  );
}

function FormBadge({ result }: { result: "W" | "D" | "L" }) {
  const color =
    result === "W" ? "var(--color-brand-500)" :
    result === "D" ? "var(--color-warn)" :
    "var(--color-live)";
  return (
    <span
      className="mono flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ background: `${color}20`, color }}
    >
      {result}
    </span>
  );
}

function OddsChart({ match }: { match: typeof matches[0] }) {
  const pts = Array.from({ length: 24 }, (_, i) => ({
    h: match.homeOdds + (Math.sin(i * 0.5) * 0.15),
    d: (match.drawOdds ?? 3.3) + (Math.cos(i * 0.4) * 0.1),
    a: match.awayOdds + (Math.sin(i * 0.6 + 1) * 0.12),
  }));
  const allVals = pts.flatMap((p) => [p.h, p.d, p.a]);
  const minV = Math.min(...allVals) - 0.05;
  const maxV = Math.max(...allVals) + 0.05;
  const range = maxV - minV;
  const W = 280, H = 100;
  const scaleX = (i: number) => (i / 23) * W;
  const scaleY = (v: number) => H - ((v - minV) / range) * H;
  const line = (getter: (p: typeof pts[0]) => number) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(i).toFixed(1)},${scaleY(getter(p)).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <path d={line((p) => p.h)} stroke="var(--color-brand-500)" strokeWidth="1.5" fill="none" />
        {match.drawOdds && <path d={line((p) => p.d)} stroke="var(--color-warn)" strokeWidth="1.5" fill="none" />}
        <path d={line((p) => p.a)} stroke="var(--color-info)" strokeWidth="1.5" fill="none" />
      </svg>
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded" style={{ background: "var(--color-brand-500)" }} />
          <span className="text-[var(--color-ink-3)]">{match.homeShort}</span>
          <span className="mono font-bold text-white">{match.homeOdds.toFixed(2)}</span>
          <TrendDown className="h-3 w-3 text-[var(--color-live)]" />
        </span>
        {match.drawOdds && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-4 rounded" style={{ background: "var(--color-warn)" }} />
            <span className="text-[var(--color-ink-3)]">Draw</span>
            <span className="mono font-bold text-white">{match.drawOdds.toFixed(2)}</span>
            <TrendUp className="h-3 w-3 text-[var(--color-brand-500)]" />
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded" style={{ background: "var(--color-info)" }} />
          <span className="text-[var(--color-ink-3)]">{match.awayShort}</span>
          <span className="mono font-bold text-white">{match.awayOdds.toFixed(2)}</span>
          <TrendUp className="h-3 w-3 text-[var(--color-brand-500)]" />
        </span>
      </div>
    </div>
  );
}
