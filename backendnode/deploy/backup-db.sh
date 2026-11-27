#!/usr/bin/env bash
# Nightly MySQL backup script for Dima (run via backup-db.timer).
# Reads credentials from /etc/dima/backup.cnf (mode 0600) — zero CLI passwords.
set -euo pipefail
umask 077

BACKUP_CNF="${BACKUP_CNF:-/etc/dima/backup.cnf}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dima}"
DB_DATABASE="${DB_DATABASE:-mercadolibrenode}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

if [[ ! -f "$BACKUP_CNF" ]]; then
  echo "ERROR: Missing credentials file $BACKUP_CNF" >&2
  exit 1
fi

TABLE_COUNT="$(mysql --defaults-extra-file="$BACKUP_CNF" -Nse "SHOW TABLES FROM \`${DB_DATABASE}\`;" | wc -l)"
if [[ "${TABLE_COUNT:-0}" -le 0 ]]; then
  echo "ERROR: Database ${DB_DATABASE} has 0 tables; refusing to write empty backup." >&2
  exit 1
fi

install -d -m 700 "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${DB_DATABASE}-${TIMESTAMP}.sql.gz"

cleanup_partial() {
  rm -f "$BACKUP_FILE"
}
trap cleanup_partial ERR

mysqldump \
  --defaults-extra-file="$BACKUP_CNF" \
  --single-transaction \
  --routines \
  --triggers \
  --databases "$DB_DATABASE" | gzip -c > "$BACKUP_FILE"

gzip -t "$BACKUP_FILE"
if [[ "$(gzip -dc "$BACKUP_FILE" | wc -c)" -le 0 ]]; then
  echo "ERROR: Backup archive $BACKUP_FILE has empty payload." >&2
  exit 1
fi

trap - ERR
chmod 600 "$BACKUP_FILE"

# Prune backups older than RETENTION_DAYS days
find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
