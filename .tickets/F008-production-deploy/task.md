# F008 — Production Hardening & 3-Server Deployment

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F008` | `draft` | Strong model, **Supervised** permission mode (touches servers) | Front/Ops | [spec.md](spec.md) |

## Items addressed
- [FDEC-003](../../frontendnet/.routing/DECISION.md#fdec-003); rubric "Uso de servidores", "Seguridad", "Pruebas solicitadas" 1–7.
- Full procedure: [frontendnet/deploy/DEPLOY-PLAN.md](../../frontendnet/deploy/DEPLOY-PLAN.md).

## Scope

### May create or edit
- `frontendnet/deploy/**`
- `frontendnet/appsettings.Production.json`
- `.tickets/F008-production-deploy/changelog.md`

### Must not touch
- Application code (open a fix ticket instead), `backendnode/**`.

## Steps
Follow DEPLOY-PLAN.md phases 0–6 for the `web` server; coordinate phases for `api` and `db` with the backend owner (BACK-HANDOFF items 4–7). Record evidence (command output / screenshots) for each rubric test in `changelog.md`.

## Done when
[spec.md](spec.md) passes on the deployed servers.
