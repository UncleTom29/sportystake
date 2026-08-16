-- AlterTable
ALTER TABLE "User" ADD COLUMN     "circleUserId" TEXT NOT NULL,
ADD COLUMN     "circleWalletId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_circleUserId_key" ON "User"("circleUserId");

