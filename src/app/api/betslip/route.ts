export const dynamic = "force-dynamic";
import { prisma } from "@/lib/server/db";
import type { BetSelection } from "@/lib/betSlipStore";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  // Fallback: use a hash of the user-agent as a pseudo-identifier for browsers
  const ua = req.headers.get("user-agent") || "unknown";
  return `ua:${Buffer.from(ua).toString("base64").slice(0, 16)}`;
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const record = await prisma.betSlipStore.findUnique({ where: { ipAddress: ip } });
  return Response.json({ selections: record?.selections || [] });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const { selections }: { selections: BetSelection[] } = await req.json();

  const record = await prisma.betSlipStore.upsert({
    where: { ipAddress: ip },
    update: { selections },
    create: { ipAddress: ip, selections },
  });

  return Response.json({ success: true, selections: record.selections });
}

export async function DELETE(req: Request) {
  const ip = getClientIp(req);
  await prisma.betSlipStore.deleteMany({ where: { ipAddress: ip } });
  return Response.json({ success: true });
}
