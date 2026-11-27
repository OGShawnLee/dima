# Security Audit — B009 (self-registration-and-password-policy)

| Field | Value |
| :--- | :--- |
| Ticket | `B009-self-registration-and-password-policy` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS WITH NOTES` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 172/172 tests passed. Source read: `src/routes/auth.routes.ts`, `src/controllers/auth.controller.ts`, `src/services/auth.service.ts`, `src/schemas/{auth,common,usuarios}.schema.ts`, `src/middlewares/ratelimit.middleware.ts`, `src/services/usuarios.service.ts`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Mass Assignment | `PASS` | `RegisterRequestSchema` accepts only `email`, `nombre`, `password`; extra `rol`/`protegido`/`id` are stripped. The insert hard-codes `rolid = Usuario` and `protegido: false` (tested). |
| Auth & RBAC (`401` vs `403`) | `PASS` | `POST /api/auth/registro` is public by design. Registration cannot yield `Administrador`. |
| Rate limiting | `PASS` | A dedicated limiter instance sits in front of `/registro`. However, at HEAD its `ip:email` key (introduced by B011) lets one IP register unlimited distinct emails. Blocking finding is tracked as **`AUD-B011-03`**, not duplicated here. |
| Backend-Enforced Business Guards / password policy | `PASS` | `StrongPasswordSchema` (12–128 chars, upper/lower/digit/symbol) applies to both `/api/auth/registro` and `POST /api/usuarios`. |
| SQL & Query Safety | `PASS` | Drizzle parameterized. Duplicate-email race → `ER_DUP_ENTRY` → `409`. |
| Logging & Error Hygiene | `PASS` | Errors forwarded via `next(err)`; the password is never logged. The IP source is `request-ip` (`AUD-B011-02`). |
| Audit Trail (`bitacora`) | `PASS` | `usuario.registro` is logged with the normalized email. |
| Negative Tests Present | `PASS` | Weak passwords per rule, role escalation attempt, duplicate `409`, `429`. Missing: distinct-email-per-IP `429` (see `AUD-B011-03`). |

## Findings

### AUD-B009-01 — bcrypt silently truncates passwords beyond 72 bytes
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/schemas/common.schema.ts:12` (`.max(128)`); `src/services/auth.service.ts:185`; `src/services/usuarios.service.ts:194`
- **CWE / OWASP:** `CWE-521`
- **Issue / Exploit Scenario:** The policy allows 128 characters, but bcrypt only uses the first 72 bytes (fewer with multi-byte UTF-8). Any suffix beyond that is ignored, so two different long passwords that share the first 72 bytes both authenticate.
- **Required Fix:** Add `.refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'La contraseña no puede exceder 72 bytes.')` to `StrongPasswordSchema`, and lower `LoginRequestSchema.password` to `max(72)` bytes for consistency. Alternatively, pre-hash with HMAC-SHA256 before bcrypt and document it in `DECISION.md`.
- **Required Regression Test:** Registration with a 73-byte valid-complexity password returns `400`.

### AUD-B009-02 — Registration reveals whether an email is already registered (`409`)
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/services/auth.service.ts:180-183`
- **CWE / OWASP:** `CWE-204 / OWASP API2:2023`
- **Issue / Exploit Scenario:** `POST /api/auth/registro` returns `409 El correo electrónico ya está registrado.` for known emails. That gives an unauthenticated user-enumeration oracle, which undercuts the constant-time login work (DEC-009). Combined with `AUD-B011-03`, it is unthrottled per IP.
- **Required Fix:** Either accept this and record it in `DECISION.md` as a usability trade-off, or return a generic `201`/`202` and notify by email. At minimum, fixing `AUD-B011-03` bounds the oracle to a few probes per IP.
- **Required Regression Test:** If accepted, none. If changed: registering an existing email returns the same status and body shape as a new one.
