#!/usr/bin/env bash
# Deploys the current state of the `main` branch to this box. Run directly
# on the EC2 instance (as the `sportystake` user or via sudo -u sportystake),
# or invoked over SSH from CI — see .github/workflows/deploy.yml's
# deploy-ec2 job.
#
# Assumes deploy/scripts/provision.sh has already run once (systemd units,
# nginx, /etc/sportystake/.env all in place) and /opt/sportystake is either
# already a git clone of this repo, or this is the first run (git clone
# happens below if the directory is empty).
set -euo pipefail

REPO_DIR=/opt/sportystake
REPO_URL="${SPORTYSTAKE_REPO_URL:-}"
BRANCH="${SPORTYSTAKE_BRANCH:-main}"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  if [[ -z "$REPO_URL" ]]; then
    echo "First deploy: set SPORTYSTAKE_REPO_URL to clone from." >&2
    exit 1
  fi
  git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"

# The admin API writes live values into data/virtual-liquidity.json at
# runtime (see src/lib/server/virtualLiquidityStore.ts), but that path is
# also a tracked file in git with its own (stale) checked-in defaults —
# `git reset --hard` would silently revert any live admin edits back to
# those defaults on every deploy. Snapshot before, restore after, so only
# a box's very first deploy ever uses the repo's committed defaults.
LIVE_CONFIG_BACKUP=""
if [[ -f data/virtual-liquidity.json ]]; then
  LIVE_CONFIG_BACKUP="$(mktemp)"
  cp data/virtual-liquidity.json "$LIVE_CONFIG_BACKUP"
fi

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

if [[ -n "$LIVE_CONFIG_BACKUP" ]]; then
  mkdir -p data
  cp "$LIVE_CONFIG_BACKUP" data/virtual-liquidity.json
  rm -f "$LIVE_CONFIG_BACKUP"
fi

pnpm install --frozen-lockfile --prod=false
set -a
source /etc/sportystake/.env
set +a
npx prisma generate
npx prisma migrate deploy
pnpm build

# packages/oracle has its own build step (tsc) and its own deps — it uses
# npm (package-lock.json), not pnpm, matching the root package.json's
# `npm --prefix packages/oracle` scripts. --include=dev is required here:
# /etc/sportystake/.env (sourced above) sets NODE_ENV=production, and
# unlike the root `pnpm install --prod=false` above, a plain `npm ci`
# honors NODE_ENV and silently omits devDependencies — including the
# @types/* packages `tsc` needs, which fails the build with confusing
# "could not find declaration file" errors instead of a clear one.
(cd packages/oracle && npm ci --include=dev && npm run build)

systemctl restart sportystake-web sportystake-oracle sportystake-sync-worker sportystake-settlement-worker sportystake-crash-worker

echo "Deployed $(git rev-parse --short HEAD) — checking health"
sleep 3
curl -fsS http://127.0.0.1:3000/api/health || { echo "Health check failed" >&2; exit 1; }
echo "OK"
