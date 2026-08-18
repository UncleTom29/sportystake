-- CreateTable
CREATE TABLE "BlackjackHand" (
    "id" TEXT NOT NULL,
    "casinoBetId" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "playerHands" JSONB NOT NULL,
    "dealerHand" JSONB NOT NULL,
    "actionSeq" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlackjackHand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlackjackHand_casinoBetId_key" ON "BlackjackHand"("casinoBetId");

-- CreateIndex
CREATE INDEX "BlackjackHand_status_updatedAt_idx" ON "BlackjackHand"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "BlackjackHand" ADD CONSTRAINT "BlackjackHand_casinoBetId_fkey" FOREIGN KEY ("casinoBetId") REFERENCES "CasinoBet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
