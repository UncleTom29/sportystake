-- AlterEnum
BEGIN;
CREATE TYPE "LpStatus_new" AS ENUM ('ACTIVE', 'WITHDRAW_REQUESTED', 'WITHDRAWN');
ALTER TABLE "LpPosition" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "LpPosition" ALTER COLUMN "status" TYPE "LpStatus_new" USING ("status"::text::"LpStatus_new");
ALTER TYPE "LpStatus" RENAME TO "LpStatus_old";
ALTER TYPE "LpStatus_new" RENAME TO "LpStatus";
DROP TYPE "LpStatus_old";
ALTER TABLE "LpPosition" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "LpPosition" DROP CONSTRAINT "LpPosition_marketId_fkey";

-- DropIndex
DROP INDEX "LpPosition_marketId_status_idx";

-- DropIndex
DROP INDEX "LpPosition_userId_status_idx";

-- AlterTable
ALTER TABLE "LpPosition" DROP COLUMN "finalUsdc",
DROP COLUMN "marketId",
DROP COLUMN "pnl",
DROP COLUMN "poolAddress",
DROP COLUMN "settledAt",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Market" DROP COLUMN "poolAddress";

-- CreateIndex
CREATE UNIQUE INDEX "LpPosition_userId_key" ON "LpPosition"("userId");

-- CreateIndex
CREATE INDEX "LpPosition_status_idx" ON "LpPosition"("status");

