/**
 * Adapter: API MarketDTO  →  legacy `Match` shape used by MatchCard, MatchRow,
 * MatchTile etc. Lets us keep all the existing presentation components but
 * feed them real Postgres data instead of the mockData arrays.
 *
 * When the frontend components are eventually refactored to consume
 * MarketDTO directly, this file can be deleted.
 */
import type { Match } from "@/lib/mockData";
import type { MarketDTO, OddsBundle, OddsSelection } from "@/lib/types";
import type { SportSlug } from "@/components/icons/SportIcons";

const LEAGUE_SHORT: Record<string, string> = {
  "Premier League": "EPL",
  "La Liga": "LIGA",
  "Serie A": "SA",
  "Bundesliga": "BL",
  "Ligue 1": "L1",
  "UEFA Champions League": "UCL",
  "UEFA Europa League": "UEL",
  "MLS": "MLS",
};

const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899", "#06b6d4", "#f97316"];

/** Stable per-name color so the same team always lights up the same hue. */
function teamColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TEAM_COLORS[Math.abs(h) % TEAM_COLORS.length];
}

function teamShort(name: string): string {
  const words = name.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

function pickOdds(odds: OddsBundle[] | undefined, marketType: string, outcome: number): number | null {
  if (!odds) return null;
  const bundle = odds.find((o) => o.marketType === marketType);
  if (!bundle) return null;
  const sel = bundle.selections.find((s: OddsSelection) => s.outcome === outcome);
  return sel ? sel.valueX1000 / 1000 : null;
}

function humanTime(iso: string, isLive: boolean, minute?: number): string {
  if (isLive) return minute ? `${minute}'` : "LIVE";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  const tomorrow = new Date(now); tomorrow.setUTCDate(now.getUTCDate() + 1);
  const sameTomorrow =
    d.getUTCFullYear() === tomorrow.getUTCFullYear() &&
    d.getUTCMonth() === tomorrow.getUTCMonth() &&
    d.getUTCDate() === tomorrow.getUTCDate();
  const hhmm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  if (sameDay) return `Today · ${hhmm}`;
  if (sameTomorrow) return `Tomorrow · ${hhmm}`;
  return d.toUTCString().slice(0, 17);
}

const SPORT_SLUG_TO_NAME: Record<string, string> = {
  football: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  baseball: "Baseball",
  "american-football": "American Football",
  "ice-hockey": "Ice Hockey",
  esports: "Esports",
  darts: "Darts",
  "mixed-martial-arts": "MMA",
  boxing: "Boxing",
  handball: "Handball",
  volleyball: "Volleyball",
  snooker: "Snooker",
  "table-tennis": "Table Tennis",
  rugby: "Rugby",
  cricket: "Cricket",
};

export function marketToMatch(m: MarketDTO, opts: { isHot?: boolean } = {}): Match {
  const isLive = m.status === "LIVE";
  const sportSlug = (m.sport ?? "football") as SportSlug;

  // 1xCorp uses T=2 for "player 2 wins" in 2-outcome sports (table tennis,
  // tennis, volleyball) — the same slot used for "draw" in football. When no
  // T=3 outcome is present, outcome index 2 will be missing, so we detect
  // that case and promote the index-1 value to awayOdds.
  const rawIndex1 = pickOdds(m.odds, "1X2", 1);
  const rawIndex2 = pickOdds(m.odds, "1X2", 2);
  const hasTrueAway = rawIndex2 != null && rawIndex2 > 1;

  const homeOdds = pickOdds(m.odds, "1X2", 0) ?? 0;
  const drawOdds = hasTrueAway ? rawIndex1 : null;
  const awayOdds = hasTrueAway ? (rawIndex2 ?? 0) : (rawIndex1 ?? 0);
  const overOdds = pickOdds(m.odds, "over_under_25", 0) ?? undefined;
  const underOdds = pickOdds(m.odds, "over_under_25", 1) ?? undefined;

  return {
    id: m.id,
    sport: SPORT_SLUG_TO_NAME[sportSlug] ?? sportSlug,
    sportSlug,
    league: m.leagueName,
    leagueShort: LEAGUE_SHORT[m.leagueName] ?? m.leagueName.slice(0, 4).toUpperCase(),
    country: (m.countryCode || m.country.slice(0, 3)).toUpperCase(),
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeShort: teamShort(m.homeTeam),
    awayShort: teamShort(m.awayTeam),
    homeColor: teamColor(m.homeTeam),
    awayColor: teamColor(m.awayTeam),
    homeOdds,
    drawOdds,
    awayOdds,
    startsAt: m.startTime,
    time: humanTime(m.startTime, isLive, m.liveMinute),
    isLive,
    ...(m.liveMinute ? { liveMinute: `${m.liveMinute}'` } : {}),
    ...(m.homeScore !== undefined ? { homeScore: m.homeScore } : {}),
    ...(m.awayScore !== undefined ? { awayScore: m.awayScore } : {}),
    ...(overOdds ? { totalOverOdds: overOdds } : {}),
    ...(underOdds ? { totalUnderOdds: underOdds } : {}),
    totalLine: 2.5,
    markets: m.marketsCount,
    status: m.status,
    ...(opts.isHot ? { isHot: true } : {}),
    odds: m.odds,
  };
}

export function marketsToMatches(items: MarketDTO[], opts: { isHot?: boolean } = {}): Match[] {
  return items.map((m) => marketToMatch(m, opts));
}
