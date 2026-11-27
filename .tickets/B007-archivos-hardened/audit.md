# Security Audit — B007 (archivos-hardened)

| Field | Value |
| :--- | :--- |
| Ticket | `B007-archivos-hardened` |
| Target | `Backend` |
| Audited Commit | `73c2bb3` |
| Date | `2026-11-26` |
| Verdict | `PASS WITH NOTES` |

Evidence: `npm ci && npx tsc --noEmit && npx vitest run` at `73c2bb3` → `tsc` 0 errors, 13 test files / 172 tests passed.

Source read: `src/routes/archivos.routes.ts`, `src/middlewares/upload.middleware.ts`, `src/controllers/archivos.controller.ts`, `src/services/archivos.service.ts`, `src/schemas/archivos.schema.ts`.

## Checklist Summary
| Check | Status | Notes |
| :--- | :--- | :--- |
| No Mass Assignment | `PASS` | Metadata is fully server-derived (`mime` literal, UUID `nombre`, `size` from the buffer). |
| Auth & RBAC (`401` vs `403`) | `PASS` | `auth('Administrador')` runs **before** `uploadImage.single('file')` on `POST`/`PUT` (no disk or memory work for 401/403, tested). `GET /:id` is public by design (`archivos_service.md`). |
| File Upload Hardening | `PASS` | `memoryStorage`, `fileSize ≤ 100 KB`, `files: 1`, MIME `image/jpeg` plus `.jpg/.jpeg`, magic bytes `FF D8 FF` checked in middleware and again in the service. `${randomUUID()}.jpg` on disk; `resolveSafeUploadPath` rejects `/`, `\`, `..` and checks containment. `Content-Type: image/jpeg` plus `nosniff` on download. The written file is unlinked if the DB insert or update fails. The old file is unlinked only after a successful update or delete. |
| SQL & Query Safety | `PASS` | Parameterized; numeric `id` validated. |
| Logging & Error Hygiene | `PASS` | Multer errors → `400`; `ENOENT` → `404`. |
| Audit Trail (`bitacora`) | `PASS` | `archivos.crear/editar/eliminar` with the correct id, logged after the 404 check. The IP source is `request-ip`; tracked as `AUD-B011-02`. |
| Negative Tests Present | `PASS` | `archivos.test.ts` (10): traversal, spoofed HTML-as-JPEG, oversize with no orphan files, 401/403 before write. |

## Findings

### AUD-B007-01 — Magic-byte check covers only 3 bytes; JPEG/HTML polyglots pass
- **Severity:** `Low`
- **Status:** `OPEN`
- **Location:** `backendnode/src/middlewares/upload.middleware.ts:9-11`
- **CWE / OWASP:** `CWE-434`
- **Issue / Exploit Scenario:** A file beginning `FF D8 FF` followed by arbitrary HTML or JS is accepted and served publicly. Direct exploitation is blocked by `Content-Type: image/jpeg`, `nosniff` and helmet's CSP. The residual risk is a downstream consumer (for example the BFF image proxy in F003) that re-serves the bytes without `nosniff`, or with a sniffed type.
- **Required Fix:** Optionally also require the end-of-image marker (`buf[len-2] === 0xFF && buf[len-1] === 0xD9`). Ideally, decode and re-encode with `sharp` (strips metadata and payloads). Separately, make sure the frontend proxy forwards `X-Content-Type-Options: nosniff` (cross-check during the F003 audit).
- **Required Regression Test:** Upload a buffer `FF D8 FF E0 … <script>…</script>` without a trailing `FF D9` and expect `400`.
