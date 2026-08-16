import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const maxAgeMs = 130 * 60 * 1000;
  const minStartTime = new Date(Date.now() - maxAgeMs);

  const updated = await prisma.market.updateMany({
    where: {
      status: "LIVE",
      startTime: { lt: minStartTime },
    },
    data: {
      status: "SETTLED",
    },
  });

  console.log(`[clean-stale-live] Updated ${updated.count} stale LIVE markets to SETTLED`);
}

main()
  .catch((e) => {
    console.error("Cleanup error:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
