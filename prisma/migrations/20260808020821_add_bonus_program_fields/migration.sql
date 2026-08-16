-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "isBonusBet" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Parlay" ADD COLUMN     "isBonusBet" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bonusBalance" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "bonusClaimedAt" TIMESTAMP(3),
ADD COLUMN     "bonusExpiresAt" TIMESTAMP(3),
ADD COLUMN     "bonusOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bonusRolloverWagered" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "bonusStatus" TEXT NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "initialBonusAmount" BIGINT NOT NULL DEFAULT 0;

