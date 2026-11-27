# Security Audit — B003 (schema-sql-and-setup-scripts)

| Field | Value |
| :--- | :--- |
| Ticket | `B003-schema-sql-and-setup-scripts` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS WITH NOTES` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 13 test files / 172 tests passed.

Source read: `db/SCHEMA.sql`, `scripts/setup-db.mjs`, `scripts/setup-env.mjs`, `backendnode/README.md`, root `.gitignore`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| SQL & Query Safety | `PASS` | `SCHEMA.sql` is pure DDL (no accounts or data). `setup-db.mjs` validates the DB name and user with an allowlist regex, blocks `root`, validates the app host, uses `mysql.escape` for the password, and runs grants with `multipleStatements: false`. Only the static schema file uses `multipleStatements: true`. |
| Least privilege | `PASS` | App user gets `SELECT, INSERT, UPDATE, DELETE` only after `REVOKE ALL`. |
| Secrets & Repo Hygiene | `PASS` | `setup-env.mjs` generates a 70-hex `JWT_SECRET` from `crypto.randomBytes(35)` and writes `.env` with mode `0600`. The root password comes from a masked prompt or `MYSQL_ROOT_PASSWORD`, never argv. `--seed` is refused for `NODE_ENV=production`. `!backendnode/db/SCHEMA.sql` is the only allowlisted `.sql`. |
| Negative Tests Present | `PASS` | `setup.test.ts` (23 tests) covers identifier injection, root refusal, host validation, grant text. |

## Findings

### AUD-B003-01 — `SCHEMA.sql` hardcodes the database name and ignores `DB_DATABASE`
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/db/SCHEMA.sql:5,9`; `scripts/setup-db.mjs` (grant uses `DB_DATABASE`); `.env.example:2` (`dima_db`) vs `scripts/setup-env.mjs:42` (`mercadolibrenode`)
- **CWE / OWASP:** `CWE-1188`
- **Issue / Exploit Scenario:** A developer who copies `.env.example` gets tables in `mercadolibrenode` but grants on `dima_db`, so the app fails, and the tempting fix is to widen grants. This is the root cause of the production-impacting `AUD-B011-04` (Medium), where the full fix is specified. Fixing `AUD-B011-04` resolves this finding.
- **Required Fix:** See `AUD-B011-04`. Remove `CREATE DATABASE`/`USE` from `SCHEMA.sql`, create `DB_DATABASE` in `setup-db.mjs`, and connect with `database: dbName` before applying DDL.
- **Required Regression Test:** See `AUD-B011-04`.
