# Security Audit — F008 (production-deploy)

| Field | Value |
| :--- | :--- |
| Ticket | `F008-production-deploy` |
| Target | `Frontend` |
| Audited Commit | `54bd67e` (ticket commit `87b609d`) |
| Date | `2026-11-27` |
| Verdict | `CHANGES REQUESTED` |

Evidence: static source review at `54bd67e` (ticket commit `87b609d`). The .NET SDK is not available in the audit environment, so the build and live checks were not re-run here; the router's live verification in `frontendnet/.routing/PROGRESS.md` (2026-11-26/27) was cross-checked against the code, not accepted on its own. Read: `deploy/Vagrantfile`, `deploy/deploy-all.sh`, `deploy/make-certs.sh`, `deploy/install-web.sh`, `deploy/publish-web.sh`, `deploy/nginx-frontendnet.conf`, `deploy/dima-proxy.conf`, `deploy/frontendnet.service`, `deploy/.gitignore`, `appsettings.Production.json`, cross-checked with `backendnode/deploy/*` and `backendnode/src/db/{seed,bootstrap}.ts` at `54bd67e`. Repo-wide greps over `Controllers/`, `Services/`, `Views/`: no `Html.Raw`, no `async void`, no `IgnoreAntiforgery`, no `Redirect(`/`returnUrl` sinks, every controller carries `[Authorize]` or a deliberate `[AllowAnonymous]`, every numeric id is an `int` route value and the only string path segment (`email`) is built with `Uri.EscapeDataString`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| Cookie & Session Auth | `PASS` | Data Protection keys in `StateDirectory` (0700) with `UMask=0077`; cookies `Secure` in Production. |
| CSRF Protection | `N/A` | No app code. |
| XSS Prevention | `N/A` | No app code. |
| RBAC & Auto-Logout | `N/A` | No app code. |
| JWT Exposure | `PASS` | `ASPNETCORE_ENVIRONMENT=Production` hides the raw JWT on `/Perfil`. |
| Upload & Input Validation | `PASS` | nginx `client_max_body_size 1m`; login/registration POST throttle 10 r/min/IP. |
| Secrets & Config | `FAIL` | Generated secrets are handled well (`openssl rand`, `umask 077`, per-VM key allowlist, removed on exit, nothing tracked), but `phase_seed` installs the published dev credentials as a protected admin (AUD-F008-01). |
| Network exposure / TLS | `PASS WITH NOTES` | 443 only, port 80 closed, TLS 1.2/1.3, HSTS, `server_tokens off`, Kestrel on `127.0.0.1:5000`; nginx overwrites `X-Forwarded-For`. SSH open from any source on `web` (AUD-F008-02). |
| Service hardening | `PASS` | `frontendnet.service`: dedicated user, `NoNewPrivileges`, `ProtectSystem=strict`, empty `CapabilityBoundingSet`, `Restart=always`. |

## Findings

### AUD-F008-01 — `deploy-all.sh seed` installs the course's default credentials as a protected Administrador in production
- **Severity:** `High`
- **Status:** `OPEN`
- **Location:** `frontendnet/deploy/deploy-all.sh` (`phase_seed`, the `env NODE_ENV=development … dist/db/seed.js` call)
- **CWE / OWASP:** `CWE-1392 / CWE-798 / OWASP A07:2021`
- **Issue / Exploit Scenario:** This is the same pattern as `AUD-B011-01`, which was fixed in the backend runbook but copied into the F008 orchestrator. `phase_seed` overrides `NODE_ENV` so the dev seeder runs against the production DB. That creates `gvera@uv.mx` (`Administrador`, `protegido=true`) and `patito@uv.mx`, both with password `patito`, which is published in the course PDF. A protected user cannot be edited or deleted through the API, so anyone who reaches `https://web.dima.lab` can sign in as Administrador. Since `310329e`, `seed.ts` also refuses a non-loopback `DB_HOST`, so against `10.10.10.30` this phase now **fails** and the deployment has no roles, catalog or admin at all. The tempting workaround (`--allow-remote-dev-seed`) would make the vulnerability live.
- **Required Fix:** Replace the call with `dist/db/bootstrap.js` (see `backendnode/deploy/README.md` step 3). Generate `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `USER_EMAIL` and `USER_PASSWORD` in `ensure_env_deploy` with `rand_secret` (it satisfies `StrongPasswordSchema`). Keep them out of the per-VM key allowlist and pass them to the remote process over stdin, never on the command line or in output. Keep the `SEED_MARKER` idempotency.
- **Required Regression Test:** `grep -n 'NODE_ENV=development\|seed.js' frontendnet/deploy/deploy-all.sh` returns nothing. After deploy, `POST /api/auth` with `gvera@uv.mx`/`patito` returns `401`, and the generated admin can sign in.

### AUD-F008-02 — SSH on the `web` VM is open to any source
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `frontendnet/deploy/install-web.sh:66` (`ufw allow 22/tcp`)
- **CWE / OWASP:** `CWE-284 / OWASP A05:2021`
- **Issue / Exploit Scenario:** The backend scripts were narrowed to `MGMT_CIDR` in `AUD-B011-07`, but the web VM still accepts SSH from anywhere its interfaces are reachable. This is inconsistent with the rest of the 3-server design and shows up in the rubric's firewall/`netstat` review.
- **Required Fix:** Use the same pattern as `install-db.sh`/`install-api.sh`: `ufw allow from "${MGMT_CIDR:-10.10.10.0/24}" to any port 22 proto tcp`, while making sure the Vagrant management network (libvirt NAT `192.168.121.0/24`) is still allowed so `vagrant ssh` keeps working.
- **Required Regression Test:** `sudo ufw status` on `web` shows 22/tcp limited to the management CIDR(s) and 443/tcp open; `vagrant ssh web` still works.

Note (cross-ticket): step B depends on `AUD-B011-08` (MySQL drop-in ordering) being committed; `deploy-all.sh` deploys `git archive HEAD`, so uncommitted backend fixes are not deployed (the script warns about this).
