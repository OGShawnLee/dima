# B011 — Production Hardening, Remote DB Setup & Deploy Templates (`REQ-004`–`REQ-007`)

| ID | Status | Model | Track | Services | Spec |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `B011` | `implemented` | `Gemini 4 Hydrogen (Medium)` | `Shared` | Production runtime (`env`, `app`, `index`, `ratelimit`, `bitacora`, `errorhandler`), `setup-db`, `backendnode/deploy/` | [spec.md](spec.md) |

## Security & Contract Items Addressed

- `DEC-016` (`REQ-004`) — Upgrade `TRUST_PROXY` to support `'false'`, `'true'`, hop count, or comma-separated Express trust list (e.g., `'loopback,10.10.10.10'`). Use `req.ip` (respecting Express `trust proxy` instead of blind `request-ip` header trust) in `bitacora`, `errorhandler`, and `createAuthRateLimiter`, and key the auth rate limiter by `${ip}:${normalizedEmail}` so one user behind the BFF cannot lock out all other users.
- `DEC-016` (`REQ-005`) — Add `HOST` env var (default `'127.0.0.1'` when `NODE_ENV === 'production'`, `'0.0.0.0'` otherwise) and bind `app.listen(appEnv.SERVER_PORT, appEnv.HOST, ...)` so port `3000` is closed to non-loopback traffic in production.
- `DEC-017` (`REQ-006`) — Extend `scripts/setup-db.mjs` with validated `DB_APP_HOST` (allowing `localhost`, `127.0.0.1`, or private IPv4 like `10.10.10.20`, still blocking `root` and granting DML-only `SELECT, INSERT, UPDATE, DELETE`) and add optional `DB_SSL` (`'true'|'false'`) + `DB_SSL_CA` in `env.ts` & `src/db/index.ts`.
- `DEC-017` (`REQ-007`) — Add hardened `api` and `db` deployment templates under `backendnode/deploy/` (`backendnode.service`, `nginx-api.conf`, `install-api.sh`, `install-db.sh`, `backup-db.sh`, `backup-db.service`, `backup-db.timer`) matching `frontendnet/deploy/DEPLOY-PLAN.md` Phases 2–3.

## Scope

### May create or edit
- `backendnode/.env.example`
- `backendnode/src/config/env.ts`
- `backendnode/src/db/index.ts`
- `backendnode/src/middlewares/ratelimit.middleware.ts`
- `backendnode/src/middlewares/errorhandler.middleware.ts`
- `backendnode/src/middlewares/bitacora.middleware.ts`
- `backendnode/src/app.ts`
- `backendnode/src/index.ts`
- `backendnode/scripts/setup-db.mjs`
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
- `.tickets/B011-prod-hardening-and-deploy-scripts/changelog.md`

### Must not touch
- `backendnode/src/db/schema.ts`, `backendnode/db/SCHEMA.sql`, `backendnode/package.json`
- Any domain `schemas/`, `services/`, `controllers/`, `routes/` files (except reading them)
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
