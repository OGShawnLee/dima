# Dima — Frontend Deployment Plan (3-Server Lab)

> Owner: Frontend Router. Target: **ready by 2026-11-27 13:00 (America/Mexico_City)**.
> Goal: the rubric's top level for *Uso de servidores* — at least 3 server machines (Frontend, Backend, DB), production reverse proxy, apps running as services, firewall — while keeping the local **development** environment working (`dotnet run`, `npm run dev`).

## 1. Topology

```text
 Browser (host 10.10.10.1)
    │ HTTPS 443 only
    ▼
┌──────────────────────────┐   HTTPS 443 (only from web)   ┌──────────────────────────┐   3306 (only from api)   ┌──────────────────┐
│ web  10.10.10.10         │ ────────────────────────────▶ │ api  10.10.10.20         │ ───────────────────────▶ │ db  10.10.10.30  │
│ nginx :443               │                               │ nginx :443               │                          │ MySQL 8.0 :3306  │
│  └─ Kestrel 127.0.0.1:5000│                               │  └─ Node 127.0.0.1:3000   │                          │ app user = DML   │
│ systemd: frontendnet     │                               │ systemd: backendnode     │                          │ systemd: mysql   │
│ ufw: 22, 443             │                               │ ufw: 22, 443 from web    │                          │ ufw: 22, 3306 from api │
└──────────────────────────┘                               └──────────────────────────┘                          └──────────────────┘
```

- Hypervisor: KVM/libvirt via `vagrant-libvirt` on the Ubuntu host ([Vagrantfile](Vagrantfile)). Network `dima-lab` is isolated (no forwarding).
- Names: `web.dima.lab`, `api.dima.lab`, `db.dima.lab` (added to each VM's `/etc/hosts`; add the same 3 lines to the **host** `/etc/hosts`).
- TLS: private lab CA ([make-certs.sh](make-certs.sh)); the CA is trusted by the host browser and by `web` (so the BFF's `HttpClient` validates `api.dima.lab`).
- The browser **never** contacts `api` or `db` ([FDEC-002](../.routing/DECISION.md#fdec-002)).
- Ports 80 and 3000 are closed to the network on every server (rubric).

## 2. Responsibilities

| Server | Owner | Artifacts |
| :--- | :--- | :--- |
| Host + VMs + CA | Frontend (you) | `Vagrantfile`, `make-certs.sh` |
| `web` | Frontend (you) | `publish-web.sh`, `install-web.sh`, `frontendnet.service`, `nginx-frontendnet.conf`, `dima-proxy.conf` |
| `api` | Backend owner | systemd unit, nginx site, `.env` (see §6 reference + BACK-HANDOFF items 4–7) |
| `db` | Backend owner | MySQL install, `SCHEMA.sql`, least-privilege user `'<app>'@'10.10.10.20'`, backups |

## 3. Schedule (Fri 2026-11-27)

| Time | Step |
| :--- | :--- |
| 08:00–08:30 | Phase 0–1: host prerequisites, `vagrant up`, certificates |
| 08:30–09:30 | Phase 2–3 (backend owner): `db` and `api` up; health check from `web` |
| 08:30–09:30 | Phase 4 (you, in parallel): `web` publish + install |
| 09:30–10:30 | Phase 5: end-to-end smoke; fix |
| 10:30–12:00 | Phase 6: rubric tests 1–7 with evidence (screenshots + command output into `.tickets/F008-production-deploy/changelog.md`) |
| 12:00–13:00 | Reboot drill, freeze, tag `v1.0.0`, build ZIP (source + scripts + test accounts) |

**Fallback if the backend owner's servers are late:** run `api` + `db` on one VM temporarily (rubric "Bueno": 2 servers) and split later; never block the frontend demo.

## 4. Phases

### Phase 0 — Host prerequisites (Ubuntu 26.04 host)
```bash
sudo apt install -y dotnet-sdk-10.0        # FDEC-001
dotnet --version                           # 10.x
vagrant plugin list | grep vagrant-libvirt
printf '10.10.10.10 web.dima.lab\n10.10.10.20 api.dima.lab\n10.10.10.30 db.dima.lab\n' | sudo tee -a /etc/hosts
```

### Phase 1 — VMs and certificates
```bash
cd frontendnet/deploy
vagrant up --provider=libvirt              # web, api, db (autostart enabled)
./make-certs.sh                            # -> ./certs (git-ignored)
# Browser: import certs/dima-lab-ca.crt as a trusted Authority (Firefox/Chrome settings)
# Give the backend owner: certs/api.dima.lab.{crt,key} and certs/dima-lab-ca.crt (out of band, never via Git)
```

### Phase 2 — `db` (backend owner, reference)
1. `apt install mysql-server`; `mysql_secure_installation`.
2. `/etc/mysql/mysql.conf.d/mysqld.cnf`: `bind-address = 10.10.10.30`; (optional) `require_secure_transport = ON`.
3. Apply `backendnode/db/SCHEMA.sql`; create `'<DB_USER>'@'10.10.10.20'` with `SELECT, INSERT, UPDATE, DELETE` only (needs BACK-HANDOFF item 5).
4. `ufw default deny incoming; ufw allow 22/tcp; ufw allow from 10.10.10.20 to any port 3306 proto tcp; ufw enable`.
5. Backups: nightly `mysqldump --single-transaction` via `systemd` timer to `/var/backups/dima` (rotation 7 days).

### Phase 3 — `api` (backend owner, reference)
1. Node.js 20+ LTS; `npm ci --omit=dev && npm run build` (or ship `dist/`).
2. `.env` (mode `600`, owner service user): `NODE_ENV=production`, `DB_HOST=10.10.10.30`, `HOST=127.0.0.1` (BACK-HANDOFF item 4), `TRUST_PROXY=<loopback + 10.10.10.10>` (item 3), fresh `JWT_SECRET` from `npm run setup:env`.
3. systemd unit `backendnode.service` (`User=backendnode`, `Restart=always`, `ProtectSystem=strict`, `ReadWritePaths=<app>/log <app>/uploads`), `systemctl enable --now`.
4. nginx `api.dima.lab` on 443 → `http://127.0.0.1:3000` (same pattern as [nginx-frontendnet.conf](nginx-frontendnet.conf)); `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` here (append, so the browser IP sent by `web` is preserved).
5. `ufw allow 22/tcp; ufw allow from 10.10.10.10 to any port 443 proto tcp; ufw enable`.
6. Seed once **before** switching to `NODE_ENV=production` (seeder is blocked in production), or run `npm run db:seed` with `NODE_ENV=development` one time.

### Phase 4 — `web` (you)
Prerequisite: F001–F006 merged on `main` (F007 if ready).
```bash
cd frontendnet/deploy
./publish-web.sh     # dotnet publish (self-contained linux-x64) -> bundle -> vagrant upload -> install-web.sh
```
`install-web.sh` does, idempotently:
1. Installs nginx + ufw; trusts the lab CA (`update-ca-certificates`).
2. Creates system user `frontendnet` (no shell, no home); app in `/opt/frontendnet` owned by root (read-only for the service).
3. Installs and enables [frontendnet.service](frontendnet.service): Kestrel on `127.0.0.1:5000`, `ASPNETCORE_ENVIRONMENT=Production`, Data Protection keys in `/var/lib/frontendnet/keys` (`0700`), systemd sandboxing, `Restart=always`.
4. Installs nginx site: TLS 1.2/1.3, HSTS, `server_tokens off`, login/registration rate limit, `X-Forwarded-For` overwritten with the real client IP, **no port 80 listener**.
5. `ufw`: deny incoming except `22/tcp`, `443/tcp`.
6. Smoke checks (`/health` via Kestrel, via nginx TLS, and API reachability from `web`) and prints listening sockets.
7. Deletes the uploaded bundle (contains the TLS key).

Redeploy after a fix = run `./publish-web.sh` again (≈ 1 min).

### Phase 5 — End-to-end smoke
From the host browser at `https://web.dima.lab`: login admin → CRUD a category, upload an image, create a product with cover → login Usuario → add to cart → checkout (F007) → admin sees the order → Bitácora shows actions with the browser IP.

### Phase 6 — Rubric evidence
Run every item of [F008 spec](../../.tickets/F008-production-deploy/spec.md). Key commands:
```bash
vagrant ssh web -c "sudo ss -tulpn"                         # test 7 (also on api, db)
vagrant ssh web -c "sudo ufw status verbose"
curl -I http://web.dima.lab                                  # must fail (80 closed)
curl -I https://api.dima.lab                                 # must fail from host (only web allowed)
nc -zv 10.10.10.30 3306                                      # must fail from host
curl -sI https://web.dima.lab | grep -iE 'strict-transport|content-security|x-frame|server'
sudo virsh reboot deploy_web; sudo virsh reboot deploy_api; sudo virsh reboot deploy_db   # test 5 (domain names: `virsh list`)
```
Test 6 (JWT refresh): log in, wait until `/Perfil` shows < 5:00 remaining, navigate → `Set-Cookie` re-issued and the timer resets to ~20:00.

## 5. Development environment (kept for the rubric)
- Backend: `cd backendnode && npm run dev` (`http://localhost:3000`).
- Frontend: `cd frontendnet && dotnet run --launch-profile https` (`https://localhost:8443`), `appsettings.Development.json` → `UrlWebAPI=http://localhost:3000`.

## 6. Rollback
- App: keep the previous bundle tarball on the host; re-run `install-web.sh` with it.
- VM: `vagrant snapshot save web pre-deploy` before Phase 4; `vagrant snapshot restore web pre-deploy` if needed (same for `api`/`db`).

## 7. Known risks
| Risk | Mitigation |
| :--- | :--- |
| Backend cannot bind to `127.0.0.1` / use remote DB yet | BACK-HANDOFF items 4–5; fallback: ufw blocks 3000 from everything except loopback |
| Login rate limiter locks everyone (all requests come from `web`) | FDEC-006 + BACK-HANDOFF item 3 |
| Lab CA not trusted → `HttpClient` TLS errors | `install-web.sh` step 2; verify `curl https://api.dima.lab/health` on `web` |
| `cloud-image/ubuntu-24.04` box not available offline | `DIMA_BOX=<your cached box> vagrant up` |
| Antiforgery/cookies break behind proxy | `UseForwardedHeaders` + `X-Forwarded-Proto` (F001) |
