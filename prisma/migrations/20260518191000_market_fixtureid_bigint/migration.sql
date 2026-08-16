-- Widen fixture ids from INT4 to INT8 to support external provider ids.
ALTER TABLE "Market"
  ALTER COLUMN "fixtureId" TYPE BIGINT USING "fixtureId"::BIGINT;
