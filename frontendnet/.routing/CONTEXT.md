# Dima Frontend — Context (`frontendnet`)

> **Single-Writer Rule:** Written exclusively by the **Frontend Router** (`$frontend-router`). Read by the Backend Router, the Security Auditor, and frontend workers.

## Stack (final)

| Item | Value |
| :--- | :--- |
| Framework | ASP.NET Core MVC (Razor) acting as BFF |
| Target framework | **`net10.0`** (LTS, supported until Nov 2028) — see [FDEC-001](DECISION.md#fdec-001) |
| Dev OS | Linux (Ubuntu); Windows only for optional Visual Studio use |
| Upstream API | `backendnode` (`/openapi.json` is the contract source of truth) |
| Auth | Browser ↔ BFF: encrypted cookie `.frontendnet`; BFF ↔ API: JWT Bearer + `Set-Authorization` sliding refresh |
| UI libs | Bootstrap 5.3.3, Bootstrap Icons 1.11.3, jQuery 3.7.1, jquery-validate 1.20.0, jquery-validation-unobtrusive 4.0.0 (CDN + SRI) |
| Spec | [FRONTEND-API-SPEC.md](../../FRONTEND-API-SPEC.md) (all 11 PDF bug fixes are mandatory) overridden only by [DECISION.md](DECISION.md) |

## Directory layout

```text
frontendnet/
├── .routing/        CONTEXT.md, PROGRESS.md, DECISION.md, BACK-HANDOFF.md, T3-SETUP.md
├── deploy/          DEPLOY-PLAN.md + server templates (systemd, nginx, ufw, Vagrantfile)
├── Controllers/  Middlewares/  Models/  Services/  Views/  wwwroot/
├── Properties/launchSettings.json   (http 8080 / https 8443 for local dev)
├── appsettings.json                 (no secrets)
├── appsettings.Production.json      (no secrets; values overridden by systemd env)
└── frontendnet.csproj
```

## Verification gates (a ticket cannot move to `implemented` without these)

1. `dotnet build frontendnet/frontendnet.csproj -c Release` → exit `0`, `0` errors, no nullable warnings in `Middlewares/`, `Services/AuthClientService.cs`, `Controllers/AuthController.cs`.
2. `grep -rn "async void" frontendnet --include=*.cs` → no results.
3. Every `[HttpPost]` has `[ValidateAntiForgeryToken]` (or global `AutoValidateAntiforgeryTokenAttribute` filter).
4. `grep -rn "Html.Raw" frontendnet/Views` → no results on user-supplied data.
5. Manual smoke against local backend (`http://localhost:3000`): login, the ticket's pages, logout, and a forced `401` (expired JWT) redirects to `/Auth/Salir`.
6. Scope check: `git diff --name-only` ⊆ ticket `May create or edit` + its `changelog.md`.

## Security invariants (frontend)

- The BFF never trusts itself for authorization: backend RBAC is authoritative; `[Authorize(Roles=...)]` only shapes UI.
- Cookie: `HttpOnly`, `SecurePolicy = Always` (outside Development), `SameSite = Strict`, 20 min sliding.
- Data Protection keys persisted to disk (`DataProtection__KeysPath`) so restarts do not invalidate sessions.
- Behind nginx: `UseForwardedHeaders` (loopback proxy only), `UseHsts` in Production.
- Product images are served through the BFF image proxy (`GET /Archivos/Imagen/{id}`), never directly from the API host ([FDEC-002](DECISION.md#fdec-002)).
- Cart prices shown in the UI are informative only; the backend recomputes totals on checkout ([FDEC-004](DECISION.md#fdec-004)).
- No secrets in `appsettings*.json`, views, or Git.

## Working agreements

- Repository language: **English** for code, commits, tickets, routing docs. UI strings stay in **Spanish** (course requirement).
- Conventional Commits: `feat(frontend)`, `fix(frontend)`, `security(frontend)`, `docs(frontend)`, `chore(frontend)`, `ci(deploy)`.
- `git fetch origin` + reconcile before any commit/push (see root README).
- Parallel execution with T3 Code: see [T3-SETUP.md](T3-SETUP.md).
