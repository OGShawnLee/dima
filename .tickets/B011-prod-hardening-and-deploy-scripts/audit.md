# Security Audit — B011 (prod-hardening-and-deploy-scripts)

| Field | Value |
| :--- | :--- |
| Ticket | `B011-prod-hardening-and-deploy-scripts` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `CHANGES REQUESTED` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 13 test files / 172 tests passed. Source read: `src/config/env.ts`, `src/index.ts`, `src/app.ts`, `src/db/index.ts`, `src/middlewares/{ratelimit,bitacora,errorhandler}.middleware.ts`, all `src/controllers/*.ts`, `db/SCHEMA.sql`, `src/db/seed.ts`, `backendnode/deploy/*`, `.env.example`, root `.gitignore`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Mass Assignment | `N/A` | No new DTOs in this ticket. |
| Auth & RBAC (`401` vs `403`) | `N/A` | Unchanged. |
| JWT Hardening / login rate limit | `FAIL` | Limiter keyed only by `ip:email`, with no per-IP ceiling: one IP can spray unlimited emails or mass-register (AUD-B011-03). |
| Backend-Enforced Business Guards | `N/A` | Unchanged. |
| SQL & Query Safety | `PASS` | `install-db.sh` validates identifiers and host by regex; `setup-db.mjs` uses `mysql.escape`. Password escaping is a Low note (AUD-B011-06). |
| File Upload Hardening | `N/A` | Unchanged. |
| Logging & Error Hygiene / trusted IP (`REQ-004`) | `FAIL` | `bitacora`/`errorhandler` middleware use `req.ip`, but all 6 controllers still pass `request-ip` (spoofable) into every audit row (AUD-B011-02). |
| Audit Trail (`bitacora`) | `FAIL` | Action strings are correct; the IP column is attacker-controlled (AUD-B011-02). |
| Secrets & Repo Hygiene | `FAIL` | Runbook seeds the default `patito` credentials into production by getting around the `seed.ts` guard (AUD-B011-01). `backendnode/deploy/certs/` (TLS private key) is not gitignored (AUD-B011-05). |
| Prod bind / firewall (`REQ-005`) | `PASS` | `HOST` defaults to `127.0.0.1` in production; nginx serves 443 only; ufw limits 443/3306 to the peer VM; systemd unit is well sandboxed (`ProtectSystem=strict`, empty `CapabilityBoundingSet`, `NoNewPrivileges`). |
| Remote DB / deploy correctness (`REQ-006`/`REQ-007`) | `FAIL` | `SCHEMA.sql` hardcodes `mercadolibrenode`; deploy grants, connects and backs up `dima_db` (AUD-B011-04). TLS to DB is off by default (AUD-B011-06). |
| Negative Tests Present | `FAIL` | `prod-hardening.test.ts` tests `extractClientIp` in isolation only. No test checks the IP actually written by a controller, no test checks per-IP limits across different emails, and no test checks the schema/deploy DB name. |

## Findings

### AUD-B011-01 — Deploy runbook gets around the production seed guard and installs a known-password protected admin
- **Severity:** `High`
- **Status:** `OPEN`
- **Location:** `backendnode/deploy/README.md:41-45` (with `backendnode/src/db/seed.ts` `SEED_USERS` / `bcrypt.hash('patito', 10)`)
- **CWE / OWASP:** `CWE-1392 / CWE-798 / OWASP A07:2021`
- **Issue / Exploit Scenario:** Step 3 runs `sudo -u backendnode NODE_ENV=development node --env-file=/etc/backendnode/backendnode.env dist/db/seed.js`. Variables that already exist in the environment take precedence over `--env-file`, and the vagrant sudoers rule (`ALL`) permits command-line env vars. So `assertSeedAllowed` sees `development` and seeds the production DB. That creates `gvera@uv.mx` (`Administrador`, `protegido=true`) and `patito@uv.mx`, both with password `patito`, which is published in the course PDF. Login accepts any password length (`LoginRequestSchema.password.min(1)`). `UsuariosService.update/delete` refuse to touch `protegido` users, and no password-change endpoint exists, so the operator cannot rotate this account through the API. Anyone who reaches the web BFF can log in as Administrador. `|| true` hides any failure. This is currently masked by AUD-B011-04 (the seed would hit an empty DB); it becomes live as soon as that is fixed.
- **Required Fix:** Remove step 3 from the runbook. Add a production bootstrap path that never uses the default credentials. For example, add a `scripts/bootstrap-admin.mjs` (or a `seed.ts --roles-only` mode) that inserts only the `rol` rows plus one admin whose email and password come from `.env.deploy` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, validated with `StrongPasswordSchema`), and call it from `install-api.sh` or `install-db.sh`. Make `seed.ts` refuse to run when `DB_HOST` is not loopback, unless an explicit `--allow-remote-dev-seed` flag is passed. Do not rely on `NODE_ENV` alone.
- **Required Regression Test:** Add a test in `tests/setup.test.ts` that reads `deploy/README.md` and the `deploy/*.sh` files and fails if any of them pass `NODE_ENV=development` to `seed`. Add a unit test that the bootstrap path rejects a weak `ADMIN_PASSWORD` and never writes `patito`.

### AUD-B011-02 — Audit-log IPs are still taken from spoofable `request-ip` headers in every controller (`REQ-004` incomplete)
- **Severity:** `Medium`
- **Status:** `OPEN`
- **Location:** `backendnode/src/controllers/auth.controller.ts:17,28`, `usuarios.controller.ts:22`, `categorias.controller.ts:18`, `productos.controller.ts:20`, `archivos.controller.ts:23`, `pedidos.controller.ts:17`
- **CWE / OWASP:** `CWE-348 / CWE-117 / OWASP A09:2021`
- **Issue / Exploit Scenario:** B011 switched only `bitacora.middleware.ts` and `errorhandler.middleware.ts` to `extractClientIp(req)`. Every service writes `bitacora` with `audit.ip` built in the controller, and those calls use `requestIp.getClientIp(req)`. That function trusts `X-Client-IP`, the leftmost `X-Forwarded-For`, `CF-Connecting-IP` and similar headers unconditionally, whatever `TRUST_PROXY` says. Verified: `getClientIp({headers:{'x-client-ip':'6.6.6.6'}, socket:{remoteAddress:'127.0.0.1'}})` returns `6.6.6.6`. An attacker brute-forcing `POST /api/auth` can therefore make every `usuario.login.fallido` row show any IP. A malicious admin can likewise forge the IP on `usuarios.eliminar` and similar actions, which defeats forensic attribution. `req.bitacora` (the correct path) exists but is never called.
- **Required Fix:** Replace `requestIp.getClientIp(req) ?? 'unknown'` with `extractClientIp(req)` in all 6 controllers. Better, build `AuditContext` in one shared helper, e.g. `buildAuditContext(req)` in `src/middlewares/bitacora.middleware.ts`. Then remove the `request-ip` dependency and its `@types` package from `package.json` so it cannot creep back.
- **Required Regression Test:** Add an integration test through `createApp({ trustProxy: false })`. Send `POST /api/auth` (bad password) with `X-Client-IP: 6.6.6.6` and `X-Forwarded-For: 7.7.7.7`, and assert that the bitacora mock receives the socket IP, not `6.6.6.6` or `7.7.7.7`. Repeat once for one admin mutation (e.g. `POST /api/categorias`). Add a static test that `grep`s `src/` for `request-ip` and expects zero matches.

### AUD-B011-03 — `ip:email` rate-limit key removes the per-IP ceiling: unlimited password spraying and mass registration
- **Severity:** `Medium`
- **Status:** `OPEN`
- **Location:** `backendnode/src/middlewares/ratelimit.middleware.ts:23-33`, `backendnode/src/routes/auth.routes.ts:20-22`
- **CWE / OWASP:** `CWE-307 / CWE-770 / OWASP API4:2023, A07:2021`
- **Issue / Exploit Scenario:** The key is `${ip}:${email}`, so each new email gets a fresh bucket of 10. From one IP an attacker can (a) spray a common password across unlimited known emails on `POST /api/auth`, and (b) create unlimited accounts on `POST /api/auth/registro` by varying the email, which bypasses the B009 registration throttle. Each request costs one bcrypt-10 hash (~45–50 ms CPU), so this is also a cheap CPU-exhaustion vector against the single Node process. The intent (avoid cross-user lockout behind the BFF) is valid, but it needs a second, coarser control.
- **Required Fix:** Keep the `ip:email` limiter and add a second per-IP limiter (key = `extractClientIp(req)` only) in front of it on both routes. Suggested limits: login 100 requests / 15 min / IP; registration 5 / hour / IP, or key registration by IP only and drop the email component. Expose both via `AuthRouterDeps` for tests.
- **Required Regression Test:** Add tests in `tests/prod-hardening.test.ts`: (1) from one IP, send N+1 login attempts each with a different email and expect `429` once the per-IP ceiling is reached; (2) from one IP, register 6 distinct emails and expect the 6th to return `429`; (3) keep the existing alice/bob test so that lockout stays isolated below the ceiling.

### AUD-B011-04 — Database name mismatch: schema goes to `mercadolibrenode`, the app and backups use `dima_db`
- **Severity:** `Medium`
- **Status:** `OPEN`
- **Location:** `backendnode/db/SCHEMA.sql:5,9`; `backendnode/deploy/install-db.sh:39,113,121`; `install-api.sh:40`; `backup-db.sh:8`; `backup-db.service:7`; `.env.example:2`
- **CWE / OWASP:** `CWE-1188 / OWASP A05:2021` (availability and backup integrity)
- **Issue / Exploit Scenario:** `SCHEMA.sql` runs `CREATE DATABASE mercadolibrenode; USE mercadolibrenode;`, so `install-db.sh` builds every table there. It then grants `dima_app` DML only on `dima_db.*`, which is never created. `install-api.sh` writes `DB_DATABASE=dima_db`. As a result, every API query fails (`500`), and `/health` still reports `ok` because it never touches the DB. `mysqldump --databases dima_db` fails nightly under `pipefail`, so REQ-007 backups never contain data. The failure is silent apart from the journal. The likely operator "fix" is to widen grants to `*.*`, which would break least privilege.
- **Required Fix:** Make `SCHEMA.sql` database-agnostic: remove `CREATE DATABASE`/`USE`. In `install-db.sh` run ``CREATE DATABASE IF NOT EXISTS `${DB_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`` and then `mysql --defaults-extra-file=… "${DB_DATABASE}" < SCHEMA.sql`. Apply the same in `scripts/setup-db.mjs` (create the DB, then connect with `database: dbName`). Align the `setup-env.mjs` default and `.env.example` to one name. Make `backup-db.sh` fail loudly if the dump is empty (e.g. check `gzip -l` size or require `SHOW TABLES` > 0).
- **Required Regression Test:** Add a test in `tests/setup.test.ts` asserting that `SCHEMA.sql` contains no `CREATE DATABASE` or `USE` statement. Add a test that `install-db.sh` passes `${DB_DATABASE}` to the `mysql` invocation that loads `SCHEMA.sql`. Add a test that the default `DB_DATABASE` values in `install-db.sh`, `install-api.sh`, `backup-db.service` and `.env.example` are identical.

### AUD-B011-05 — `backendnode/deploy/certs/` (TLS private key) is not gitignored, although the runbook says it is
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** root `.gitignore`; `backendnode/deploy/README.md:25`; `install-api.sh:18`
- **CWE / OWASP:** `CWE-540 / OWASP A05:2021`
- **Issue / Exploit Scenario:** `git check-ignore backendnode/deploy/certs/api.dima.lab.key` returns nothing; only `frontendnet/deploy/certs/` is ignored. A teammate following the runbook and running `git add -A` would commit the API TLS private key.
- **Required Fix:** Add `backendnode/deploy/certs/` (and, to be safe, `*.key`, `*.pem`) to the root `.gitignore`.
- **Required Regression Test:** Add a test in `tests/setup.test.ts` that runs `git check-ignore -q backendnode/deploy/certs/x.key` and expects exit code 0.

### AUD-B011-06 — Weaker-than-needed deploy defaults (plaintext DB link, fragile secret quoting)
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `install-api.sh:42,100-117`; `install-db.sh:43,98-102,107-121`
- **CWE / OWASP:** `CWE-319 / CWE-116`
- **Issue / Exploit Scenario:** (a) `DB_SSL=false` and `DB_REQUIRE_SSL=false` by default, so the app password and all data cross `10.10.10.20→10.10.10.30` in cleartext, and the app user is not created with `REQUIRE SSL`. (b) The SQL password escaping only doubles `'`. MySQL also treats `\` as an escape, so a generated password ending in `\` breaks the statement. Unquoted `printf` into the systemd `EnvironmentFile` and `my.cnf` mangles values containing `"`, `\`, `#` or leading spaces. All inputs are operator-supplied, so these are robustness issues, not an injection path.
- **Required Fix:** Default `DB_SSL=true`/`DB_REQUIRE_SSL=true` once lab certs exist, and add `REQUIRE SSL` to the app user. Reject passwords containing `\`, `'`, `"`, `#` or whitespace up front (e.g. `[[ "$P" =~ ^[A-Za-z0-9._~+=-]{16,}$ ]]`), or generate them with `openssl rand -hex`.
- **Required Regression Test:** Add a static test that `install-db.sh` refuses a `DB_APP_PASSWORD` containing a backslash.

### AUD-B011-07 — SSH open to any source and an unpinned `curl | bash` Node install
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `install-api.sh:59,154`; `install-db.sh:129`
- **CWE / OWASP:** `CWE-494 / OWASP A08:2021`
- **Issue / Exploit Scenario:** `ufw allow 22/tcp` exposes SSH from any network. NodeSource `setup_22.x` is piped to `bash` as root without integrity pinning.
- **Required Fix:** Restrict SSH to the management subnet (`ufw allow from 10.10.10.0/24 to any port 22`, or a `MGMT_CIDR` variable). Install Node from the NodeSource signed APT repo with a pinned keyring (same pattern as the MySQL repo block), not `curl | bash`.
- **Required Regression Test:** Add a static test asserting that the deploy scripts contain no `| bash` and no unrestricted `ufw allow 22/tcp`.
