import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, withRequestId, ApiError } from "@/lib/server/api-response";
import { readAuthFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

const RoleBody = z.object({
  roles: z.array(z.nativeEnum(Role)).min(1, "At least 1 role is required"),
});

export const PATCH = withRequestId(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await readAuthFromRequest(req);
    if (!auth || !auth.roles.includes("ADMIN")) {
      throw new ApiError("Forbidden", "Admin access required", 403);
    }

    const { id } = await ctx.params;
    const parsed = RoleBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail("ValidationError", "Invalid roles array", 400, { details: parsed.error.issues });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError("NotFound", "User not found", 404);

    const updated = await prisma.user.update({
      where: { id },
      data: { roles: parsed.data.roles },
    });

    return ok({
      user: {
        ...updated,
        walletAddress: updated.walletAddress as `0x${string}`,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  },
);
