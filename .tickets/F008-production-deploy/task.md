# F008 — Production Hardening & 3-Server Deployment

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F008` | step A `implemented`, step B `draft` | Strong model, **Supervised** permission mode (touches VMs and the host) | Front/Ops | [spec.md](spec.md) |

## Items addressed
- [FDEC-003](../../frontendnet/.routing/DECISION.md#fdec-003); rubric "Uso de servidores", "Seguridad", "Pruebas solicitadas" 1–7.
- Backend deliverables `B011` (`backendnode/deploy/`: `install-db.sh`, `install-api.sh`, `backendnode.service`, `nginx-api.conf`, `backup-db.*`) and the backend advisory in `.routing/FRONT-HANDOFF.md` (2026-11-26): `debian/bookworm64` + `virtualbox` provider, light VM sizing, `db` bootable alone, non-interactive `apt` options, one-way `file` provisioning.
- Full procedure: [frontendnet/deploy/DEPLOY-PLAN.md](../../frontendnet/deploy/DEPLOY-PLAN.md).
- Application-code hardening found during F001–F007 is **not** in this ticket: see [F009](../F009-app-hardening/task.md).

## Scope

### May create or edit
- `frontendnet/deploy/**` (Vagrantfile, DEPLOY-PLAN.md, `make-certs.sh`, `publish-web.sh`, `install-web.sh`, `frontendnet.service`, `nginx-frontendnet.conf`, `dima-proxy.conf`, new helper scripts)
- `frontendnet/deploy/.gitignore` (must ignore `certs/`, `out/`, `.env.deploy`, `.vagrant/`)
- `frontendnet/appsettings.Production.json`
- `.tickets/F008-production-deploy/changelog.md`

### Must not touch
- Application code (`frontendnet/Controllers|Models|Services|Views|Middlewares|Program.cs` — F009 owns it), `backendnode/**` (consume `backendnode/deploy/*` as-is; file problems in `frontendnet/.routing/BACK-HANDOFF.md` via the router), root `.routing/**`, `frontendnet/.routing/**`, any `audit.md`.

## Steps

### A. Reconcile deploy files (worktree, no VMs yet)
1. Bring in the lighter cross-provider Vagrantfile and DEPLOY-PLAN changes from local branch `chore/vagrant-light-f007` (commit `1c38d2c`, files under `frontendnet/deploy/` only — **not** its `PROGRESS.md` / F007 `task.md` edits): `debian/bookworm64` default, libvirt + virtualbox blocks, `web` 1024 / `api` 768 / `db` 1024 MB, 1 vCPU, `DIMA_*` overrides, `--force-confdef/--force-confold`.
2. Make VMs independent of the checkout path: `lv.default_prefix = "dima_"` and document `VAGRANT_DOTFILE_PATH=$HOME/.local/share/dima-vagrant` so worktree cleanup never orphans VMs.
3. Wire the backend scripts: a host-side `deploy-all.sh` (or documented sequence) that runs, in order, `make-certs.sh` → `vagrant up` → upload + `install-db.sh` on `db` → upload + `install-api.sh` on `api` → seed once → `publish-web.sh`. Secrets come only from a gitignored `backendnode/deploy/.env.deploy` generated locally with random values (`openssl rand`); never print them, never commit them.
4. `appsettings.Production.json`: no secrets; `UrlWebAPI=https://api.dima.lab`; logging levels suitable for production.
5. Commit step A alone; the router verifies and merges it before step B.

### B. Deploy and collect evidence (from the merged `main`, Supervised)
6. Run the sequence from step 3 on the host (KVM/libvirt) with **`DIMA_BOX=cloud-image/ubuntu-24.04`** (user decision 2026-11-26: cached on this host, supported by `install-db.sh` / `install-api.sh`). The Vagrantfile default stays `debian/bookworm64` for teammates on VirtualBox.
7. Host steps that need the user: `/etc/hosts` entries (sudo) and importing `certs/dima-lab-ca.crt` into the browser — prepare the exact commands and hand them to the router; do not run sudo on the host.
8. Run every check in [spec.md](spec.md) and record command output in `changelog.md` (screenshots referenced by path, not committed if they show secrets).

## Done when
[spec.md](spec.md) passes on the deployed servers and the router has re-run the topology, service and rubric-7 checks.
