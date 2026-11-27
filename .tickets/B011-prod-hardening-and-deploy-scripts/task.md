# B011 — Production Hardening, Remote DB Setup & Deploy Templates (`REQ-004`–`REQ-007`)

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B011` | `changes-requested` | `Gemini 4 Hydrogen (Medium)` | `Shared` | Production runtime (`env`, `app`, `index`, `ratelimit`, `bitacora`, `errorhandler`), controllers audit IP, `bootstrap`/`seed`, `SCHEMA.sql`, `setup-db`, `backendnode/deploy/`, root `.gitignore` | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-016` (`REQ-004`) — Upgrade `TRUST_PROXY` to support `'false'`, `'true'`, hop count, or comma-separated Express trust list (e.g., `'loopback,10.10.10.10'`). Use `req.ip` (respecting Express `trust proxy` instead of blind `request-ip` header trust) in `bitacora`, `errorhandler`, and `createAuthRateLimiter`, and key the auth rate limiter by `${ip}:${normalizedEmail}` so one user behind the BFF cannot lock out all other users.
- `DEC-016` (`REQ-005`) — Add `HOST` env var (default `'127.0.0.1'` when `NODE_ENV === 'production'`, `'0.0.0.0'` otherwise) and bind `app.listen(appEnv.SERVER_PORT, appEnv.HOST, ...)` so port `3000` is closed to non-loopback traffic in production.
- `DEC-017` (`REQ-006`) — Extend `scripts/setup-db.mjs` with validated `DB_APP_HOST` (allowing `localhost`, `127.0.0.1`, or private IPv4 like `10.10.10.20`, still blocking `root` and granting DML-only `SELECT, INSERT, UPDATE, DELETE`) and add optional `DB_SSL` (`'true'|'false'`) + `DB_SSL_CA` in `env.ts` & `src/db/index.ts`.
- `DEC-017` (`REQ-007`) — Add hardened `api` and `db` deployment templates under `backendnode/deploy/` (`backendnode.service`, `nginx-api.conf`, `install-api.sh`, `install-db.sh`, `backup-db.sh`, `backup-db.service`, `backup-db.timer`) matching `frontendnet/deploy/DEPLOY-PLAN.md` Phases 2–3.

## Scope

### May create or edit
- `.gitignore`
- `backendnode/.env.example`
- `backendnode/package.json`
- `backendnode/package-lock.json`
- `backendnode/db/SCHEMA.sql`
- `backendnode/src/config/env.ts`
- `backendnode/src/db/index.ts`
- `backendnode/src/db/seed.ts`
- `backendnode/src/db/bootstrap.ts`
- `backendnode/src/middlewares/ratelimit.middleware.ts`
- `backendnode/src/middlewares/errorhandler.middleware.ts`
- `backendnode/src/middlewares/bitacora.middleware.ts`
- `backendnode/src/routes/auth.routes.ts`
- `backendnode/src/controllers/auth.controller.ts`
- `backendnode/src/controllers/usuarios.controller.ts`
- `backendnode/src/controllers/categorias.controller.ts`
- `backendnode/src/controllers/productos.controller.ts`
- `backendnode/src/controllers/archivos.controller.ts`
- `backendnode/src/controllers/pedidos.controller.ts`
- `backendnode/src/app.ts`
- `backendnode/src/index.ts`
- `backendnode/scripts/setup-db.mjs`
- `backendnode/scripts/setup-env.mjs`
- `backendnode/README.md`
- `backendnode/deploy/backendnode.service`
- `backendnode/deploy/nginx-api.conf`
- `backendnode/deploy/install-api.sh`
- `backendnode/deploy/install-db.sh`
- `backendnode/deploy/backup-db.sh`
- `backendnode/deploy/backup-db.service`
- `backendnode/deploy/backup-db.timer`
- `backendnode/deploy/README.md`
- `backendnode/tests/prod-hardening.test.ts`
- `backendnode/tests/setup.test.ts`
- `backendnode/tests/db.test.ts`
- `backendnode/tests/auth.test.ts`
- `.tickets/B011-prod-hardening-and-deploy-scripts/changelog.md`

### Must not touch
- `backendnode/src/db/schema.ts`, `backendnode/src/config/openapi.ts`
- Any domain `schemas/` or `services/` files (except reading them)
- `.routing/**`, `.gemini/**`, `frontendnet/**`
- Any other `.tickets/**` folder, or `B011`'s `task.md`, `spec.md`, `audit.md`

## Inputs

Read these files first before writing code:
1. [.routing/DECISION.md](../../.routing/DECISION.md) (`DEC-016`, `DEC-017`)
2. [frontendnet/.routing/BACK-HANDOFF.md](../../frontendnet/.routing/BACK-HANDOFF.md) (`REQ-004`–`REQ-007`)
3. [frontendnet/deploy/DEPLOY-PLAN.md](../../frontendnet/deploy/DEPLOY-PLAN.md) (Phases 2–3)
4. [frontendnet/deploy/frontendnet.service](../../frontendnet/deploy/frontendnet.service) & [frontendnet/deploy/nginx-frontendnet.conf](../../frontendnet/deploy/nginx-frontendnet.conf) (style/hardening reference)
5. Existing files: `backendnode/src/config/env.ts`, `src/db/index.ts`, `src/middlewares/ratelimit.middleware.ts`, `src/middlewares/errorhandler.middleware.ts`, `src/middlewares/bitacora.middleware.ts`, `src/app.ts`, `src/index.ts`, `scripts/setup-db.mjs`

## Task

1. **`env.ts` & `.env.example` (`REQ-004`, `REQ-005`, `REQ-006`):**
   - Export `TrustProxySetting = boolean | number | string | string[]` and `parseTrustProxy(raw: string | undefined): TrustProxySetting`:
     - `'false'` / empty → `false`; `'true'` → `true`; non-negative integer string (`'1'`, `'2'`) → `number`; comma-separated list (e.g., `'loopback,10.10.10.10'`) → trimmed `string[]` (single item like `'loopback'` → `'loopback'`).
   - Add `HOST`: optional string defaulting to `'127.0.0.1'` when `NODE_ENV === 'production'`, `'0.0.0.0'` otherwise.
   - Add `DB_SSL`: `'true' | 'false'` default `'false'` → boolean; `DB_SSL_CA`: optional file path string.
   - Update `backendnode/.env.example` with placeholder documentation for `HOST`, `TRUST_PROXY`, `DB_SSL`, `DB_SSL_CA` (zero real secrets).
2. **`src/db/index.ts` (`REQ-006`):**
   - When `env.DB_SSL === true`, attach `ssl: env.DB_SSL_CA ? { ca: fs.readFileSync(env.DB_SSL_CA, 'utf8'), rejectUnauthorized: true } : { rejectUnauthorized: true }` to `mysql.createPool(...)`.
3. **Proxy-Aware IP & Composite Login Rate Limiter (`REQ-004`):**
   - Update `CreateAppOptions.trustProxy` in `src/app.ts` to accept `TrustProxySetting` and pass it directly to `app.set('trust proxy', options?.trustProxy ?? false)`.
   - Export helper `extractClientIp(req: Request): string` (in `ratelimit.middleware.ts` or shared util): uses `req.ip || req.socket?.remoteAddress || 'unknown'` (which Express computes **safely** using `app.get('trust proxy')`, preventing untrusted `X-Forwarded-For` spoofing when `TRUST_PROXY=false` while honoring `X-Forwarded-For` from trusted `loopback,10.10.10.10` hops!).
   - Use `extractClientIp(req)` in `bitacora.middleware.ts` and `errorhandler.middleware.ts`.
   - In `ratelimit.middleware.ts`, configure `keyGenerator`: combines `${extractClientIp(req)}:${normalizedEmail}` when `req.body?.email` is a non-empty string, else `extractClientIp(req)` (note: disable `validate: { keyGeneratorIpFallback: false }` if needed by `express-rate-limit` v7/v8 so custom keyGenerator runs cleanly without warnings in tests!).
4. **Loopback Bind (`REQ-005`):**
   - In `src/index.ts`, call `app.listen(appEnv.SERVER_PORT, appEnv.HOST, () => { console.log(\`Server listening on http://${appEnv.HOST}:${appEnv.SERVER_PORT} (${appEnv.NODE_ENV})\`); })`.
5. **Remote `DB_APP_HOST` in `scripts/setup-db.mjs` (`REQ-006`):**
   - Export `validateAppHost(host)`: allows `'localhost'`, `'127.0.0.1'`, or a valid IPv4 address (`/^(\d{1,3}\.){3}\d{1,3}$/` with each octet `0..255`, e.g., `'10.10.10.20'`). Rejects `'%'` wildcard host, hostnames with quotes/semicolons, or invalid octets (`999.0.0.1`).
   - Support `DB_APP_HOST` from `.env` or `--app-host=<ip>` CLI arg (defaulting to `'localhost'` when unset) in `buildLeastPrivilegeStatements` and `runSetupDb`, keeping `assertSafeAppUser` (`root` blocked) and DML-only grants (`SELECT, INSERT, UPDATE, DELETE`).
6. **Production Deploy Templates (`backendnode/deploy/`, `REQ-007`):**
   - `backendnode/deploy/backendnode.service`: hardened systemd unit (`User=backendnode`, `WorkingDirectory=/opt/backendnode`, `EnvironmentFile=/etc/backendnode/backendnode.env`, `ExecStart=/usr/bin/node /opt/backendnode/dist/index.js`, `Restart=always`, `NoNewPrivileges=true`, `ProtectSystem=strict`, `ReadWritePaths=/opt/backendnode/log /opt/backendnode/uploads`, `PrivateTmp=true`, `WantedBy=multi-user.target`).
   - `backendnode/deploy/nginx-api.conf`: TLS 1.2/1.3 on `443` ONLY (no port 80), `server_name api.dima.lab`, `server_tokens off`, HSTS, `proxy_pass http://127.0.0.1:3000`, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (preserving browser IP sent by `web`), `client_max_body_size 1m`.
   - `backendnode/deploy/install-api.sh`: idempotent, **fully non-interactive** bash script compatible with **both Debian 12 (`bookworm64`) and Ubuntu 24.04** (`DEBIAN_FRONTEND=noninteractive`, `--force-confdef --force-confold`). Installs Node 22 LTS via NodeSource, nginx, ufw (`22/tcp`, `443/tcp` from `10.10.10.10` only), system user `backendnode`, writes `0600` `/etc/backendnode/backendnode.env` from required env vars (or a gitignored `.env.deploy` — failing fast if secrets like `JWT_SECRET` or `DB_PASSWORD` are unset; zero hardcoded secrets!), installs `backendnode.service` & `nginx-api.conf`, enables on boot, and runs smoke check `https://api.dima.lab/health`.
   - `backendnode/deploy/install-db.sh`: idempotent, **fully non-interactive** bash script compatible with **both Debian 12 (`bookworm64`) and Ubuntu 24.04**. Auto-detects `/etc/os-release`: on Debian 12 (`ID=debian`), automatically configures the official Oracle MySQL 8.0 APT repository + GPG key non-interactively before `apt-get install -y mysql-server`; on Ubuntu, installs `mysql-server` directly. Configures `bind-address = 10.10.10.30`, enables `mysql` on boot, applies `SCHEMA.sql` idempotently, creates least-privilege `'dima_app'@'10.10.10.20'` (DML-only) reading `DB_ROOT_PASSWORD`/`DB_APP_PASSWORD` from env vars (zero hardcoded secrets!), configures strict production `ufw` (`22/tcp`, `3306/tcp` from `10.10.10.20` only), and installs the nightly backup timer.
   - `backendnode/deploy/backup-db.sh`, `backup-db.service`, `backup-db.timer`: nightly `mysqldump --single-transaction` to `/var/backups/dima` with `chmod 600` and 7-day retention (reading credentials from a `0600` `/etc/dima/backup.cnf` defaults-extra-file — zero plaintext password on CLI!).
   - `backendnode/deploy/README.md`: concise 1-command deployment runbook covering (a) full 3-VM automated provisioning (`debian/bookworm64` or Ubuntu 24.04) via gitignored `.env.deploy` + Vagrant `file` provisioners, and (b) the **lightweight Windows single-VM `db` dev workflow** (`vagrant up db` at `10.10.10.30` + running `backendnode` natively on Windows with `DB_HOST=10.10.10.30`, temporary `10.10.10.1` `ufw`/app-user grant, and exact cleanup commands before final 3-VM grading).
   - Update `backendnode/README.md` with a concise Production Deployment section pointing to `backendnode/deploy/README.md`.
7. **Tests (`tests/prod-hardening.test.ts` + update `tests/setup.test.ts`):**
   - Verify `parseEnv` defaults `HOST` to `'127.0.0.1'` in `NODE_ENV=production` and parses `TRUST_PROXY=loopback,10.10.10.10` → `['loopback', '10.10.10.10']`, `TRUST_PROXY=false` → `false`, `TRUST_PROXY=1` → `1`, `DB_SSL=true` → `true`.
   - Verify Express `trust proxy`: with `trustProxy: ['loopback', '10.10.10.10']`, a request from loopback carrying `X-Forwarded-For: 203.0.113.50, 10.10.10.10` resolves `req.ip` to `203.0.113.50`; with `trustProxy: false`, spoofed `X-Forwarded-For` is ignored!
   - Verify composite `createAuthRateLimiter`: exhausting attempts for `alice@uv.mx` from the same proxy IP returns `429` for `alice@uv.mx` while `bob@uv.mx` is NOT locked out!
   - Verify `validateAppHost` in `setup-db.mjs`: accepts `'localhost'`, `'127.0.0.1'`, `'10.10.10.20'`; rejects `'%'`, `'999.1.1.1'`, `'10.10.10.20; DROP TABLE rol'`!
   - Verify deploy files exist and contain zero hardcoded passwords (`IDENTIFIED BY`, `M3rc@d0`, `patito`, `-p` password flags).
8. Run `npx vitest run tests/prod-hardening.test.ts tests/setup.test.ts tests/core.test.ts` while iterating, then run full gates once before committing: `npm run typecheck`, `npm run build`, `npm test`.

## Verification

Follow every check in [spec.md](spec.md).

## Change log

Write `.tickets/B011-prod-hardening-and-deploy-scripts/changelog.md` listing files touched, verification results, and security checks verified.

---

## Audit Remediation Scope (`AUD-B011-01`–`07` + `REQ-008`–`010`)

Read `.tickets/B011-prod-hardening-and-deploy-scripts/audit.md` and `frontendnet/.routing/BACK-HANDOFF.md` (`REQ-008`, `REQ-009`, `REQ-010`) in full and resolve ALL findings below:

1. **`AUD-B011-01` (High) + `REQ-010` #5 — Safe Production Bootstrap & Remote Seed Guard:**
   - Remove the `NODE_ENV=development ... seed.js || true` step from `backendnode/deploy/README.md`.
   - Create `backendnode/src/db/bootstrap.ts` (and add `"db:bootstrap": "tsx src/db/bootstrap.ts"` in `package.json`) exporting `runProductionBootstrap(dbClient, { adminEmail, adminPassword, adminNombre?, userEmail?, userPassword?, userNombre? })`:
     - Validates `adminEmail` (non-empty valid email) and `adminPassword` against **`StrongPasswordSchema`** (from `../schemas/common.schema`) — rejects weak passwords and never hashes `'patito'`.
     - Idempotently seeds `SEED_ROLES`, `SEED_CATEGORIAS`, `SEED_PRODUCTOS`, `SEED_CATEGORIA_PRODUCTOS`, and upserts the single protected `Administrador` account (`protegido: true`) using `bcrypt.hash(adminPassword, 10)` (and optional customer account if `userEmail`+`userPassword` are both provided and valid under `StrongPasswordSchema`).
     - CLI entry reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, optional `ADMIN_NOMBRE`, `USER_EMAIL`, `USER_PASSWORD`, `USER_NOMBRE` from env and runs cleanly under `NODE_ENV=production`.
   - In `backendnode/src/db/seed.ts`, update `assertSeedAllowed(nodeEnv: string, dbHost = 'localhost', allowRemoteDevSeed = false)` to reject `nodeEnv === 'production'` AND reject non-loopback `dbHost` (anything other than `localhost`, `127.0.0.1`, `::1`) unless `allowRemoteDevSeed === true` (`--allow-remote-dev-seed` CLI flag). Update `tests/db.test.ts` accordingly.
2. **`AUD-B011-02` (Medium) — Eliminate Spoofable `request-ip` Across All Controllers:**
   - Export `buildAuditContext(req: Request, actorEmailOverride?: string): AuditContext` in `backendnode/src/middlewares/bitacora.middleware.ts` using `extractClientIp(req)` and `actorEmailOverride ?? req.decodedToken?.[ClaimTypes.Name] ?? 'invitado'`.
   - Replace `requestIp.getClientIp(req)` with `buildAuditContext(req)` in all 6 controllers: `auth.controller.ts`, `usuarios.controller.ts`, `categorias.controller.ts`, `productos.controller.ts`, `archivos.controller.ts`, `pedidos.controller.ts`.
   - Remove `request-ip` and `@types/request-ip` from `backendnode/package.json` and update `package-lock.json` cleanly (`npm install --package-lock-only` or `npm uninstall request-ip @types/request-ip`).
3. **`AUD-B011-03` (Medium) — Dual-Layer Login Rate Limiter & IP-Only Registration Limiter:**
   - In `backendnode/src/middlewares/ratelimit.middleware.ts`:
     - Keep `createAuthRateLimiter` (`${ip}:${normalizedEmail}`, default 10 / 15 min) for login isolation behind the BFF.
     - Add `createLoginIpRateLimiter` (key = `extractClientIp(req)` only, default `max: 100`, `windowMs: 15 * 60 * 1000`).
     - Add `createRegisterRateLimiter` (key = `extractClientIp(req)` only, default `max: 5`, `windowMs: 60 * 60 * 1000`).
   - In `backendnode/src/routes/auth.routes.ts`:
     - Expose `loginIpRateLimiter?: RequestHandler` alongside `rateLimiter` and `registerRateLimiter` in `AuthRouterDeps`.
     - Mount `POST /` with `[loginIpLimiter, limiter, validate({ body: LoginRequestSchema }), controller.login]`.
     - Mount `POST /registro` with `[registerLimiter, validate({ body: RegisterRequestSchema }), controller.register]` where default `registerLimiter` is `createRegisterRateLimiter()` (IP-only).
4. **`AUD-B011-04` (Medium) + `REQ-008` + `REQ-010` #1, #2, #6 — DB-Agnostic `SCHEMA.sql`, Unified DB Name & Hardened Backups:**
   - Remove `CREATE DATABASE IF NOT EXISTS ...` and `USE ...;` from `backendnode/db/SCHEMA.sql` so it is pure table DDL.
   - Standardize default `DB_DATABASE=mercadolibrenode` across `.env.example`, `setup-env.mjs`, `install-db.sh`, `install-api.sh`, `backup-db.sh`, `backup-db.service`, and `deploy/README.md`.
   - In `backendnode/scripts/setup-db.mjs`:
     - Create database `` `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` `` first.
     - Check `information_schema.tables` for `SequelizeMeta` in `dbName` (`REQ-008`); if found, throw a clear error telling the developer to run `DROP DATABASE \`${dbName}\`;` and re-run `npm run setup:db -- --seed`.
     - Connect with `database: dbName` when applying `SCHEMA.sql`.
   - In `backendnode/deploy/backup-db.sh`:
     - Add `umask 077` right after `set -euo pipefail` (`REQ-010` #2).
     - Verify table count (`SHOW TABLES`) > 0 before dumping, clean up any partial dump on failure (`trap`), verify `gzip -t "$BACKUP_FILE"` and non-empty uncompressed payload (`AUD-B011-04`).
   - In `backendnode/deploy/install-db.sh`:
     - Run ``CREATE DATABASE IF NOT EXISTS `${DB_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`` and load schema with `mysql --defaults-extra-file="$BACKUP_CNF" "$DB_DATABASE" < "$SCHEMA_SQL"`.
     - Write `backup-db.service` drop-in or templated `Environment=DB_DATABASE=${DB_DATABASE}` so backups always target the configured DB.
     - Add `/etc/systemd/system/mysql.service.d/wait-network.conf` (`[Unit]\nWants=network-online.target\nAfter=network-online.target`) (`REQ-010` #6).
5. **`AUD-B011-05` + `REQ-009` — Gitignore TLS Keys & Certs:**
   - Add `backendnode/deploy/certs/`, `*.key`, and `*.pem` to root `.gitignore`.
6. **`AUD-B011-06` & `AUD-B011-07` — Password Safety, Signed NodeSource Keyring & Scoped SSH:**
   - In `install-db.sh` and `install-api.sh`, validate passwords/secrets reject `\`, `'`, `"`, `#`, and whitespace up front (e.g. `[[ "$val" =~ [\\\'\"#[[:space:]]] ]]` or strict allowlist regex). When `DB_REQUIRE_SSL=true` in `install-db.sh`, add `REQUIRE SSL` to `CREATE/ALTER USER`.
   - In `install-api.sh`, install Node 22 LTS via the official NodeSource signed APT keyring (`/usr/share/keyrings/nodesource.gpg` + `/etc/apt/sources.list.d/nodesource.list`) — NO `| bash`!
   - In both `install-db.sh` and `install-api.sh`, replace bare `ufw allow 22/tcp` with `MGMT_CIDR="${MGMT_CIDR:-10.10.10.0/24}"` (`ufw allow from "$MGMT_CIDR" to any port 22 proto tcp`) plus auto-allowing `${SSH_CONNECTION%% *}/32` if invoked over an active SSH session (so `vagrant ssh` on libvirt/VirtualBox NAT never locks itself out!).
   - Update `backendnode/deploy/README.md` (`REQ-010` #4) to recommend `frontendnet/deploy/deploy-all.sh` / minimal staged per-role bundles (never uploading `node_modules` or `.env.deploy` with DB root password to `api`) and `dist/db/bootstrap.js` for production admin bootstrap; update `backendnode/README.md` with the `REQ-008` `SequelizeMeta` hint.
7. **Required Regression Tests (in `tests/prod-hardening.test.ts`, `tests/setup.test.ts`, `tests/db.test.ts`, `tests/auth.test.ts`):**
   - `AUD-B011-01`: `deploy/README.md` & `deploy/*.sh` contain no `NODE_ENV=development` + `seed`; `runProductionBootstrap` rejects weak `ADMIN_PASSWORD` (incl. `'patito'`) and succeeds with strong password; `assertSeedAllowed` rejects non-loopback `DB_HOST` unless `allowRemoteDevSeed=true`.
   - `AUD-B011-02`: Integration tests through `createApp({ trustProxy: false })` sending `POST /api/auth` (bad password) and `POST /api/categorias` with spoofed `X-Client-IP: 6.6.6.6` and `X-Forwarded-For: 7.7.7.7`, asserting bitacora receives socket IP; static test asserting `0` occurrences of `request-ip` in `backendnode/src/`.
   - `AUD-B011-03`: Per-IP login ceiling (`N+1` distinct emails → `429`), per-IP registration ceiling (6 distinct emails → 6th returns `429`), and `alice@uv.mx`/`bob@uv.mx` isolation below ceiling.
   - `AUD-B011-04`: `SCHEMA.sql` contains no `CREATE DATABASE` or `USE`; `install-db.sh` passes `"$DB_DATABASE"` to `mysql` when loading `SCHEMA.sql`; default `DB_DATABASE` matches identically across `install-db.sh`, `install-api.sh`, `backup-db.sh`, `backup-db.service`, and `.env.example`; `backup-db.sh` sets `umask 077`.
   - `AUD-B011-05`: `git check-ignore -q backendnode/deploy/certs/x.key` exits `0`.
   - `AUD-B011-06` & `AUD-B011-07`: static checks confirming `install-db.sh` rejects backslashes/quotes in passwords, and deploy scripts contain no `| bash` and no bare `ufw allow 22/tcp`.
