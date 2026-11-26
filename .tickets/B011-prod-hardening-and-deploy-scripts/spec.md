# B011 — Verification Spec

Every checkbox below must pass deterministically before moving `B011` to `implemented`.

## 1. Typecheck & Build Gates (Mandatory)

- [ ] `npm run typecheck` (`tsc --noEmit`) exits `0` with **zero** errors.
- [ ] `npm run build` (`tsc`) exits `0`.

## 2. Automated Test Gate

- [ ] Targeted run: `npx vitest run tests/prod-hardening.test.ts tests/setup.test.ts tests/core.test.ts` exits `0`.
- [ ] Final full suite run: `npm test` (`vitest run`) exits `0` with **0 failures**.

## 3. Security & Production Checks (`DEC-016`, `DEC-017`)

- [ ] **Trusted proxy list (`REQ-004`):** `TRUST_PROXY=loopback,10.10.10.10` resolves client browser IP via `req.ip`; `TRUST_PROXY=false` ignores spoofed `X-Forwarded-For`.
- [ ] **No cross-user BFF lockout (`REQ-004`):** Login rate limiter keys by `${ip}:${normalizedEmail}` so one user's failed attempts behind the BFF do not lock out another user.
- [ ] **Loopback bind (`REQ-005`):** `HOST` defaults to `'127.0.0.1'` in `NODE_ENV=production` and is passed to `app.listen(port, host)`.
- [ ] **Remote least-privilege DB user (`REQ-006`):** `setup-db.mjs` accepts `DB_APP_HOST=10.10.10.20`, rejects `'%'` / invalid IPs / `'root'`, grants only `SELECT, INSERT, UPDATE, DELETE`.
- [ ] **Deploy templates (`REQ-007`):** `backendnode/deploy/` includes hardened systemd unit, nginx TLS-only (no port 80), `ufw` least-privilege rules, non-interactive Debian 12 + Ubuntu 24.04 compatible `install-api.sh` / `install-db.sh` (auto-configuring Oracle MySQL 8.0 on Debian 12 and Node 22 LTS via NodeSource), credential-safe nightly `mysqldump` timer, and `backendnode/deploy/README.md` (covering both 3-VM prod deploy and lightweight `vagrant up db` host-dev workflow) — zero hardcoded secrets.
- [ ] **Zero `any` in `src/`:** 0 matches for `\bany\b` in `backendnode/src/**`.

## 4. Scope & Commit Checks

- [ ] `git status --short` / `git diff --name-only` contains **only** files listed in `task.md` (`May create or edit`).
- [ ] `.tickets/B011-prod-hardening-and-deploy-scripts/changelog.md` is written.
- [ ] Single clean English Conventional Commit (e.g., `feat(backend): add proxy-aware rate limiting, loopback bind, remote DB setup, and deploy templates`) with brief body overview.
