# Security Audit — F008 (production-deploy)

| Field | Value |
| :--- | :--- |
| Ticket | `F008-production-deploy` |
| Target | `Frontend` |
| Audited Commit | `1acc3fe` (fixes `785a5c6`, `802b2d9`, `1acc3fe`; first audit at `54bd67e`, ticket commit `87b609d`) |
| Date | `2026-11-27` |
| Verdict | `PASS` (first audit: `CHANGES REQUESTED`) |

Evidence: static source review at `54bd67e` (ticket commit `87b609d`). The .NET SDK is not available in the audit environment, so the build and live checks were not re-run here; the router's live verification in `frontendnet/.routing/PROGRESS.md` (2026-11-26/27) was cross-checked against the code, not accepted on its own. Read: `deploy/Vagrantfile`, `deploy/deploy-all.sh`, `deploy/make-certs.sh`, `deploy/install-web.sh`, `deploy/publish-web.sh`, `deploy/nginx-frontendnet.conf`, `deploy/dima-proxy.conf`, `deploy/frontendnet.service`, `deploy/.gitignore`, `appsettings.Production.json`, cross-checked with `backendnode/deploy/*` and `backendnode/src/db/{seed,bootstrap}.ts` at `54bd67e`. Repo-wide greps over `Controllers/`, `Services/`, `Views/`: no `Html.Raw`, no `async void`, no `IgnoreAntiforgery`, no `Redirect(`/`returnUrl` sinks, every controller carries `[Authorize]` or a deliberate `[AllowAnonymous]`, every numeric id is an `int` route value and the only string path segment (`email`) is built with `Uri.EscapeDataString`.

## Re-Audit — 2026-11-27 @ `1acc3fe`

Evidence: `git diff 54bd67e 1acc3fe -- frontendnet/deploy/` read in full (`deploy-all.sh`, `install-web.sh`, `publish-web.sh`, `nginx-frontendnet.conf`, `frontendnet.service`, `DEPLOY-PLAN.md`), cross-checked against `backendnode/src/db/bootstrap.ts`; live results taken from `changelog.md` (operator-run, see notes).

| Finding | Result |
| :--- | :--- |
| `AUD-F008-01` | `RESOLVED`. `phase_seed` runs `dist/db/bootstrap.js` with no `NODE_ENV` override; `grep 'NODE_ENV=development\|seed.js' deploy-all.sh` → none. `ensure_bootstrap_creds` appends `ADMIN_*`/`USER_*` to the git-ignored, mode-600 `.env.deploy` under `umask 077`, only if missing; they are outside both per-VM allowlists and reach the remote shell over ssh stdin (`read -r` → `export` → `exec node`), so never argv/`ps`/output. `rand_secret` output satisfies `StrongPasswordSchema`, which `bootstrap.ts` re-validates. Live: `gvera@uv.mx`/`patito` and `patito@uv.mx`/`patito` → `401`; old dev users deleted from the lab DB; generated admin signs in. |
| `AUD-F008-02` | `RESOLVED`. `install-web.sh` limits 22/tcp to `MGMT_CIDR` (default `10.10.10.0/24`), the Vagrant management NATs (`192.168.121.0/24` libvirt, `10.0.2.0/24` VirtualBox) and the current ssh peer `/32`; 443 open; 80 closed. `publish-web.sh` and `run_backend_installer` now forward `SSH_CONNECTION` through `sudo`, so the peer rule is actually written. |
| Other changes in scope | Accepted. nginx login/registration throttle relaxed to 30 r/min, burst 20: still a per-IP flood guard, while per-IP (100/15 min, 5 registrations/h) and `ip:email` (10/15 min) limits stay in the backend. `install-web.sh` now fails on health-check errors and sets `/opt/frontendnet` to `755`, root-owned and not writable by the service user. `RestartSec=2` speeds up the reboot test. |

Notes (informational, no action required for closure):
- The live `web` VM was installed before `1acc3fe`. Run `./deploy-all.sh web`, then confirm `sudo ufw status` on `web` and that `vagrant ssh web` still works, so the deployed system matches the audited commit.
- On the live `api` VM, `ufw allow from 192.168.121.0/24 to any port 22` was added by hand. The next `./deploy-all.sh api` resets ufw and depends on the forwarded `SSH_CONNECTION` peer rule (now fixed). Re-check `vagrant ssh api` after any api redeploy.
- `MGMT_CIDR=10.10.10.0/24` lets the three VMs SSH to each other (same as the backend scripts). This is acceptable for the lab; narrow it to the host's address if lateral movement matters.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Cookie & Session Auth | `PASS` | Data Protection keys in `StateDirectory` (0700) with `UMask=0077`; cookies `Secure` in Production. |
| CSRF Protection | `N/A` | No app code. |
| XSS Prevention | `N/A` | No app code. |
| RBAC & Auto-Logout | `N/A` | No app code. |
| JWT Exposure | `PASS` | `ASPNETCORE_ENVIRONMENT=Production` hides the raw JWT on `/Perfil`. |
| Upload & Input Validation | `PASS` | nginx `client_max_body_size 1m`; login/registration POST throttle 10 r/min/IP. |
| Secrets & Config | `PASS` | Generated secrets handled well (`openssl rand`, `umask 077`, per-VM key allowlist, removed on exit, nothing tracked); bootstrap credentials generated and passed over stdin (AUD-F008-01 resolved). |
| Network exposure / TLS | `PASS` | 443 only, port 80 closed, TLS 1.2/1.3, HSTS, `server_tokens off`, Kestrel on `127.0.0.1:5000`; nginx overwrites `X-Forwarded-For`. SSH limited to management CIDRs (AUD-F008-02 resolved). |
| Service hardening | `PASS` | `frontendnet.service`: dedicated user, `NoNewPrivileges`, `ProtectSystem=strict`, empty `CapabilityBoundingSet`, `Restart=always`. |

## Findings

### AUD-F008-01 — `deploy-all.sh seed` installs the course's default credentials as a protected Administrador in production
- **Severity:** `High`
- **Status:** `RESOLVED (802b2d9)`
- **Location:** `frontendnet/deploy/deploy-all.sh` (`phase_seed`, the `env NODE_ENV=development … dist/db/seed.js` call)
- **CWE / OWASP:** `CWE-1392 / CWE-798 / OWASP A07:2021`
- **Issue / Exploit Scenario:** This is the same pattern as `AUD-B011-01`, which was fixed in the backend runbook but copied into the F008 orchestrator. `phase_seed` overrides `NODE_ENV` so the dev seeder runs against the production DB. That creates `gvera@uv.mx` (`Administrador`, `protegido=true`) and `patito@uv.mx`, both with password `patito`, which is published in the course PDF. A protected user cannot be edited or deleted through the API, so anyone who reaches `https://web.dima.lab` can sign in as Administrador. Since `310329e`, `seed.ts` also refuses a non-loopback `DB_HOST`, so against `10.10.10.30` this phase now **fails** and the deployment has no roles, catalog or admin at all. The tempting workaround (`--allow-remote-dev-seed`) would make the vulnerability live.
- **Required Fix:** Replace the call with `dist/db/bootstrap.js` (see `backendnode/deploy/README.md` step 3). Generate `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `USER_EMAIL` and `USER_PASSWORD` in `ensure_env_deploy` with `rand_secret` (it satisfies `StrongPasswordSchema`). Keep them out of the per-VM key allowlist and pass them to the remote process over stdin, never on the command line or in output. Keep the `SEED_MARKER` idempotency.
- **Required Regression Test:** `grep -n 'NODE_ENV=development\|seed.js' frontendnet/deploy/deploy-all.sh` returns nothing. After deploy, `POST /api/auth` with `gvera@uv.mx`/`patito` returns `401`, and the generated admin can sign in.

### AUD-F008-02 — SSH on the `web` VM is open to any source
- **Severity:** `Low`
- **Status:** `RESOLVED (802b2d9, 1acc3fe)`
- **Location:** `frontendnet/deploy/install-web.sh:66` (`ufw allow 22/tcp`)
- **CWE / OWASP:** `CWE-284 / OWASP A05:2021`
- **Issue / Exploit Scenario:** The backend scripts were narrowed to `MGMT_CIDR` in `AUD-B011-07`, but the web VM still accepts SSH from anywhere its interfaces are reachable. This is inconsistent with the rest of the 3-server design and shows up in the rubric's firewall/`netstat` review.
- **Required Fix:** Use the same pattern as `install-db.sh`/`install-api.sh`: `ufw allow from "${MGMT_CIDR:-10.10.10.0/24}" to any port 22 proto tcp`, while making sure the Vagrant management network (libvirt NAT `192.168.121.0/24`) is still allowed so `vagrant ssh` keeps working.
- **Required Regression Test:** `sudo ufw status` on `web` shows 22/tcp limited to the management CIDR(s) and 443/tcp open; `vagrant ssh web` still works.

Note (cross-ticket): step B depends on `AUD-B011-08` (MySQL drop-in ordering) being committed; `deploy-all.sh` deploys `git archive HEAD`, so uncommitted backend fixes are not deployed (the script warns about this).
