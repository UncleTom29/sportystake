#!/usr/bin/env node
// Verifies the Postgres and Redis this app depends on are reachable, so the
// `npm run dev` orchestration doesn't race the apps against cold infra.
// Both run as native Homebrew services (brew services start postgresql@16 /
// redis), not Docker containers — see scripts/init.mjs's top comment for why.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// No dotenv preload for this bare `node` invocation — fall back to reading
// .env directly, same as scripts/init.mjs's configuredEnvValue.
function configuredEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return '';
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  if (!line) return '';
  return line.slice(`${name}=`.length).trim().replace(/^['"]|['"]$/g, '');
}

const dbUrl = configuredEnvValue('DATABASE_URL');
const redisUrl = configuredEnvValue('REDIS_URL') || 'redis://localhost:6379';

function pgReady() {
  if (!dbUrl) return false;
  try {
    const { hostname, port, username, pathname } = new URL(dbUrl);
    execSync(
      `pg_isready -h ${hostname} -p ${port || 5432} -U ${decodeURIComponent(username)} -d ${pathname.slice(1)}`,
      { stdio: 'pipe' },
    );
    return true;
  } catch {
    return false;
  }
}

function redisReady() {
  try {
    const out = execSync(`redis-cli -u "${redisUrl}" --no-auth-warning ping`, { stdio: 'pipe' })
      .toString()
      .trim();
    return out === 'PONG';
  } catch {
    return false;
  }
}

const TIMEOUT_MS = 30_000;
const POLL_MS = 1_000;

const start = Date.now();
while (true) {
  const pg = pgReady();
  const redis = redisReady();
  if (pg && redis) {
    console.log('✓ infra ready (postgres, redis)');
    process.exit(0);
  }
  if (Date.now() - start > TIMEOUT_MS) {
    console.error('✗ infra not reachable within 30s:');
    console.error(`  - postgres: ${pg ? 'ready' : `not reachable at ${dbUrl || '(no DATABASE_URL configured)'}`}`);
    console.error(`  - redis: ${redis ? 'ready' : `not reachable at ${redisUrl}`}`);
    console.error('Both run as Homebrew services — try: brew services start postgresql@16 && brew services start redis');
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
