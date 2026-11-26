# B011 — Changelog (`Production Hardening, Remote DB Setup & Deploy Templates`)

## Summary

Implemented `DEC-016` (`REQ-004`, `REQ-005`) and `DEC-017` (`REQ-006`, `REQ-007`) for production runtime hardening, remote least-privilege MySQL provisioning, and 3-VM deployment templates under `backendnode/deploy/`.

## Files Created / Modified

- `backendnode/src/config/env.ts` — Added `TrustProxySetting`, `parseTrustProxy` (boolean, hop count, string, or comma-separated trust list), `HOST` (defaults to `127.0.0.1` in `production`, `0.0.0.0` otherwise), `DB_SSL`, and `DB_SSL_CA`.
- `backendnode/.env.example` — Documented `HOST`, `TRUST_PROXY`, `DB_SSL`, and `DB_SSL_CA` placeholders (zero secrets).
- `backendnode/src/db/index.ts` — Attached optional MySQL `ssl` pool options (`rejectUnauthorized: true`, optional `ca` file) when `DB_SSL=true`.
- `backendnode/src/middlewares/ratelimit.middleware.ts` — Exported `extractClientIp(req)` using `req.ip` and keyed `createAuthRateLimiter` by `${ip}:${normalizedEmail}` (falling back to `ip` when email is absent).
- `backendnode/src/middlewares/bitacora.middleware.ts` — Replaced blind `request-ip` lookup with `extractClientIp(req)`.
- `backendnode/src/middlewares/errorhandler.middleware.ts` — Replaced blind `request-ip` lookup with `extractClientIp(req)`.
- `backendnode/src/app.ts` — Updated `CreateAppOptions.trustProxy` to accept `TrustProxySetting`.
- `backendnode/src/index.ts` — Bound `app.listen(appEnv.SERVER_PORT, appEnv.HOST, ...)` so production listens only on loopback (`127.0.0.1`).
- `backendnode/scripts/setup-db.mjs` — Added `validateAppHost(host)` (allows `localhost`, `127.0.0.1`, or valid IPv4; rejects `%`, quotes, semicolons, and invalid octets) and `DB_APP_HOST` / `--app-host=<ip>` support.
- `backendnode/deploy/backendnode.service` — Hardened systemd unit (`User=backendnode`, `ProtectSystem=strict`, `NoNewPrivileges=true`, `PrivateTmp=true`, `ReadWritePaths`).
- `backendnode/deploy/nginx-api.conf` — TLS 1.2/1.3 reverse proxy on `443` only (no port `80`), HSTS, `server_tokens off`, `X-Forwarded-For` append.
- `backendnode/deploy/install-api.sh` — Non-interactive, idempotent Debian 12 + Ubuntu 24.04 `api` installer (Node 22 LTS via NodeSource, nginx, `ufw` `443` from `10.10.10.10` only, `0640` `/etc/backendnode/backendnode.env`, smoke checks).
- `backendnode/deploy/install-db.sh` — Non-interactive, idempotent Debian 12 (Oracle MySQL 8.0 APT repo) + Ubuntu 24.04 `db` installer (`bind-address = 10.10.10.30`, `SCHEMA.sql`, least-privilege DML user, `ufw` `3306` from `10.10.10.20` only, `0600` `/etc/dima/backup.cnf`, backup timer).
- `backendnode/deploy/backup-db.sh`, `backup-db.service`, `backup-db.timer` — Credential-safe nightly `mysqldump --single-transaction` to `/var/backups/dima` (`chmod 600`, 7-day retention).
- `backendnode/deploy/README.md` & `backendnode/README.md` — Documented 3-VM production deploy and lightweight Windows `vagrant up db` dev workflow with pre-grading cleanup.
- `backendnode/tests/prod-hardening.test.ts` & `backendnode/tests/setup.test.ts` — Added unit/integration tests for `parseTrustProxy`, `HOST` default, `X-Forwarded-For` trust behavior, composite login rate limiter, `validateAppHost`, and secret-free deploy templates.

## Verification Results

- `npm run typecheck` (`tsc --noEmit`): passed (`0` errors)
- `npm run build` (`tsc`): passed (`0` errors)
- `npm test` (`vitest run`): passed (`12` test files, `147` tests, `0` failures)
- `\bany\b` in `backendnode/src/**`: `0` matches
