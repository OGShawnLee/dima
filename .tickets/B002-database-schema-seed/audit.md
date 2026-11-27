# Security Audit — B002 (database-schema-seed)

| Field | Value |
| :--- | :--- |
| Ticket | `B002-database-schema-seed` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS WITH NOTES` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 13 test files / 172 tests passed.

Source read: `src/db/index.ts`, `src/db/schema.ts`, `src/db/seed.ts`, `drizzle.config.ts`, `db/SCHEMA.sql`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Mass Assignment | `N/A` | — |
| Auth & RBAC | `N/A` | — |
| Backend-Enforced Business Guards | `PASS` | `protegido`/`protegida` columns are `NOT NULL DEFAULT FALSE`; `usuario.email` is unique. |
| SQL & Query Safety | `PASS` | mysql2 pool via Drizzle, `utf8mb4`, no raw SQL. TLS options are verified (`rejectUnauthorized: true`). |
| Secrets & Repo Hygiene | `PASS` | `runSeed` → `assertSeedAllowed` throws for `NODE_ENV=production` (tested). Default `patito` credentials exist only in seed code. **Note:** the production runbook gets around this guard. Tracked as `AUD-B011-01` (High). |
| Negative Tests Present | `PASS` | `db.test.ts` covers the production seed refusal and the `schema.ts` FK rules; `setup.test.ts:67` covers the `SCHEMA.sql` `ON DELETE` rules. |

## Findings

### AUD-B002-01 — `usuario.rolid` FK cascades deletes from `rol` to every user
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/db/schema.ts:73`; `db/SCHEMA.sql:68-71`
- **CWE / OWASP:** `CWE-404`
- **Issue / Exploit Scenario:** `ON DELETE CASCADE` on `fk_usuario_rol` means one `DELETE FROM rol` (manual DBA action or a future roles endpoint) wipes all users of that role. Through `fk_pedido_usuario` it also wipes their orders (see `AUD-B010-02`). No API currently deletes roles, so this is defensive.
- **Required Fix:** Change to `ON DELETE RESTRICT` in both `schema.ts` and `SCHEMA.sql`.
- **Required Regression Test:** Update the `db.test.ts` parity assertion to expect `restrict` for `usuario.rolid`.

### AUD-B002-02 — Seeded accounts use a password that violates the project's own policy
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/db/seed.ts` (`bcrypt.hash('patito', 10)`)
- **CWE / OWASP:** `CWE-1392`
- **Issue / Exploit Scenario:** Dev-only, but any dev or shared lab DB reachable from the network (e.g. the `10.10.10.30` VM in the Windows workflow) gets a `protegido` admin with a public password that cannot be changed through the API.
- **Required Fix:** Read the seed password from an optional `SEED_PASSWORD` env var (validated with `StrongPasswordSchema`), and fall back to `patito` only when `DB_HOST` is loopback.
- **Required Regression Test:** `runSeed` with a non-loopback host and no `SEED_PASSWORD` throws.
