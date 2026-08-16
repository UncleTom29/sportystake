-- Add per-user persistent favorites for markets and leagues.
CREATE TYPE "FavoriteKind" AS ENUM ('MARKET', 'LEAGUE');

CREATE TABLE "Favorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "FavoriteKind" NOT NULL,
  "key" TEXT NOT NULL,
  "marketId" TEXT,
  "leagueId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Favorite_userId_key_key" ON "Favorite"("userId", "key");
CREATE INDEX "Favorite_userId_kind_createdAt_idx" ON "Favorite"("userId", "kind", "createdAt" DESC);
CREATE INDEX "Favorite_marketId_idx" ON "Favorite"("marketId");
CREATE INDEX "Favorite_leagueId_idx" ON "Favorite"("leagueId");

ALTER TABLE "Favorite"
  ADD CONSTRAINT "Favorite_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Favorite"
  ADD CONSTRAINT "Favorite_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "Market"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
