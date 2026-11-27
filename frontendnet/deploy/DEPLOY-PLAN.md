# Dima — Deployment Plan (3-Server Lab)

> Owner: Frontend Router (ticket [F008](../../.tickets/F008-production-deploy/task.md)). Target: **ready by 2026-11-27 13:00 (America/Mexico_City)**.
> Goal: the rubric's top level for *Uso de servidores* — at least 3 server machines (Frontend, Backend, DB), production reverse proxy, apps running as services, firewall — while keeping the local **development** environment working (`dotnet run`, `npm run dev`).

## 1. Topology

```text
 Browser (host 10.10.10.1)
    │ HTTPS 443 only
    ▼
┌───────────────────────────┐  HTTPS 443 (only from web)  ┌───────────────────────────┐  3306 (only from api)  ┌────────────────────────┐
│ web  10.10.10.10          │ ──────────────────────────▶ │ api  10.10.10.20          │ ─────────────────────▶ │ db  10.10.10.30        │
│ nginx :443                │                             │ nginx :443                │                        │ MySQL 8.0 :3306        │
│  └─ Kestrel 127.0.0.1:5000│                             │  └─ Node 127.0.0.1:3000   │                        │ app user = DML only    │
│ systemd: frontendnet      │                             │ systemd: backendnode      │                        │ systemd: mysql, backup │
│ ufw: 22, 443              │                             │ ufw: 22, 443 from web     │                        │ ufw: 22, 3306 from api │
└───────────────────────────┘                             └───────────────────────────┘                        └────────────────────────┘
```

- Hypervisor: KVM/libvirt (Linux) or VirtualBox (Windows) via [Vagrantfile](Vagrantfile). Default box `debian/bookworm64` (teammates on VirtualBox); **this host uses `DIMA_BOX=cloud-image/ubuntu-24.04`** (cached, supported by every install script). ~2.8 GB RAM for all 3 VMs (web 1024 / api 768 / db 1024 MB, 1 vCPU each); `vagrant up db` alone ≈ 1 GB for daily dev. Network `dima-lab` is isolated (no forwarding); the VMs reach the Internet for `apt`/`npm` through the Vagrant management NAT.
- **Vagrant state lives outside the repository**: `VAGRANT_DOTFILE_PATH=$HOME/.local/share/dima-vagrant` (default in `deploy-all.sh` and `publish-web.sh`; export it in your shell for manual `vagrant` commands). libvirt domains are named `dima_web`, `dima_api`, `dima_db` (`lv.default_prefix = "dima_"`), VirtualBox VMs `dima-web|api|db`. Deleting a worktree/checkout therefore never orphans the VMs; any checkout with the same `VAGRANT_DOTFILE_PATH` manages them.
- Names: `web.dima.lab`, `api.dima.lab`, `db.dima.lab` (added to each VM's `/etc/hosts` by the Vagrantfile; add them to the **host** `/etc/hosts`, §4 step H1).
- TLS: private lab CA ([make-certs.sh](make-certs.sh)); trusted by the host browser (step H2) and by `web` and `api` (installed by the scripts), so the BFF's `HttpClient` validates `api.dima.lab`.
- The browser **never** contacts `api` or `db` ([FDEC-002](../.routing/DECISION.md#fdec-002)).
- Ports 80 and 3000 are closed to the network on every server (rubric).

## 2. Responsibilities

| Server | Owner | Artifacts |
| :--- | :--- | :--- |
| Host + VMs + CA + orchestration | Frontend | `Vagrantfile`, `make-certs.sh`, `deploy-all.sh` |
| `web` | Frontend | `publish-web.sh`, `install-web.sh`, `frontendnet.service`, `nginx-frontendnet.conf`, `dima-proxy.conf` |
| `api` | Backend owner | `backendnode/deploy/install-api.sh` (+ `backendnode.service`, `nginx-api.conf`) — see `backendnode/deploy/README.md` |
| `db` | Backend owner | `backendnode/deploy/install-db.sh` (+ `backup-db.{sh,service,timer}`) |

`deploy-all.sh` consumes the backend scripts **as they are** (never edits them); problems are reported to the backend via the router.

## 3. Secrets and certificates (never in Git)

| Item | Where | Created by |
| :--- | :--- | :--- |
| `backendnode/deploy/.env.deploy` (`DB_ROOT_PASSWORD`, `DB_APP_PASSWORD`, `DB_PASSWORD`, `JWT_SECRET`, `DB_DATABASE=mercadolibrenode`, `DB_USER=dima_app`) | host, mode `600`, ignored by the root `.env.*` rule | `deploy-all.sh` (only if missing; `openssl rand`; never printed) |
| Lab CA + `web`/`api` certs and keys | `frontendnet/deploy/certs/` (ignored), keys `600` | `make-certs.sh` (keeps existing certs; `DIMA_RENEW_CERTS=1` re-issues leaf certs) |

- Each VM receives only what it needs: `db` gets `DB_ROOT_PASSWORD`, `DB_APP_PASSWORD`, `DB_DATABASE`, `DB_USER`; `api` gets `DB_PASSWORD`, `JWT_SECRET`, `DB_DATABASE`, `DB_USER` + `api.dima.lab.{crt,key}` + CA; `web` gets `web.dima.lab.{crt,key}` + CA (the BFF itself needs no secret).
- Upload path: private temp dir on the host **outside the repo** → `/tmp/dima-upload-<vm>` (`0700`) → extracted as root into `/tmp/dima-backend` or `/tmp/dima-bundle` (`0700`) → installer runs → both deleted on every exit path (trap).
- **Do not** copy keys into `backendnode/deploy/certs/` as `backendnode/deploy/README.md` suggests: that directory is **not** git-ignored. `deploy-all.sh` places the api certs straight into the uploaded bundle instead.
- The backend tree is taken from the committed `HEAD` (`git archive`), so `node_modules/`, a developer `.env`, logs and uploads never leave the host.

## 4. Sequence

### Phase 0 — Host prerequisites (Ubuntu host, once)
```bash
dotnet --version                              # 10.x (FDEC-001)
vagrant plugin list | grep vagrant-libvirt
vagrant box list | grep cloud-image/ubuntu-24.04
command -v openssl git tar
```

### Phases 1–6 — automated: [deploy-all.sh](deploy-all.sh)
```bash
export VAGRANT_DOTFILE_PATH="$HOME/.local/share/dima-vagrant"
export DIMA_BOX=cloud-image/ubuntu-24.04      # this host; omit for debian/bookworm64
cd frontendnet/deploy
./deploy-all.sh all                           # = certs, up, db, api, seed, web (in this order)
```
Each phase is idempotent and can be re-run alone: `./deploy-all.sh certs|up|db|api|seed|web`.

| Phase | What runs | Result |
| :--- | :--- | :--- |
| `certs` | `make-certs.sh certs` | CA + `web.dima.lab` / `api.dima.lab` certs in `certs/` |
| `up` | `vagrant up --provider=${DIMA_PROVIDER:-libvirt}` | 3 VMs, `/etc/hosts`, timezone, `apt upgrade`, `ufw`, `unattended-upgrades` (libvirt autostart on) |
| `db` | `install-db.sh` on `db` | MySQL 8.0 bound to `10.10.10.30`, `SCHEMA.sql`, `'dima_app'@'10.10.10.20'` with `SELECT, INSERT, UPDATE, DELETE` only, root password in `/etc/dima/backup.cnf` (`600`), ufw `22` + `3306` from `api`, `backup-db.timer` (02:00, 7 days, `/var/backups/dima`). `deploy-all.sh` adds a `backup-db.service` drop-in with `DB_DATABASE=mercadolibrenode` (workaround, see F008 changelog) |
| `api` | `install-api.sh` on `api` | Node 22, `npm ci && npm run build`, `/opt/backendnode` (root-owned), `/etc/backendnode/backendnode.env` (`640 root:backendnode`, `NODE_ENV=production`, `HOST=127.0.0.1`, `TRUST_PROXY=loopback,10.10.10.10`, `CORS_ORIGINS=https://web.dima.lab`), `backendnode.service`, nginx 443 → `127.0.0.1:3000`, ufw `22` + `443` from `web` |
| `seed` | `node --env-file=/etc/backendnode/backendnode.env dist/db/bootstrap.js` as `backendnode` (production env, no `NODE_ENV` override); `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`USER_EMAIL`/`USER_PASSWORD` are generated into the git-ignored `backendnode/deploy/.env.deploy` (`600`) and passed over ssh stdin only | roles, a generated admin (`admin@dima.lab`) and usuario (`usuario@dima.lab`), 15 categories/products; no default course credentials (AUD-F008-01). Runs **once** (marker `/var/lib/dima-deploy/seeded` on `api`; `DIMA_RESEED=1` forces it, re-applies the generated credentials and upserts the catalog) |
| `web` | `publish-web.sh` → `install-web.sh` on `web` | see below |

`install-web.sh` does, idempotently (Debian 12 and Ubuntu 24.04):
1. `apt-get update`; installs nginx, ufw, curl and the distro ICU (`libicu72` / `libicu74`, required by the self-contained .NET app); trusts the lab CA (`update-ca-certificates`).
2. System user `frontendnet` (no shell, no home); app in `/opt/frontendnet`, owned by root (read-only for the service).
3. [frontendnet.service](frontendnet.service): Kestrel on `127.0.0.1:5000`, `ASPNETCORE_ENVIRONMENT=Production`, Data Protection keys in `/var/lib/frontendnet/keys` (`StateDirectory` `0700` + `UMask=0077`), systemd sandboxing, `Restart=always`, enabled at boot.
4. nginx site ([nginx-frontendnet.conf](nginx-frontendnet.conf) + [dima-proxy.conf](dima-proxy.conf)): TLS 1.2/1.3, HSTS and `nosniff` (nginx only), CSP / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy` from the app's `SecurityHeadersMiddleware` only (no duplicates), `server_tokens off`, POST rate limit on `/Auth` and `/Registro`, `X-Forwarded-For` **overwritten** with `$remote_addr`, distro default site removed → **no port 80 listener**.
5. ufw: deny incoming except `22/tcp`, `443/tcp`.
6. Smoke checks: `/health` via Kestrel, via nginx TLS, and `https://api.dima.lab/health` from `web` (fails the run if `api` is not ready).
7. Deletes the uploaded bundle (it contains the TLS key) on every exit path.

Redeploy after a frontend fix: `./deploy-all.sh web` (≈ 1–2 min). Backend fix (committed): `./deploy-all.sh api`.

### Host steps that need you (sudo / browser — not automated)
**H1. `/etc/hosts`** (idempotent):
```bash
grep -q '^10.10.10.10 web.dima.lab' /etc/hosts || \
  printf '10.10.10.10 web.dima.lab\n10.10.10.20 api.dima.lab\n10.10.10.30 db.dima.lab\n' | sudo tee -a /etc/hosts
```
**H2. Trust the lab CA in the browser** (file: `frontendnet/deploy/certs/dima-lab-ca.crt`):
- Firefox: *Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import…* → select the file → tick *Trust this CA to identify websites*.
- Chrome/Chromium (Linux, NSS store):
  ```bash
  sudo apt install -y libnss3-tools
  certutil -d "sql:$HOME/.pki/nssdb" -A -t "C,," -n "Dima Lab CA" -i frontendnet/deploy/certs/dima-lab-ca.crt
  ```
  Restart the browser, then open `https://web.dima.lab`.

### Phase 7 — End-to-end smoke
From the host browser at `https://web.dima.lab`: login admin → CRUD a category, upload an image, create a product with cover → login Usuario (or self-register) → add to cart → checkout → Mis pedidos → admin sees the order → Bitácora shows actions with the browser IP.

### Phase 8 — Rubric evidence
Run every item of [F008 spec](../../.tickets/F008-production-deploy/spec.md). Key commands (with `VAGRANT_DOTFILE_PATH` exported, from `frontendnet/deploy/`):
```bash
vagrant ssh web -c "sudo ss -tulpn"                         # test 7 (also on api, db)
vagrant ssh web -c "sudo ufw status verbose"
curl -I http://web.dima.lab                                  # must fail (80 closed)
curl -kI https://api.dima.lab                                # must fail from host (only web allowed)
nc -zv 10.10.10.30 3306                                      # must fail from host
curl -sI https://web.dima.lab | grep -iE 'strict-transport|content-security|x-frame|server'
vagrant ssh db -c "sudo systemctl start backup-db.service && sudo ls -l /var/backups/dima"
vagrant reload web api db                                    # test 5 (or: virsh -c qemu:///system reboot dima_web …)
```
Test 6 (JWT refresh): log in, wait until `/Perfil` shows < 5:00 remaining, navigate → `Set-Cookie` re-issued and the timer resets to ~20:00.

## 5. Development environment (kept for the rubric)
- Backend: `cd backendnode && npm run dev` (`http://localhost:3000`).
- Frontend: `cd frontendnet && dotnet run --launch-profile https` (`https://localhost:8443`), `appsettings.Development.json` → `UrlWebAPI=http://localhost:3000`.
- Light DB-only VM: `vagrant up db` + `backendnode/deploy/README.md` §2.

## 6. Rollback
- VM snapshots before risky changes: `vagrant snapshot save web pre-deploy` / `vagrant snapshot restore web pre-deploy` (same for `api`/`db`).
- App: check out the previous commit and re-run `./deploy-all.sh web` (or `api`).

## 7. Known risks
| Risk | Mitigation |
| :--- | :--- |
| Login rate limiter locks everyone (all requests come from `web`) | FDEC-006 + DEC-016 (`TRUST_PROXY=loopback,10.10.10.10`, `${ip}:${email}` key) |
| Lab CA not trusted → `HttpClient` TLS errors | `install-web.sh` trusts the CA and fails its smoke check if `https://api.dima.lab/health` is unreachable |
| Box not cached / slow download | `DIMA_BOX=<your cached box>` (any Debian 12 / Ubuntu 24.04 box) |
| VMs need Internet during install (`apt`, NodeSource, MySQL APT repo on Debian, `npm ci`, `dotnet publish` on the host) | Run the deploy while online; re-runs are idempotent |
| MySQL bound to `10.10.10.30` may start before the interface is up after a reboot | Verify `systemctl is-active mysql` after the reboot drill (reported to backend) |
| Antiforgery/cookies break behind proxy | `UseForwardedHeaders` (loopback only) + `X-Forwarded-Proto` (F001) |
