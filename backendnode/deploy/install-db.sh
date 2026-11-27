#!/usr/bin/env bash
# Non-interactive, idempotent installer for the Dima "db" server (10.10.10.30).
# Compatible with Debian 12 (bookworm64) and Ubuntu 24.04.
#
# Required secrets (via environment or DEPLOY_ENV_FILE / .env.deploy):
#   DB_ROOT_PASSWORD - MySQL root password
#   DB_APP_PASSWORD  - password for least-privilege app user (dima_app)
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
DPKG_OPTS=(-o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SCHEMA_SQL="${SCHEMA_SQL:-${BACKEND_DIR}/db/SCHEMA.sql}"

# Optional gitignored .env.deploy loader
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${SCRIPT_DIR}/.env.deploy}"
if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
  set +a
fi

validate_secret() {
  local name="$1"
  local value="$2"
  if [[ "$value" =~ [\\\'\"\#[:space:]] ]]; then
    echo "ERROR: ${name} must not contain backslashes, quotes, '#', or whitespace." >&2
    exit 1
  fi
}

if [[ -z "${DB_ROOT_PASSWORD:-}" ]]; then
  echo "ERROR: DB_ROOT_PASSWORD must be set in environment or $DEPLOY_ENV_FILE" >&2
  exit 1
fi
if [[ -z "${DB_APP_PASSWORD:-}" ]]; then
  echo "ERROR: DB_APP_PASSWORD must be set in environment or $DEPLOY_ENV_FILE" >&2
  exit 1
fi
validate_secret "DB_ROOT_PASSWORD" "$DB_ROOT_PASSWORD"
validate_secret "DB_APP_PASSWORD" "$DB_APP_PASSWORD"
if [[ ! -f "$SCHEMA_SQL" ]]; then
  echo "ERROR: SCHEMA.sql not found at $SCHEMA_SQL" >&2
  exit 1
fi

DB_DATABASE="${DB_DATABASE:-mercadolibrenode}"
DB_USER="${DB_USER:-dima_app}"
DB_APP_HOST="${DB_APP_HOST:-10.10.10.20}"
DB_BIND_ADDRESS="${DB_BIND_ADDRESS:-10.10.10.30}"
DB_REQUIRE_SSL="${DB_REQUIRE_SSL:-false}"
MGMT_CIDR="${MGMT_CIDR:-10.10.10.0/24}"

# Validate identifiers and host to prevent SQL injection
if [[ ! "$DB_DATABASE" =~ ^[a-zA-Z0-9_]{1,64}$ ]]; then
  echo "ERROR: Invalid DB_DATABASE identifier" >&2
  exit 1
fi
if [[ ! "$DB_USER" =~ ^[a-zA-Z0-9_]{1,64}$ ]] || [[ "${DB_USER,,}" == "root" ]]; then
  echo "ERROR: Invalid or forbidden DB_USER" >&2
  exit 1
fi
if [[ ! "$DB_APP_HOST" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ && "$DB_APP_HOST" != "localhost" ]]; then
  echo "ERROR: Invalid DB_APP_HOST: $DB_APP_HOST" >&2
  exit 1
fi

# 1. Base packages
apt-get update -y
apt-get install -y "${DPKG_OPTS[@]}" ca-certificates curl gnupg lsb-release ufw

# 2. Install MySQL 8.0 (auto-configuring Oracle MySQL 8.0 APT repo on Debian 12)
# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" == "debian" ]]; then
  if ! dpkg -s mysql-community-server >/dev/null 2>&1 && ! dpkg -s mysql-server >/dev/null 2>&1; then
    CODENAME="${VERSION_CODENAME:-bookworm}"
    curl -fsSL https://repo.mysql.com/RPM-GPG-KEY-mysql-2023 \
      | gpg --dearmor --yes -o /usr/share/keyrings/mysql-apt-archive-keyring.gpg
    printf 'deb [signed-by=/usr/share/keyrings/mysql-apt-archive-keyring.gpg] https://repo.mysql.com/apt/debian/ %s mysql-8.0\n' \
      "$CODENAME" > /etc/apt/sources.list.d/mysql.list
    printf 'mysql-community-server mysql-community-server/root-pass password %s\n' "$DB_ROOT_PASSWORD" | debconf-set-selections
    printf 'mysql-community-server mysql-community-server/re-root-pass password %s\n' "$DB_ROOT_PASSWORD" | debconf-set-selections
    apt-get update -y
    apt-get install -y "${DPKG_OPTS[@]}" mysql-server
  fi
else
  apt-get install -y "${DPKG_OPTS[@]}" mysql-server
fi

# 3. Bind MySQL to private network interface (10.10.10.30) and wait for network-online.target
rm -f /etc/mysql/mysql.conf.d/99-dima.cnf
install -d -m 755 /etc/mysql/mysql.conf.d
{
  printf '[mysqld]\n'
  printf 'bind-address = %s\n' "$DB_BIND_ADDRESS"
  if [[ "$DB_REQUIRE_SSL" == "true" ]]; then
    printf 'require_secure_transport = ON\n'
  fi
} > /etc/mysql/mysql.conf.d/zz-dima.cnf

install -d -m 755 /etc/systemd/system/mysql.service.d
{
  printf '[Unit]\n'
  printf 'Wants=network-online.target\n'
  printf 'After=network-online.target\n'
} > /etc/systemd/system/mysql.service.d/wait-network.conf

systemctl daemon-reload
systemctl enable --now mysql
systemctl restart mysql

# 4. Prepare 0600 credentials file for root client & nightly backups (zero CLI passwords)
install -d -m 700 /etc/dima
BACKUP_CNF="/etc/dima/backup.cnf"
{
  printf '[client]\n'
  printf 'user=root\n'
  printf 'password=%s\n' "$DB_ROOT_PASSWORD"
} > "$BACKUP_CNF"
chmod 600 "$BACKUP_CNF"

# Ensure root accepts password auth if Ubuntu installed auth_socket
if mysql --protocol=socket -u root -e "SELECT 1;" >/dev/null 2>&1; then
  ESCAPED_ROOT_PASS="${DB_ROOT_PASSWORD//\'/\'\'}"
  mysql --protocol=socket -u root -e \
    "ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '${ESCAPED_ROOT_PASS}'; FLUSH PRIVILEGES;"
fi

# 5. Create target database and apply pure-DDL SCHEMA.sql idempotently
mysql --defaults-extra-file="$BACKUP_CNF" -e \
  "CREATE DATABASE IF NOT EXISTS \`${DB_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql --defaults-extra-file="$BACKUP_CNF" "$DB_DATABASE" < "$SCHEMA_SQL"

# 6. Create/update least-privilege DML-only application user
ESCAPED_APP_PASS="${DB_APP_PASSWORD//\'/\'\'}"
SSL_CLAUSE=""
if [[ "$DB_REQUIRE_SSL" == "true" ]]; then
  SSL_CLAUSE=" REQUIRE SSL"
fi
mysql --defaults-extra-file="$BACKUP_CNF" <<SQL
CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_APP_HOST}' IDENTIFIED BY '${ESCAPED_APP_PASS}'${SSL_CLAUSE};
ALTER USER '${DB_USER}'@'${DB_APP_HOST}' IDENTIFIED BY '${ESCAPED_APP_PASS}'${SSL_CLAUSE};
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${DB_USER}'@'${DB_APP_HOST}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_DATABASE}\`.* TO '${DB_USER}'@'${DB_APP_HOST}';
FLUSH PRIVILEGES;
SQL

# 7. Strict production firewall: scoped SSH + MySQL 3306 from api (10.10.10.20) only
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$MGMT_CIDR" to any port 22 proto tcp
if [[ -n "${SSH_CONNECTION:-}" ]]; then
  SSH_PEER_IP="${SSH_CONNECTION%% *}"
  if [[ -n "$SSH_PEER_IP" && "$SSH_PEER_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    ufw allow from "${SSH_PEER_IP}/32" to any port 22 proto tcp
  fi
fi
ufw allow from "$DB_APP_HOST" to any port 3306 proto tcp
ufw --force enable

# 8. Install nightly mysqldump timer and DB_DATABASE drop-in
install -m 755 "${SCRIPT_DIR}/backup-db.sh" /usr/local/bin/backup-db.sh
install -m 644 "${SCRIPT_DIR}/backup-db.service" /etc/systemd/system/backup-db.service
install -d -m 755 /etc/systemd/system/backup-db.service.d
{
  printf '[Service]\n'
  printf 'Environment=DB_DATABASE=%s\n' "$DB_DATABASE"
} > /etc/systemd/system/backup-db.service.d/override.conf
install -m 644 "${SCRIPT_DIR}/backup-db.timer" /etc/systemd/system/backup-db.timer
systemctl daemon-reload
systemctl enable --now backup-db.timer

# 9. Smoke check
systemctl is-active --quiet mysql
systemctl is-active --quiet backup-db.timer
ss -tulpn | grep -E ':3306\b' || true
