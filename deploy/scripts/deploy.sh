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

# Everything after the git checkout lives in one function, invoked at the
# very bottom of the file. This script's own `git reset --hard` rewrites
# it on disk mid-run — bash parses a function body as a single unit before
# executing any of it, so `main` keeps running the version that was on
# disk when this invocation started, consistently, instead of risking a
# read of a half-old-half-new file straight off disk line by line. (Bit
# this bit us for real: the systemctl-restart fix below didn't take effect
# until the run *after* the one that pulled it in, because the old
# unguarded version of this script read the new commands mid-execution
# and executed the stale form anyway.)
main() {
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
  local live_config_backup=""
  if [[ -f data/virtual-liquidity.json ]]; then
    live_config_backup="$(mktemp)"
    cp data/virtual-liquidity.json "$live_config_backup"
  fi

  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"

  if [[ -n "$live_config_backup" ]]; then
    mkdir -p data
    cp "$live_config_backup" data/virtual-liquidity.json
    rm -f "$live_config_backup"
  fi

  pnpm install --frozen-lockfile --prod=false
  set -a
  source /etc/sportystake/.env
  set +a
  npx prisma generate
  npx prisma migrate deploy || npx prisma db push --accept-data-loss
  # Clear any stale next-build process or leftover .next/lock from an interrupted run
  pkill -f "next build" || true
  sleep 1
  rm -f .next/lock
  pnpm build

  # packages/oracle has its own build step (tsc) and its own deps — it uses
  # npm (package-lock.json), not pnpm, matching the root package.json's
  # `npm --prefix packages/oracle` scripts. --include=dev is required here:
  # /etc/sportystake/.env (sourced above) sets NODE_ENV=production, and
  # unlike the root `pnpm install --prod=false` above, a plain `npm ci`
  # honors NODE_ENV and silently omits devDependencies — including the
  # @types/* packages `tsc` needs, which fails the build with confusing
  # "could not find declaration file" errors instead of a clear one.
  # The explicit rm -rf is belt-and-suspenders: an npm ci run under the
  # wrong NODE_ENV once before can leave a partial node_modules that a
  # later `npm ci` doesn't always fully reconcile on its own — observed
  # firsthand on this exact box.
  (cd packages/oracle && rm -rf node_modules && npm ci --include=dev && npm run build)

  # `sportystake` isn't root and has no login session, so plain `systemctl
  # restart` fails with a polkit "interactive authentication required"
  # error — sudo it, one unit per invocation so each matches an exact
  # NOPASSWD entry in /etc/sudoers.d/sportystake-systemctl (see
  # provision.sh). A single multi-unit systemctl call can't be whitelisted
  # that way since sudoers matches the literal command line.
  for unit in web oracle sync-worker settlement-worker crash-worker; do
    sudo /usr/bin/systemctl restart "sportystake-${unit}"
  done

  echo "Deployed $(git rev-parse --short HEAD) — checking health"
  sleep 3
  curl -fsS http://127.0.0.1:3050/api/health || { echo "Health check failed" >&2; exit 1; }
  echo "OK"
}

main "$@"
