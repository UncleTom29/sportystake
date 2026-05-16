import { NextRequest } from "next/server";
import { ok, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  await requireAdmin(req);
  return ok(store().quota);
});
