-- AlterTable
ALTER TABLE "Bet" ADD COLUMN IF NOT EXISTS "bookingCode" VARCHAR(12);

-- AlterTable
ALTER TABLE "Parlay" ADD COLUMN IF NOT EXISTS "bookingCode" VARCHAR(12);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bet_bookingCode_idx" ON "Bet"("bookingCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Parlay_bookingCode_idx" ON "Parlay"("bookingCode");
