# Dima — Agent Entry Pointer

Read [README.md](README.md) and [.routing/CONTEXT.md](.routing/CONTEXT.md) before doing any work in this repository.

## Role Skills (Single-Writer Ownership)

- **Backend Router (`backendnode/`, `B`-tickets):** [.gemini/skills/router/SKILL.md](.gemini/skills/router/SKILL.md) + [.gemini/skills/ticket/SKILL.md](.gemini/skills/ticket/SKILL.md)
- **Frontend Router (`frontendnet/`, `F`-tickets):** [.gemini/skills/frontend-router/SKILL.md](.gemini/skills/frontend-router/SKILL.md)
- **Security Auditor (`audit.md`, `AUDIT-HANDOFF.md`):** [.gemini/skills/security-audit/SKILL.md](.gemini/skills/security-audit/SKILL.md)

## Non-Negotiable Rules

1. **Respect single-writer file ownership** defined in [.routing/CONTEXT.md](.routing/CONTEXT.md) so teammates never hit Git merge conflicts.
2. **Backend is the source of truth** for the API contract ([.routing/SERVICES.md](.routing/SERVICES.md)); all deliberate security and contract deviations from the baseline specs are logged in [.routing/DECISION.md](.routing/DECISION.md).
3. **Reconcile with remote** (`git fetch origin`) before any commit, merge, or push.
4. **Conventional Commits only** (English, with a brief body overview of what changed).
