#!/usr/bin/env bash
# One-time provisioning for a fresh Ubuntu EC2 box. Run manually over SSH
# (sudo bash deploy/scripts/provision.sh) once the instance is reachable —
# NOT wired into CI, since it's meant to run once per box, not per deploy.
#
# Assumes: Ubuntu 22.04/24.04, EC2 security group already restricts inbound
# 443 to Cloudflare's IP ranges and 22 to your admin IP (this script also
# applies the matching ufw rules as defense-in-depth — see next.config.ts's
# rewrites() comment and src/proxy.ts's cf-connecting-ip trust for why both
# layers matter).
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo bash provision.sh)" >&2
  exit 1
fi

echo "==> Installing base packages"
apt-get update
apt-get install -y curl git nginx ufw build-essential ca-certificates gnupg postgresql redis-server

echo "==> Installing Node 20.x + pnpm"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
corepack enable
# Pinned to match the version that generated pnpm-lock.yaml (lockfileVersion
# 9.0) — pnpm@latest requires Node >=22.13, but we're intentionally on
# Node 20.x to match package.json's engines field and this box's LTS choice.
corepack prepare pnpm@9.0.0 --activate

echo "==> Creating sportystake system user + directories"
id -u sportystake &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin sportystake
mkdir -p /opt/sportystake /etc/sportystake /etc/ssl/cloudflare
chown -R sportystake:sportystake /opt/sportystake

# corepack's package-manager cache is per-user, so the pin above (done as
# root/ubuntu) doesn't cover the sportystake user that actually runs
# pnpm/build/systemd commands — repeat it for that user explicitly.
sudo -u sportystake -H bash -c 'cd /opt/sportystake && corepack prepare pnpm@9.0.0 --activate'
touch /etc/sportystake/.env
chmod 600 /etc/sportystake/.env
chown sportystake:sportystake /etc/sportystake/.env

echo "==> nginx"
cp deploy/nginx/sportystake.conf /etc/nginx/sites-available/sportystake
ln -sf /etc/nginx/sites-available/sportystake /etc/nginx/sites-enabled/sportystake
echo "    NOTE: place your Cloudflare Origin CA cert/key at"
echo "    /etc/ssl/cloudflare/origin.{pem,key} before reloading nginx."

echo "==> systemd units"
cp deploy/systemd/sportystake-*.service /etc/systemd/system/
systemctl daemon-reload
for unit in web oracle sync-worker settlement-worker crash-worker; do
  systemctl enable "sportystake-${unit}.service"
done

echo "==> sudoers: let sportystake restart its own units without a password"
# sportystake's shell is nologin (no session), so a plain `systemctl
# restart` as that user fails polkit's interactive-auth check even though
# it owns these exact units — deploy.sh needs this to restart itself
# after every deploy. One NOPASSWD entry per unit, not a wildcard, so the
# grant can't be used to restart anything else on the box.
cat > /etc/sudoers.d/sportystake-systemctl << 'SUDOERS'
sportystake ALL=(root) NOPASSWD: /usr/bin/systemctl restart sportystake-web
sportystake ALL=(root) NOPASSWD: /usr/bin/systemctl restart sportystake-oracle
sportystake ALL=(root) NOPASSWD: /usr/bin/systemctl restart sportystake-sync-worker
sportystake ALL=(root) NOPASSWD: /usr/bin/systemctl restart sportystake-settlement-worker
sportystake ALL=(root) NOPASSWD: /usr/bin/systemctl restart sportystake-crash-worker
SUDOERS
chmod 440 /etc/sudoers.d/sportystake-systemctl
visudo -cf /etc/sudoers.d/sportystake-systemctl

echo "==> ufw: deny by default, allow SSH from admin IP + 443 from Cloudflare only"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
echo "    Set your admin IP below before running: ufw allow from <ADMIN_IP> to any port 22 proto tcp"
for ip in $(curl -fsSL https://www.cloudflare.com/ips-v4); do
  ufw allow from "$ip" to any port 443 proto tcp
done
for ip in $(curl -fsSL https://www.cloudflare.com/ips-v6); do
  ufw allow from "$ip" to any port 443 proto tcp
done
echo "    Review rules with 'ufw status numbered', then 'ufw enable' when ready."

echo "==> Done. Next steps:"
echo "  1. Add your admin IP: ufw allow from <ADMIN_IP> to any port 22 proto tcp && ufw enable"
echo "  2. Install Cloudflare Origin CA cert at /etc/ssl/cloudflare/origin.{pem,key}, then: nginx -t && systemctl reload nginx"
echo "  3. Fill in /etc/sportystake/.env (see .env.production.example in the repo)"
echo "  4. Run deploy/scripts/deploy.sh to ship the first build"
