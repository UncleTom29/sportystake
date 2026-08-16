-- AlterTable
ALTER TABLE "CasinoBet" ADD COLUMN     "requestId" VARCHAR(66);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT DEFAULT '🎯';

-- CreateTable
CREATE TABLE "BookedBet" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "selections" JSONB NOT NULL,
    "totalOdds" DOUBLE PRECISION NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookedBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookedBet_code_key" ON "BookedBet"("code");

-- CreateIndex
CREATE INDEX "BookedBet_code_idx" ON "BookedBet"("code");

-- CreateIndex
CREATE INDEX "BookedBet_createdAt_idx" ON "BookedBet"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CasinoBet_requestId_key" ON "CasinoBet"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "CasinoBet_txHash_key" ON "CasinoBet"("txHash");

-- AddForeignKey
ALTER TABLE "BookedBet" ADD CONSTRAINT "BookedBet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

