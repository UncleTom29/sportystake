-- Widen team ids from INT4 to INT8 for feeds with large player/team ids.
ALTER TABLE "Market"
  ALTER COLUMN "homeTeamId" TYPE BIGINT USING "homeTeamId"::BIGINT,
  ALTER COLUMN "awayTeamId" TYPE BIGINT USING "awayTeamId"::BIGINT;
