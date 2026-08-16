import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { requireAdmin } from "@/lib/server/auth";
import { UsersRepo } from "@/lib/server/repos/users.repo";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(200, Number(sp.get("limit") ?? "50"));
  const offset = Math.max(0, Number(sp.get("offset") ?? "0"));
  const { items: users, total } = await UsersRepo.list({ limit, offset });

  // Stats batched here so the admin UI can render without N round-trips.
  const items = await Promise.all(
    users.map(async (user) => ({ user, stats: await UsersRepo.stats(user.id) })),
  );
  return ok({ items, total, offset, limit });
});
