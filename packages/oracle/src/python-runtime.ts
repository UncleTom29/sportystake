/**
 * Resolves a python3 interpreter that's actually safe to scrape with.
 *
 * Two independent failure modes were found running the xbet_* scrapers under
 * whatever `python3` happened to be first on this process's inherited PATH:
 *
 *   1. macOS's bundled /usr/bin/python3 (3.9.x) predates PEP 604 and can't
 *      even parse this codebase's `X | None` type hints.
 *   2. Its TLS stack gets a flat 403 from 1xbet on every request — same
 *      code, same headers, different interpreter — almost certainly TLS
 *      fingerprinting against Apple's bundled OpenSSL/LibreSSL build.
 *
 * Bare `execFileSync('python3', ...)` can silently land on that interpreter
 * depending on which shell launched this process, with no indication why
 * the scraper is failing beyond a truncated stack trace. This picks a
 * modern interpreter deterministically instead, and fails loudly if none
 * exists rather than silently trying a known-bad one.
 *
 * Set PYTHON3_BIN to force a specific interpreter (e.g. in a container where
 * only one python3 exists and version-probing is unnecessary overhead).
 */
import { execFileSync } from 'node:child_process';

const MIN_VERSION: readonly [number, number] = [3, 10];

// Version-suffixed names first (portable across Linux/deadsnakes/pyenv),
// then common Homebrew/local install locations, then bare `python3` last —
// it's the one most likely to resolve to a stale system interpreter.
const CANDIDATES = [
  'python3.13', 'python3.12', 'python3.11', 'python3.10',
  '/opt/homebrew/bin/python3', '/usr/local/bin/python3',
  'python3',
];

let cached: string | undefined;

function satisfiesMinVersion(bin: string): boolean {
  try {
    const out = execFileSync(
      bin,
      ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'],
      { timeout: 5_000 },
    ).toString().trim();
    const [major, minor] = out.split('.').map(Number);
    return major > MIN_VERSION[0] || (major === MIN_VERSION[0] && minor >= MIN_VERSION[1]);
  } catch {
    return false; // not on PATH, not executable, or too old to even run -c cleanly
  }
}

export function resolvePython3(): string {
  if (cached) return cached;

  const candidates = process.env.PYTHON3_BIN ? [process.env.PYTHON3_BIN] : CANDIDATES;
  const found = candidates.find(satisfiesMinVersion);
  if (!found) {
    throw new Error(
      `No Python ${MIN_VERSION.join('.')}+ interpreter found (tried: ${candidates.join(', ')}). ` +
      'Install one or set PYTHON3_BIN to an explicit path.',
    );
  }
  cached = found;
  return found;
}
