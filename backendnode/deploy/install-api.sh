#!/usr/bin/env bash
# Non-interactive, idempotent installer for the Dima "api" server (10.10.10.20).
# Compatible with Debian 12 (bookworm64) and Ubuntu 24.04.
#
# Required secrets (via environment or DEPLOY_ENV_FILE / .env.deploy):
#   DB_PASSWORD   - password for the least-privilege MySQL app user
#   JWT_SECRET    - 32+ char HS256 signing secret
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
DPKG_OPTS=(-o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_SOURCE_DIR="${APP_SOURCE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
APP_DIR="/opt/backendnode"
ENV_DIR="/etc/backendnode"
ENV_FILE="${ENV_DIR}/backendnode.env"
CERTS_DIR="${CERTS_DIR:-${SCRIPT_DIR}/certs}"

# Optional gitignored .env.deploy loader
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${SCRIPT_DIR}/.env.deploy}"
if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
  set +a
fi

if [[ -z "${DB_PASSWORD:-}" ]]; then
  echo "ERROR: DB_PASSWORD must be set in environment or $DEPLOY_ENV_FILE" >&2
  exit 1
fi
if [[ -z "${JWT_SECRET:-}" || "${#JWT_SECRET}" -lt 32 ]]; then
  echo "ERROR: JWT_SECRET (at least 32 characters) must be set in environment or $DEPLOY_ENV_FILE" >&2
  exit 1
fi

DB_HOST="${DB_HOST:-10.10.10.30}"
DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="${DB_DATABASE:-dima_db}"
DB_USER="${DB_USER:-dima_app}"
DB_SSL="${DB_SSL:-false}"
DB_SSL_CA="${DB_SSL_CA:-}"
CORS_ORIGINS="${CORS_ORIGINS:-https://web.dima.lab}"
FILES_IN_BD="${FILES_IN_BD:-false}"
WEB_HOST="${WEB_HOST:-10.10.10.10}"
TRUST_PROXY="${TRUST_PROXY:-loopback,${WEB_HOST}}"

# 1. Base packages
apt-get update -y
apt-get install -y "${DPKG_OPTS[@]}" ca-certificates curl gnupg nginx ufw

# 2. Node.js 22 LTS via NodeSource (Debian 12 & Ubuntu 24.04)
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
fi
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y "${DPKG_OPTS[@]}" nodejs
fi

# 3. Dedicated unprivileged service account
id backendnode &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin backendnode

# 4. Deploy application to /opt/backendnode
systemctl stop backendnode 2>/dev/null || true
install -d -o root -g root -m 755 "$APP_DIR"
rm -rf "${APP_DIR:?}/src" "${APP_DIR:?}/dist" "${APP_DIR:?}/scripts"
cp -a "${APP_SOURCE_DIR}/package.json" "${APP_SOURCE_DIR}/package-lock.json" "$APP_DIR/"
if [[ -f "${APP_SOURCE_DIR}/tsconfig.json" ]]; then
  cp -a "${APP_SOURCE_DIR}/tsconfig.json" "$APP_DIR/"
fi
if [[ -d "${APP_SOURCE_DIR}/src" ]]; then
  cp -a "${APP_SOURCE_DIR}/src" "$APP_DIR/"
fi
if [[ -d "${APP_SOURCE_DIR}/dist" ]]; then
  cp -a "${APP_SOURCE_DIR}/dist" "$APP_DIR/"
fi
if [[ -d "${APP_SOURCE_DIR}/scripts" ]]; then
  cp -a "${APP_SOURCE_DIR}/scripts" "$APP_DIR/"
fi

pushd "$APP_DIR" >/dev/null
if [[ -d "$APP_DIR/src" ]]; then
  npm ci
  npm run build
  npm prune --omit=dev
else
  npm ci --omit=dev
fi
popd >/dev/null

install -d -o backendnode -g backendnode -m 750 "$APP_DIR/log" "$APP_DIR/uploads"
chown -R root:root "$APP_DIR"
chown -R backendnode:backendnode "$APP_DIR/log" "$APP_DIR/uploads"

# 5. Write 0600 production environment file
install -d -o root -g backendnode -m 750 "$ENV_DIR"
{
  printf 'NODE_ENV=production\n'
  printf 'HOST=127.0.0.1\n'
  printf 'SERVER_PORT=3000\n'
  printf 'TRUST_PROXY=%s\n' "$TRUST_PROXY"
  printf 'DB_HOST=%s\n' "$DB_HOST"
  printf 'DB_PORT=%s\n' "$DB_PORT"
  printf 'DB_DATABASE=%s\n' "$DB_DATABASE"
  printf 'DB_USER=%s\n' "$DB_USER"
  printf 'DB_PASSWORD=%s\n' "$DB_PASSWORD"
  printf 'DB_SSL=%s\n' "$DB_SSL"
  if [[ -n "$DB_SSL_CA" ]]; then
    printf 'DB_SSL_CA=%s\n' "$DB_SSL_CA"
  fi
  printf 'JWT_SECRET=%s\n' "$JWT_SECRET"
  printf 'FILES_IN_BD=%s\n' "$FILES_IN_BD"
  printf 'CORS_ORIGINS=%s\n' "$CORS_ORIGINS"
} > "$ENV_FILE"
chown root:backendnode "$ENV_FILE"
chmod 640 "$ENV_FILE"

# 6. Install TLS certificates & optional lab CA
install -d -m 755 /etc/ssl/dima
if [[ -f "${CERTS_DIR}/api.dima.lab.crt" && -f "${CERTS_DIR}/api.dima.lab.key" ]]; then
  install -m 644 "${CERTS_DIR}/api.dima.lab.crt" /etc/ssl/dima/api.dima.lab.crt
  install -m 600 "${CERTS_DIR}/api.dima.lab.key" /etc/ssl/dima/api.dima.lab.key
fi
if [[ -f "${CERTS_DIR}/dima-lab-ca.crt" ]]; then
  install -m 644 "${CERTS_DIR}/dima-lab-ca.crt" /usr/local/share/ca-certificates/dima-lab-ca.crt
  update-ca-certificates
fi

# 7. Install systemd unit & start service
install -m 644 "${SCRIPT_DIR}/backendnode.service" /etc/systemd/system/backendnode.service
systemctl daemon-reload
systemctl enable --now backendnode
systemctl restart backendnode

# 8. Install nginx TLS-only reverse proxy
install -m 644 "${SCRIPT_DIR}/nginx-api.conf" /etc/nginx/sites-available/backendnode
ln -sf /etc/nginx/sites-available/backendnode /etc/nginx/sites-enabled/backendnode
rm -f /etc/nginx/sites-enabled/default
if [[ -f /etc/ssl/dima/api.dima.lab.crt && -f /etc/ssl/dima/api.dima.lab.key ]]; then
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
else
  echo "WARN: /etc/ssl/dima/api.dima.lab.{crt,key} not found yet; skipping nginx reload." >&2
fi

# 9. Strict production firewall: SSH + HTTPS 443 from web (10.10.10.10) only
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow from "$WEB_HOST" to any port 443 proto tcp
ufw --force enable

# 10. Smoke checks
sleep 2
systemctl is-active --quiet backendnode
curl -fsS http://127.0.0.1:3000/health && echo " <- backendnode loopback OK"
if [[ -f /etc/ssl/dima/api.dima.lab.crt ]] && getent hosts api.dima.lab >/dev/null 2>&1; then
  curl -fsS https://api.dima.lab/health && echo " <- nginx TLS OK"
fi
ss -tulpn | grep -E ':(80|443|3000)\b' || true
