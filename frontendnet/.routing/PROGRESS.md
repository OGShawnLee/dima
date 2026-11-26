# Dima Frontend — Progress & Work Plan (`frontendnet`)

> **Single-Writer Rule:** Written exclusively by the **Frontend Router**. Readable by everyone. The Security Auditor picks tickets in status `implemented` from this file.

## Current Status

- **Phase:** Planning complete — implementation starts `2026-11-26`.
- **Hard deadline:** **2026-11-27 13:00 (America/Mexico_City)** — frontend complete **and** 3-server deployment passing the rubric's 7 live tests.
- **Blocked on backend:** `F007` (registration / orders endpoints) — requested in [BACK-HANDOFF.md](BACK-HANDOFF.md).

## Ticket Board

| Ticket | Title | Status | Lane | Depends on | Audit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `F001` | MVC scaffold, BFF auth bridge, layout | `draft` | Front | backend running locally | — |
| `F002` | Categorías CRUD | `draft` | Front | F001 | — |
| `F003` | Archivos CRUD + BFF image proxy | `draft` | Front | F001 | — |
| `F004` | Productos CRUD + categories M:N | `draft` | Front | F002, F003 | — |
| `F005` | Usuarios CRUD + Bitácora | `draft` | Front | F001 | — |
| `F006` | Comprar catalog + session cart | `draft` | Front | F004 | — |
| `F007` | Self-registration + checkout + orders (customer & admin) | `draft` (blocked) | Front | F006 + backend endpoints | — |
| `F008` | Production hardening + 3-server deployment | `draft` | Front/Ops | F001–F006 (F007 if ready) | — |

`F002`, `F003`, and `F005` touch disjoint files and can run in **parallel worktrees** once `F001` is merged.

## Timeline (America/Mexico_City)

| Window | Front lane (T3 thread "Frontend") | Audit lane (T3 thread "Audit") |
| :--- | :--- | :--- |
| Thu 13:30–14:00 | Install `dotnet-sdk-10.0`; start backend locally (`npm ci && npm run setup:env && npm run setup:db -- --seed && npm run dev`); push this plan + `BACK-HANDOFF.md` | Read `security-audit` skill; record `main` SHA |
| Thu 14:00–16:00 | **F001** (milestone: login → `/Perfil` shows `/api/auth/tiempo`) | Audit **B001–B004** (scaffold, schema, setup scripts, auth) |
| Thu 16:00–18:30 | **F002 ‖ F003 ‖ F005** in parallel worktrees | Audit **B005–B008** |
| Thu 18:30–20:30 | **F004**, then **F006** | Audit **F001** |
| Thu 20:30–23:00 | **F007** (if backend endpoints merged; otherwise build against the agreed contract and finish Fri 08:00) | Audit **F002, F003, F005** |
| Fri 08:00–10:30 | **F008** deploy: 3 VMs, TLS, systemd, nginx, ufw | Audit **F004, F006, F007** |
| Fri 10:30–12:00 | Run the 7 rubric tests on the deployed system; fix | Audit **F008** (ports, services, headers) |
| Fri 12:00–13:00 | Buffer, freeze, tag `v1.0.0`, zip source + config scripts + test accounts | Final `AUDIT-HANDOFF.md` entries |

## Rubric coverage owned by frontend

| Rubric item | Covered by |
| :--- | :--- |
| Cliente web: clear pattern, no mixed code, full API communication, keeps state after API restart | F001–F007 (MVC + services + cookie BFF) |
| Funcionalidad: 2 roles, auth, RBAC, CRUD, multimedia, registration, cart, orders, dev + prod envs | F001–F007, F008 |
| Seguridad: client validation, auth in frontend, cookies, session refresh/expiry, 80 closed, strong passwords | F001, F007, F008 |
| Uso de servidores: 3 servers, reverse proxy, services, firewall | F008 |
| Pruebas: 1 client validation, 3 private sections, 5 auto-start on reboot, 6 JWT refresh, 7 netstat | F001, F008 |

## Completed

- 2026-11-26 — Bootstrapped `frontendnet/.routing/` (CONTEXT, PROGRESS, DECISION, BACK-HANDOFF, T3-SETUP), tickets `F001`–`F008`, deployment plan.
