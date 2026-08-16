-- CreateTable
CREATE TABLE "BetSlipStore" (
    "ipAddress" TEXT NOT NULL,
    "selections" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetSlipStore_pkey" PRIMARY KEY ("ipAddress")
);

-- CreateIndex
CREATE INDEX "BetSlipStore_updatedAt_idx" ON "BetSlipStore"("updatedAt");
