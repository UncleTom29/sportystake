#!/usr/bin/env node
/**
 * Idempotent dev-startup initializer. Runs after infra (Postgres + Redis)
 * is up and before `next dev` / the oracle / workers boot.
 *
 * What it does:
 *   1. Installs sub-package dependencies if their node_modules is missing.
 *   2. Applies the canonical SQL schema via `docker exec` so the migration
 *      always reaches the right Postgres container — even when a local
 *      Postgres is already running on port 5432.
 *   3. Runs `prisma generate` so the @prisma/client matches schema.prisma.
 *
 * Safe to re-run — every DDL statement is guarded with IF NOT EXISTS / IF
 * EXISTS so running this against an already-initialised database is a no-op.
 */
import { execSync, execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), "..");

const GREEN = "\x1b[32m";
const GRAY  = "\x1b[90m";
const YELLOW = "\x1b[33m";
const RED   = "\x1b[31m";
const RESET = "\x1b[0m";

const log  = (l) => process.stdout.write(`${GRAY}[init]${RESET} ${l}\n`);
const ok   = (l) => process.stdout.write(`${GREEN}✓${RESET} ${l}\n`);
const warn = (l) => process.stdout.write(`${YELLOW}!${RESET} ${l}\n`);
const fail = (l) => { process.stderr.write(`${RED}✗${RESET} ${l}\n`); process.exit(1); };

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}
function tryRun(cmd, opts = {}) {
  try { execSync(cmd, { stdio: "pipe", cwd: ROOT, ...opts }); return true; }
  catch { return false; }
}

// ─── 1. Sub-package dependencies ─────────────────────────────────────────────

const SUBPACKAGES = [
  { dir: "packages/oracle",    required: true  },
  { dir: "packages/sdk",       required: false },
  { dir: "packages/contracts", required: false },
];

for (const pkg of SUBPACKAGES) {
  const abs = join(ROOT, pkg.dir);
  if (!existsSync(join(abs, "package.json"))) continue;
  if (existsSync(join(abs, "node_modules")))  continue;
  log(`installing deps for ${pkg.dir} (first run)…`);
  try {
    run(`npm --prefix ${pkg.dir} install`, { stdio: "inherit" });
    ok(`${pkg.dir} deps installed`);
  } catch (err) {
    if (pkg.required) fail(`failed to install ${pkg.dir}: ${err.message}`);
    else warn(`${pkg.dir} install failed (non-required) — continuing`);
  }
}

// ─── 2. Schema migration via docker exec ─────────────────────────────────────
//
// Why docker exec instead of `prisma migrate deploy`?
// ─────────────────────────────────────────────────────
// When a local Postgres is already running on port 5432 (e.g. Homebrew or
// Postgres.app) the DATABASE_URL connection hits the local server instead of
// the Docker container — causing auth errors.  Running SQL through the
// container's own `psql` binary bypasses the port entirely.
//
// The schema SQL uses IF NOT EXISTS / IF EXISTS guards so every run is safe.

const CONTAINER = "sportystake-postgres";
const PG_USER   = "sportystake";
const PG_DB     = "sportystake";

function dockerPsqlExists() {
  try {
    execFileSync("docker", ["inspect", "--format={{.State.Running}}", CONTAINER], {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function runSqlViaDocker(sql) {
  execFileSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB],
    { input: sql, stdio: ["pipe", "inherit", "inherit"] },
  );
}

function runSqlViaPrisma(sql) {
  execFileSync(
    "npx",
    ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"],
    { input: sql, stdio: ["pipe", "inherit", "inherit"], cwd: ROOT },
  );
}

// This script runs as a bare `node scripts/init.mjs` with no dotenv preload,
// so process.env won't have .env's values unless the caller's shell already
// exported them — fall back to reading the file directly for either var.
function configuredEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return "";
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  if (!line) return "";
  const raw = line.slice(`${name}=`.length).trim();
  return raw.replace(/^['"]|['"]$/g, "");
}
function configuredDatabaseUrl() {
  return configuredEnvValue("DATABASE_URL");
}

function shouldUseDockerForConfiguredDb() {
  if (!dockerPsqlExists()) return false;
  const dbUrl = configuredDatabaseUrl();
  if (!dbUrl) return true;
  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname;
    const user = decodeURIComponent(parsed.username || "");
    const dbName = parsed.pathname.replace(/^\/+/, "");
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    return isLocalHost && user === PG_USER && dbName === PG_DB;
  } catch {
    return true;
  }
}

/**
 * Build a fully-idempotent version of the canonical migration SQL.
 *
 * Postgres 16 doesn't support CREATE TYPE IF NOT EXISTS for enum types, so we
 * wrap each CREATE TYPE … AS ENUM in a DO block that catches duplicate_object.
 * Everything else uses the standard IF NOT EXISTS / IF EXISTS guards.
 */
function idempotentSql(rawSql) {
  return rawSql
    // CREATE TYPE "Foo" AS ENUM (…);  →  DO block that swallows duplicate_object
    .replace(
      /CREATE TYPE ("?\w+"?) AS ENUM \(([^)]+)\);/g,
      (_, typeName, values) =>
        `DO $$ BEGIN\n  CREATE TYPE ${typeName} AS ENUM (${values});\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;`,
    )
    // CREATE TABLE → only if not exists
    .replace(/CREATE TABLE ("?\w+"?)\s*\(/g, "CREATE TABLE IF NOT EXISTS $1 (")
    // CREATE UNIQUE INDEX → only if not exists
    .replace(/CREATE UNIQUE INDEX ("?\w+"?)/g, "CREATE UNIQUE INDEX IF NOT EXISTS $1")
    // CREATE INDEX → only if not exists
    .replace(/CREATE INDEX ("?\w+"?)/g, "CREATE INDEX IF NOT EXISTS $1")
    // ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY → DO block to skip if exists
    .replace(
      /ALTER TABLE ("?\w+"?) ADD CONSTRAINT ("?\w+"?) (FOREIGN KEY[^;]+);/g,
      (_, tbl, con, rest) =>
        `DO $$ BEGIN\n  ALTER TABLE ${tbl} ADD CONSTRAINT ${con} ${rest};\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;`,
    )
    // ALTER TABLE … ADD COLUMN … → IF NOT EXISTS so re-runs self-heal
    .replace(
      /ALTER TABLE\s+("?\w+"?)\s+ADD COLUMN\s+("?\w+"?)\s+/g,
      "ALTER TABLE $1 ADD COLUMN IF NOT EXISTS $2 ",
    );
}

function getMigrationSqlPaths() {
  const migrationsRoot = join(ROOT, "prisma", "migrations");
  if (!existsSync(migrationsRoot)) return [];

  const entries = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const missingSql = entries.filter((name) => !existsSync(join(migrationsRoot, name, "migration.sql")));
  if (missingSql.length > 0) {
    fail(`missing migration.sql in: ${missingSql.join(", ")}`);
  }

  return entries.map((name) => join(migrationsRoot, name, "migration.sql"));
}

const RECONCILIATION_SQL = `
ALTER TABLE "Market" ALTER COLUMN "fixtureId" TYPE BIGINT USING "fixtureId"::BIGINT;
ALTER TABLE "Market" ALTER COLUMN "homeTeamId" TYPE BIGINT USING "homeTeamId"::BIGINT;
ALTER TABLE "Market" ALTER COLUMN "awayTeamId" TYPE BIGINT USING "awayTeamId"::BIGINT;
ALTER TABLE "Market" ADD COLUMN IF NOT EXISTS "sport" TEXT NOT NULL DEFAULT 'football';
ALTER TABLE "Market" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Market_sport_status_startTime_idx" ON "Market"("sport", "status", "startTime");
ALTER TABLE "Market" ALTER COLUMN "updatedAt" DROP DEFAULT;
`;

const migrationSqlPaths = getMigrationSqlPaths();

if (migrationSqlPaths.length === 0) {
  fail("no migration SQL files found under prisma/migrations");
}
log(`found ${migrationSqlPaths.length} migration SQL file(s)`);

if (!shouldUseDockerForConfiguredDb()) {
  // When DATABASE_URL points to a non-container DB, prefer Prisma so init
  // updates the same database the app is actually using.
  if (dockerPsqlExists()) {
    warn(`container ${CONTAINER} is running but DATABASE_URL targets a different DB — using Prisma path`);
  } else {
    warn(`container ${CONTAINER} not running — falling back to prisma migrate deploy`);
  }
  log("applying pending migrations…");
  if (!tryRun("npx prisma migrate deploy")) {
    fail("migration failed — verify local PostgreSQL or Docker is running on port 5432");
  }
  log("reconciling schema drift…");
  runSqlViaPrisma(RECONCILIATION_SQL);
  ok("database in sync (via prisma migrate deploy)");
} else {
  log("applying schema via docker exec psql…");
  const sql = migrationSqlPaths
    .map((file) => idempotentSql(readFileSync(file, "utf8")))
    .join("\n\n");
  try {
    runSqlViaDocker(sql);
    runSqlViaDocker(RECONCILIATION_SQL);
    ok("database schema in sync");
  } catch (err) {
    fail(`schema apply failed: ${err.message}`);
  }
}

// ─── 2.5. Auto-detect & self-heal any schema.prisma drift beyond known migrations ──
//
// Step 2 above only replays changes that were actually captured into a
// migration.sql file. If schema.prisma is ever hand-edited (or generated by
// a tool) without running `prisma migrate dev`, the columns/tables it
// declares silently don't exist in the DB — every read/write touching one
// then fails at runtime with a Prisma P2022 error, discovered by whoever
// hits it next in the browser. This has happened for real, more than once
// (User.bonusOptIn; then User.avatar, CasinoBet.requestId, and the
// BookedBet table together) — RECONCILIATION_SQL above was an earlier,
// hand-written patch for exactly one such incident. `prisma migrate dev`
// can't run here since it requires an interactive terminal (confirmed: it
// refuses non-interactively) — this replaces the "notice it, hand-write
// SQL" pattern with a fully automatic diff + apply, so drift is caught and
// fixed before `next dev` ever starts.
//
// Safety: additive drift (new columns/tables — the only kind observed so
// far) is applied automatically. If the diff contains anything destructive
// (DROP COLUMN/TABLE/TYPE — e.g. a field removed from schema.prisma), it is
// surfaced but NOT auto-applied, since that could silently discard local
// data a developer didn't realize was on the chopping block.
function syncSchemaDrift() {
  const dbUrl = configuredDatabaseUrl();
  if (!dbUrl) {
    warn("DATABASE_URL not resolved — skipping schema-drift check");
    return;
  }

  let diffSql;
  try {
    diffSql = execFileSync(
      "npx",
      ["prisma", "migrate", "diff", "--from-url", dbUrl, "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
      { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] },
    ).toString();
  } catch (err) {
    warn(`schema-drift check failed — continuing without it: ${err.message}`);
    return;
  }

  const hasRealStatements = diffSql
    .split("\n")
    .some((line) => !line.trim().startsWith("--") && line.trim().length > 0);
  if (!hasRealStatements) {
    ok("schema.prisma matches the database — no drift");
    return;
  }

  if (/\bDROP\s+(COLUMN|TABLE|TYPE)\b/i.test(diffSql)) {
    warn("schema.prisma has drifted from the database, and the fix includes a DROP — not auto-applying:");
    console.log(diffSql);
    warn("review this manually: npx prisma migrate diff --from-url \"$DATABASE_URL\" --to-schema-datamodel prisma/schema.prisma --script");
    return;
  }

  warn("schema.prisma has drifted from the database — auto-generating a migration to close the gap:");
  console.log(diffSql);

  const stamp = new Date().toISOString().replace(/[-:TZ]|\.\d+/g, "").slice(0, 14);
  const migrationName = `${stamp}_auto_sync_drift`;
  const dir = join(ROOT, "prisma", "migrations", migrationName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "migration.sql"), diffSql);

  try {
    if (shouldUseDockerForConfiguredDb()) {
      runSqlViaDocker(idempotentSql(diffSql));
    } else {
      runSqlViaPrisma(diffSql);
    }
    // Record it as applied in Prisma's own tracking table too (it was just
    // applied directly above, not via `migrate deploy`), so migrate
    // status/deploy on this or any other machine sees it as done instead of
    // trying to reapply it.
    tryRun(`npx prisma migrate resolve --applied ${basename(dir)}`);
    ok(`auto-generated and applied prisma/migrations/${migrationName}/migration.sql`);
  } catch (err) {
    fail(`schema auto-sync failed to apply — fix manually: ${err.message}`);
  }
}

syncSchemaDrift();

// ─── 3. Prisma client ─────────────────────────────────────────────────────────

if (!existsSync(join(ROOT, "prisma", "schema.prisma"))) {
  warn("no prisma/schema.prisma — skipping generate");
  process.exit(0);
}

log("generating prisma client…");
if (tryRun("npx --no-install prisma generate")) {
  ok("prisma client up to date");
} else {
  run("npx prisma generate");
  ok("prisma client generated");
}

// ─── 4. Purge stale odds-api markets ──────────────────────────────────────────
//
// The DailyFixturesJob fetches fixture metadata from the odds-api provider and
// publishes it so the oracle's quota tracker and cache stay current. A side
// effect is that the oracle-sync worker used to upsert a Market row for every
// discovered fixture — creating thousands of empty rows with no odds that
// appear in the sportsbook UI. The worker now skips oddsapi: externalIds, but
// any rows created by older code are purged here at startup.

// Purge all legacy non-1xbet markets: oddsapi:, betika:, betking:, 1xcorp: prefixes.
// The app is now single-provider (1xbet) so these rows are stale and should be
// removed on startup so they don't appear in the UI or conflict with fresh data.
const PURGE_LEGACY_SQL = `
  DELETE FROM "Market"
  WHERE "externalId" LIKE 'oddsapi:%'
     OR "externalId" LIKE 'betika:%'
     OR "externalId" LIKE 'betking:%'
     OR "externalId" LIKE '1xcorp:%'
     OR "externalId" LIKE 'melbet:%'
     OR "externalId" LIKE '22bet:%'
     OR "externalId" LIKE 'betwinner:%';
`;

log("purging stale legacy-provider markets…");
try {
  if (shouldUseDockerForConfiguredDb()) {
    runSqlViaDocker(PURGE_LEGACY_SQL);
  } else {
    runSqlViaPrisma(PURGE_LEGACY_SQL);
  }
  ok("legacy markets purged");
} catch (err) {
  warn(`purge skipped: ${err.message}`);
}

// ─── 5. Delete kicked-off sports markets from DB ──────────────────────────────
//
// Markets whose closesAt is in the past are either already in play or finished.
// They must not appear in the prematch sportsbook on the next load. The oracle's
// mark-and-sweep handles ongoing cleanup, but at cold-start we purge immediately
// so the UI is clean before the first oracle scrape completes (~90 s).
const PURGE_PAST_MARKETS_SQL = `
  DELETE FROM "Market"
  WHERE sport != 'prediction-markets'
    AND status IN ('OPEN', 'SUSPENDED')
    AND "closesAt" < NOW();
`;

log("purging past-kickoff sports markets from DB…");
try {
  if (shouldUseDockerForConfiguredDb()) {
    runSqlViaDocker(PURGE_PAST_MARKETS_SQL);
  } else {
    runSqlViaPrisma(PURGE_PAST_MARKETS_SQL);
  }
  ok("past-kickoff markets purged");
} catch (err) {
  warn(`purge skipped: ${err.message}`);
}

// ─── 6. Flush oracle Redis caches ─────────────────────────────────────────────
//
// The oracle-sync worker's seedFromCache() re-injects whatever
// oracle:fixtures:date:* keys are alive in Redis into the DB. If the app is
// restarted hours later those cached fixtures are stale (wrong kick-off times,
// wrong odds, may include already-finished events). Flushing them here forces
// the sync-worker to rely on the fresh DB state and the oracle's first scrape.
// oracle:live:events is similarly flushed so the Live page doesn't serve
// scores from the previous session until the live-poller runs.

log("flushing oracle Redis caches…");
try {
  const redisUrl = configuredEnvValue("REDIS_URL") || "redis://localhost:6379";
  // Use redis-cli for a dependency-free flush. Matches all oracle:* keys.
  execSync(`redis-cli -u "${redisUrl}" --no-auth-warning EVAL "local k=redis.call('KEYS','oracle:*') if #k>0 then redis.call('DEL',unpack(k)) end return #k" 0`, { stdio: "pipe" });
  ok("oracle Redis caches flushed");
} catch (err) {
  warn(`redis flush skipped: ${err.message}`);
}

ok("init complete");
