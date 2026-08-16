-- DropIndex
DROP INDEX IF EXISTS "User_circleUserId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "circleUserId",
DROP COLUMN IF EXISTS "circleWalletId",
ADD COLUMN IF NOT EXISTS "privyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");
