import { NextResponse } from "next/server";
import { redis } from "@/lib/server/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LiveRow {
  match_id: string;
  match: string;
  sport: string;
  league: string;
  country: string;
  match_time: string;
  score: { home: number; away: number };
  period: string | null;
  minute: number | null;
  finished: boolean;
}

// Map 1xbet sport names to internal slugs for tab labels.
const SPORT_SLUG: Record<string, string> = {
  football: "football",
  soccer: "football",
  basketball: "basketball",
  tennis: "tennis",
  "table tennis": "table-tennis",
  "table-tennis": "table-tennis",
  volleyball: "volleyball",
  hockey: "ice-hockey",
  "ice hockey": "ice-hockey",
  baseball: "baseball",
  handball: "handball",
  cricket: "cricket",
  rugby: "rugby",
  boxing: "boxing",
  mma: "martial-arts",
  "mixed martial arts": "martial-arts",
  "martial arts": "martial-arts",
  darts: "darts",
  snooker: "snooker",
  badminton: "badminton",
  golf: "golf",
  esports: "esports",
  cybersport: "esports",
  futsal: "futsal",
  "beach volleyball": "beach-volleyball",
  "american football": "american-football",
  "gaelic football": "gaelic-football",
  "australian rules": "australian-rules",
};

function normaliseSport(raw: string): string {
  const lower = (raw ?? "").toLowerCase().trim();
  return SPORT_SLUG[lower] ?? lower.replace(/\s+/g, "-");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sportFilter = url.searchParams.get("sport");

  const r = redis();
  const raw = await r.get("oracle:live:events");

  if (!raw) {
    return NextResponse.json({
      events: [],
      total: 0,
      lastUpdated: null,
    });
  }

  let rows: LiveRow[] = [];
  try {
    rows = JSON.parse(raw) as LiveRow[];
  } catch {
    return NextResponse.json({ events: [], total: 0, lastUpdated: null });
  }

  // Normalise sport slug and optionally filter.
  const events = rows
    .map((r) => ({ ...r, sport: normaliseSport(r.sport) }))
    .filter((r) => !sportFilter || r.sport === sportFilter);

  // Determine cache age from Redis TTL so the client knows how fresh data is.
  const ttlSeconds = await r.ttl("oracle:live:events");
  const lastUpdated =
    ttlSeconds > 0
      ? new Date(Date.now() - (300 - ttlSeconds) * 1000).toISOString()
      : null;

  return NextResponse.json(
    { events, total: events.length, lastUpdated },
    { headers: { "Cache-Control": "no-store" } },
  );
}
