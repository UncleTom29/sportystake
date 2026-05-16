import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { store } from "@/lib/server/store";
import { isAddress } from "viem";
import { hexId } from "@/lib/uid";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address)) {
    return fail("BadRequest", "address query param is required", 400);
  }
  const nonce = hexId().slice(0, 32);
  const s = store();
  s.nonces.set(address.toLowerCase(), { nonce, expiresAt: Date.now() + 5 * 60_000 });
  return ok({ nonce, expiresInSeconds: 300 });
});
