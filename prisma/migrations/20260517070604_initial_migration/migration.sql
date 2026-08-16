-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'SUSPENDED', 'LIVE', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'CANCELLED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "LegResult" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- CreateEnum
CREATE TYPE "LpStatus" AS ENUM ('ACTIVE', 'WITHDRAW_REQUESTED', 'SETTLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CasinoGame" AS ENUM ('CRASH', 'DICE', 'SLOTS', 'BLACKJACK', 'ROULETTE', 'BACCARAT');

-- CreateEnum
CREATE TYPE "CasinoStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "username" TEXT,
    "referralCode" VARCHAR(16) NOT NULL,
    "referredById" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "roles" "Role"[] DEFAULT ARRAY['USER']::"Role"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "leagueName" TEXT NOT NULL,
    "leagueLogo" TEXT,
    "country" TEXT NOT NULL,
    "countryCode" VARCHAR(8),
    "season" INTEGER NOT NULL,
    "round" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "homeTeamLogo" TEXT,
    "awayTeam" TEXT NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "awayTeamLogo" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
    "winningOutcome" INTEGER,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "liveMinute" INTEGER,
    "poolAddress" VARCHAR(42),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sport" TEXT NOT NULL DEFAULT 'football',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcomes" JSONB NOT NULL,

    CONSTRAINT "OddsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "outcome" INTEGER NOT NULL,
    "selectionLabel" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "oddsX1000" INTEGER NOT NULL,
    "potentialPayout" BIGINT NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "parlayId" TEXT,
    "txHash" VARCHAR(66),
    "blockNumber" BIGINT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parlay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stake" BIGINT NOT NULL,
    "combinedOddsX1000" BIGINT NOT NULL,
    "potentialPayout" BIGINT NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" VARCHAR(66),
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "Parlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParlayLeg" (
    "id" TEXT NOT NULL,
    "parlayId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcome" INTEGER NOT NULL,
    "selectionLabel" TEXT NOT NULL,
    "oddsX1000" INTEGER NOT NULL,
    "result" "LegResult" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ParlayLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LpPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "poolAddress" VARCHAR(42) NOT NULL,
    "onchainShares" BIGINT NOT NULL,
    "depositedUsdc" BIGINT NOT NULL,
    "currentValueUsdc" BIGINT NOT NULL DEFAULT 0,
    "finalUsdc" BIGINT,
    "pnl" BIGINT,
    "status" "LpStatus" NOT NULL DEFAULT 'ACTIVE',
    "withdrawalRequestedAt" TIMESTAMP(3),
    "depositTxHash" VARCHAR(66),
    "withdrawTxHash" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "LpPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasinoBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" "CasinoGame" NOT NULL,
    "amount" BIGINT NOT NULL,
    "multiplierX100" INTEGER,
    "payout" BIGINT NOT NULL DEFAULT 0,
    "status" "CasinoStatus" NOT NULL DEFAULT 'PENDING',
    "seedClientHash" TEXT,
    "seedServerHash" TEXT,
    "seedClient" TEXT,
    "seedServer" TEXT,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "txHash" VARCHAR(66),
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CasinoBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Market_externalId_key" ON "Market"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Market_fixtureId_key" ON "Market"("fixtureId");

-- CreateIndex
CREATE INDEX "Market_status_startTime_idx" ON "Market"("status", "startTime");

-- CreateIndex
CREATE INDEX "Market_leagueId_startTime_idx" ON "Market"("leagueId", "startTime");

-- CreateIndex
CREATE INDEX "Market_sport_status_startTime_idx" ON "Market"("sport", "status", "startTime");

-- CreateIndex
CREATE INDEX "Market_startTime_idx" ON "Market"("startTime");

-- CreateIndex
CREATE INDEX "OddsSnapshot_marketId_marketType_capturedAt_idx" ON "OddsSnapshot"("marketId", "marketType", "capturedAt");

-- CreateIndex
CREATE INDEX "Bet_userId_placedAt_idx" ON "Bet"("userId", "placedAt" DESC);

-- CreateIndex
CREATE INDEX "Bet_marketId_status_idx" ON "Bet"("marketId", "status");

-- CreateIndex
CREATE INDEX "Bet_status_settledAt_idx" ON "Bet"("status", "settledAt");

-- CreateIndex
CREATE INDEX "Parlay_userId_placedAt_idx" ON "Parlay"("userId", "placedAt" DESC);

-- CreateIndex
CREATE INDEX "ParlayLeg_parlayId_idx" ON "ParlayLeg"("parlayId");

-- CreateIndex
CREATE INDEX "LpPosition_userId_status_idx" ON "LpPosition"("userId", "status");

-- CreateIndex
CREATE INDEX "LpPosition_marketId_status_idx" ON "LpPosition"("marketId", "status");

-- CreateIndex
CREATE INDEX "CasinoBet_userId_placedAt_idx" ON "CasinoBet"("userId", "placedAt" DESC);

-- CreateIndex
CREATE INDEX "CasinoBet_game_placedAt_idx" ON "CasinoBet"("game", "placedAt" DESC);

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "OddsSnapshot" ADD CONSTRAINT "OddsSnapshot_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_parlayId_fkey" FOREIGN KEY ("parlayId") REFERENCES "Parlay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parlay" ADD CONSTRAINT "Parlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParlayLeg" ADD CONSTRAINT "ParlayLeg_parlayId_fkey" FOREIGN KEY ("parlayId") REFERENCES "Parlay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParlayLeg" ADD CONSTRAINT "ParlayLeg_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LpPosition" ADD CONSTRAINT "LpPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LpPosition" ADD CONSTRAINT "LpPosition_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasinoBet" ADD CONSTRAINT "CasinoBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
