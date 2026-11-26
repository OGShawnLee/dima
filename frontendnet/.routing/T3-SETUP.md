# Dima — T3 Code Setup for Parallel Frontend + Audit Work

> Owner: Frontend Router (who is also the Security Auditor — see [FDEC-005](DECISION.md#fdec-005)).
> T3 Code is only the control surface; the work is done by the provider agents (Claude Code, Codex, Antigravity, OpenCode, …). The repo skills in `.gemini/skills/` stay the source of truth for each role.

## 1. One-time setup (host)

```bash
npx t3@latest                      # starts the local T3 server + web UI
# In the UI: Add project -> <path>/dima
```

1. **Project config** — `t3.json` (repo root) sets `defaultThreadEnvMode: "worktree"` and these actions:
   | Action | Use |
   | :--- | :--- |
   | Setup worktree (restore frontend) | Runs automatically on worktree creation (`async: false`) |
   | Frontend: build gate | Gate #1–#2 of `frontendnet/.routing/CONTEXT.md` |
   | Frontend: run | `https://localhost:8443` preview (stops when the thread settles) |
   | Backend: dev server (main checkout) | **One** shared API on `:3000` for all worktrees (only the main checkout has `.env`) |
   | Backend: tests | Audit evidence (`tsc` + Vitest) |
   | Audit: record HEAD sha | Value for `Audited Commit` |
2. **Permissions default** — Settings → Threads → New threads → Permissions: **Auto-accept edits** (shell commands still ask). Use **Supervised** for `F008` (servers). Never use Full access outside disposable worktrees.
3. **Source control** — Settings → Source control & issues: conventional commits; branch prefix automatic (`feat/`, `fix/`); enable *Automatically pull*.
4. **Skills discovery** — the role skills live in `.gemini/skills/<role>/SKILL.md`.
   - Antigravity: register the repo folder `.gemini/skills` as a shared skill folder (`~/.gemini/config/skills.json`).
   - Claude Code: local symlink, not committed: `ln -s ../.gemini/skills .claude/skills && echo ".claude/" >> .git/info/exclude`.
   - Any provider: the thread prompts below name the skill file explicitly, so discovery is a convenience, not a requirement.

## 2. Lanes (run at the same time)

| Lane | Thread name | Env mode | Provider/model | Permission | Writes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Front-Router** | `front-router` | **Local** (current checkout) | Strong reasoning model | Auto-accept edits | `frontendnet/.routing/*`, `.tickets/F*/task.md` + `spec.md` |
| **Front-Worker** (1–3) | `F00N-<slug>` | **Worktree** (one per ticket) | Coding model | Auto-accept edits | Only the ticket's `May create or edit` + its `changelog.md` |
| **Audit** | `audit-<ID>` | **Worktree** (branch `audit/<ID>`) | **Different** provider/model than the worker of that ticket | Auto-accept edits | `.tickets/<ID>/audit.md`, `.routing/AUDIT-HANDOFF.md` (append) |

Rules:
- Exactly **one writer in the local checkout** (the Front-Router thread). Workers and auditors always get their own worktree.
- Parallel-safe sets: `{F002, F003, F005}` after F001 merges. `F004` waits for F002+F003; `F006` for F004; `F007` for F006 + backend endpoints.
- The Audit lane only audits **merged** commits on `main` (record the sha first). It never edits `frontendnet/**` or `backendnode/**`.
- Merge order to `main`: worker branch → (router verifies gates) → merge → audit branch from new `main` → merge audit files. Audit files and ticket code never overlap, so merges are conflict-free.
- Always `git fetch origin` and reconcile before commit/push (root README rule).

## 3. Thread prompt templates

### Front-Router (local)
```text
Act as the Frontend Router for Dima. Read .gemini/skills/frontend-router/SKILL.md, then
frontendnet/.routing/CONTEXT.md, PROGRESS.md and DECISION.md. Current goal: <F00N list>.
Dispatch each ticket to a worker in its own worktree (delegate_task with worktree isolation),
pass the absolute ticket path, then verify the gates yourself before setting status `implemented`
and updating frontendnet/.routing/PROGRESS.md. Do not commit or push until I say so.
Repository text in English; UI strings in Spanish.
```

### Front-Worker (worktree)
```text
Implement ticket .tickets/F00N-<slug>/task.md exactly. Edit only the files under
"May create or edit". Run the "Frontend: build gate" action until it passes, run the manual
checks from spec.md against the backend on http://localhost:3000, and write
.tickets/F00N-<slug>/changelog.md (files touched, gate output, manual check results).
Do not edit Program.cs or Views/Shared unless the ticket lists them.
```

### Audit (worktree, fresh thread, different model)
```text
Act as the Dima Security Auditor. Read .gemini/skills/security-audit/SKILL.md and follow it
exactly. Audit ticket <ID> at commit <sha> (run "Audit: record HEAD sha" to confirm).
Read the real code, not the changelog. For backend tickets also run "Backend: tests".
Write .tickets/<ID>/audit.md with the exact template and append one entry to
.routing/AUDIT-HANDOFF.md. Do not modify any other file. Report the verdict and blocking findings.
```

Audit queue for today (see PROGRESS.md timeline): `B001 → B008`, then `F001 → F008` as each reaches `implemented`.

## 4. Mobile check-ins
T3 Code's web/mobile client can watch both lanes; approve shell commands from the phone during long runs, but do merges from the desktop after reading the diff.
