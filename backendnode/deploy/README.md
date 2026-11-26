# Dima Backend Deployment Runbook (`backendnode/deploy/`)

This directory contains hardened, non-interactive, idempotent deployment templates for the `db` (`10.10.10.30`) and `api` (`10.10.10.20`) servers. Both `install-db.sh` and `install-api.sh` support **Debian 12 (`bookworm64`)** (auto-configuring the Oracle MySQL 8.0 APT repository and NodeSource Node 22 LTS) and **Ubuntu 24.04**.

---

## 1. Full 3-VM Production Deployment (`web` → `api` → `db`)

### Prerequisites
1. Bring up the 3 VMs and generate lab TLS certificates from `frontendnet/deploy/`:
   ```bash
   cd frontendnet/deploy
   vagrant up --provider=libvirt
   ./make-certs.sh
   ```
2. Create a gitignored `backendnode/deploy/.env.deploy` (never commit this file) with your generated secrets:
   ```bash
   DB_ROOT_PASSWORD=<strong-root-password>
   DB_APP_PASSWORD=<strong-app-password>
   DB_PASSWORD=<same-strong-app-password>
   JWT_SECRET=<70-char-hex-from-npm-run-setup-env>
   DB_DATABASE=dima_db
   DB_USER=dima_app
   ```
3. Copy `frontendnet/deploy/certs/api.dima.lab.{crt,key}` and `dima-lab-ca.crt` into `backendnode/deploy/certs/` (gitignored).

### One-Command Provisioning per VM

**1. Provision `db` (`10.10.10.30`):**
```bash
vagrant upload backendnode /tmp/backendnode db
vagrant ssh db -c "sudo bash /tmp/backendnode/deploy/install-db.sh"
```

**2. Provision `api` (`10.10.10.20`):**
```bash
vagrant upload backendnode /tmp/backendnode api
vagrant ssh api -c "sudo bash /tmp/backendnode/deploy/install-api.sh"
```

**3. Seed once (only before production traffic, while `NODE_ENV=development`):**
```bash
vagrant ssh api -c "sudo -u backendnode NODE_ENV=development node --env-file=/etc/backendnode/backendnode.env /opt/backendnode/dist/db/seed.js || true"
```
*(Or run `npm run db:seed` from a temporary dev shell before locking `NODE_ENV=production`.)*

### Production Firewall & Bind Defaults
- **`db` (`10.10.10.30`)**: `mysqld` binds to `10.10.10.30:3306`; `ufw` allows `22/tcp` and `3306/tcp` **only from `10.10.10.20` (`api`)**.
- **`api` (`10.10.10.20`)**: `backendnode` binds to `127.0.0.1:3000` (`HOST=127.0.0.1`); `nginx` listens on `443` only (no port `80`); `ufw` allows `22/tcp` and `443/tcp` **only from `10.10.10.10` (`web`)**.
- **Nightly backups**: `backup-db.timer` runs `backup-db.sh` daily at `02:00`, storing `0600` `.sql.gz` dumps in `/var/backups/dima` with 7-day retention using `/etc/dima/backup.cnf` (`0600`).

---

## 2. Lightweight Windows Single-VM `db` Dev Workflow

On low-RAM Windows hosts, you can run only the `db` VM (`~1 GB` RAM on `debian/bookworm64` at `10.10.10.30`) while running `backendnode` (`npm run dev`) natively on Windows:

1. Boot only `db`:
   ```powershell
   cd frontendnet\deploy
   vagrant up db
   ```
2. Provision `db` with `install-db.sh`, temporarily granting access to the Windows host gateway (`10.10.10.1`):
   ```bash
   vagrant ssh db -c "sudo DB_APP_HOST=10.10.10.1 bash /tmp/backendnode/deploy/install-db.sh"
   ```
3. In `backendnode/.env`, set:
   ```env
   DB_HOST=10.10.10.30
   DB_USER=dima_app
   DB_PASSWORD=<your-app-password>
   NODE_ENV=development
   HOST=0.0.0.0
   ```
   Then run `npm run db:seed` and `npm run dev` on Windows.

### Pre-Grading Cleanup (Mandatory Before Final 3-VM Demo)
Before final 3-VM grading, remove the temporary `10.10.10.1` grant and firewall rule so only `10.10.10.20` (`api`) can reach `3306`:
```bash
vagrant ssh db -c "sudo mysql --defaults-extra-file=/etc/dima/backup.cnf -e \"DROP USER IF EXISTS 'dima_app'@'10.10.10.1'; FLUSH PRIVILEGES;\""
vagrant ssh db -c "sudo ufw delete allow from 10.10.10.1 to any port 3306 proto tcp || true"
vagrant ssh db -c "sudo bash /tmp/backendnode/deploy/install-db.sh"
```
