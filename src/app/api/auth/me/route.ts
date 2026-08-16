import { NextRequest } from "next/server";
import { ok, fail, withRequestId } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { UsersRepo } from "@/lib/server/repos/users.repo";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";

export const GET = withRequestId(async (req: NextRequest) => {
  const auth = await readAuthFromRequest(req);
  if (!auth) return fail("Unauthorized", "Not signed in", 401);
  const user = await UsersRepo.byId(auth.sub);
  if (!user) return fail("Unauthorized", "User not found", 401);

  // Check if referral code was passed on auth me check
  const refCode = req.nextUrl.searchParams.get("ref")?.trim();
  if (refCode && !user.referredById) {
    const referrer = await prisma.user.findFirst({
      where: {
        OR: [
          { referralCode: { equals: refCode, mode: "insensitive" } },
          { username: { equals: refCode, mode: "insensitive" } },
        ],
        id: { not: user.id },
      },
    });

    if (referrer) {
      await prisma.user.update({
        where: { id: user.id },
        data: { referredById: referrer.id },
      });
      user.referredById = referrer.id;
    }
  }

  const stats = await UsersRepo.stats(user.id);
  return ok({ user, stats });
});
