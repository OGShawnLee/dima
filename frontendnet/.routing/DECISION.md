# Dima Frontend — Decision Log (`frontendnet`)

> **Single-Writer Rule:** Written exclusively by the **Frontend Router**. Complements the backend log in [`.routing/DECISION.md`](../../.routing/DECISION.md). IDs use the `FDEC-` prefix so they never collide with backend `DEC-` entries.

## Entry Template

```markdown
## FDEC-NNN — Short Title (`YYYY-MM-DD`)
- **Status:** Accepted | Proposed
- **Baseline Spec / PDF:** What the practice PDF or FRONTEND-API-SPEC.md did.
- **Decision:** What frontendnet implements instead.
- **Rationale:** Security (CWE/OWASP) or engineering justification.
- **Impact:** Effect on frontendnet, backendnode, or deployment.
```

---

<a id="fdec-001"></a>
## FDEC-001 — Target `net10.0` instead of `net8.0` (`2026-11-26`)
- **Status:** Accepted
- **Baseline Spec / PDF:** .NET SDK 8.0 (`net8.0`).
- **Decision:** Build and deploy on .NET 10 LTS (`net10.0`). Production publishes a **self-contained** `linux-x64` build so servers need no shared runtime.
- **Rationale:** .NET 8 reached end of support on 2026-11-10 and no longer receives security patches (OWASP A06 — Vulnerable and Outdated Components). .NET 10 is LTS until Nov 2028. The practice code compiles unchanged except for the `TargetFramework` value.
- **Impact:** Developers install `dotnet-sdk-10.0`. Language stays C#; course stack (C# + Node.js) unchanged.

<a id="fdec-002"></a>
## FDEC-002 — BFF image proxy instead of direct browser → API image URLs (`2026-11-26`)
- **Status:** Accepted
- **Baseline Spec / PDF:** Views render `<img src="{PublicUrlWebAPI}/api/archivos/{id}">`, so the browser downloads images directly from the API host.
- **Decision:** Add `GET /Archivos/Imagen/{id}` (anonymous, `[ResponseCache]` 5 min) in `ArchivosController` that streams `GET api/archivos/{id}` from the backend with `Content-Type: image/jpeg` and `X-Content-Type-Options: nosniff`. All views use `Url.Action("Imagen", "Archivos", new { id })`. `PublicUrlWebAPI` is removed.
- **Rationale:** (1) `helmet@8` sends `Cross-Origin-Resource-Policy: same-origin` by default, so cross-origin `<img>` loads from the API host are blocked by browsers. (2) Keeps the API server reachable **only** from the frontend server (rubric: 3-server deployment, firewall, closed ports). Smaller attack surface (OWASP A05).
- **Impact:** No backend change required. Browser never talks to the API.

<a id="fdec-003"></a>
## FDEC-003 — Three-server deployment with TLS on every hop (`2026-11-26`)
- **Status:** Accepted
- **Decision:** `web` (nginx 443 → Kestrel 127.0.0.1:5000), `api` (nginx 443 → Node 127.0.0.1:3000), `db` (MySQL 3306, backend IP only). Ports 80 and 3000 closed. All apps run as hardened `systemd` services that start on boot. Details: [deploy/DEPLOY-PLAN.md](../deploy/DEPLOY-PLAN.md).
- **Rationale:** Matches the rubric's top level for "Uso de servidores" and "Seguridad" (closed ports 3000/80, firewall, reverse proxy, HTTPS).
- **Impact:** Backend must support binding to `127.0.0.1`, a remote DB host, and a trusted proxy (requested in [BACK-HANDOFF.md](BACK-HANDOFF.md)).

<a id="fdec-004"></a>
## FDEC-004 — Cart lives in the BFF session; orders live in the backend (`2026-11-26`)
- **Status:** Proposed (pending backend acceptance of `POST /api/pedidos`)
- **Baseline Spec / PDF:** `Carrito` and `Comprar` are placeholder stubs; the project brief requires account creation, a shopping cart, and an admin "received orders" module.
- **Decision:** The cart is stored server-side in ASP.NET Core Session (cookie holds only an opaque session id) as `[{ productoId, cantidad }]`. Checkout sends only ids + quantities to `POST /api/pedidos`; the backend recomputes prices and totals. Admin and customer order lists come from the backend.
- **Rationale:** Minimizes backend scope for the deadline while keeping the trust boundary correct: the client can never set prices (OWASP API6 / CWE-602). If the backend later exposes `/api/carrito`, the BFF swaps the storage behind `CarritoService` without touching views.
- **Impact:** Requires backend endpoints listed in [BACK-HANDOFF.md](BACK-HANDOFF.md).

<a id="fdec-005"></a>
## FDEC-005 — Auditor independence while one person holds two roles (`2026-11-26`)
- **Status:** Accepted
- **Context:** The same teammate is Frontend Router and Security Auditor.
- **Decision:** Frontend tickets are audited in a separate T3 Code thread, started fresh (no frontend context), using a **different provider/model** than the one that implemented the ticket, and only from committed code (`git rev-parse HEAD`). The auditor thread never edits `frontendnet/**`.
- **Rationale:** Keeps the adversarial review meaningful and traceable (separation of duties).
- **Impact:** Documented in [T3-SETUP.md](T3-SETUP.md).

<a id="fdec-006"></a>
## FDEC-006 — Forward client IP to the backend (`2026-11-26`)
- **Status:** Proposed (needs backend `TRUST_PROXY` support for the frontend server IP)
- **Decision:** All typed `HttpClient`s add `X-Forwarded-For: <browser IP>` via a third delegating handler (`ReenviaIpDelegatingHandler`).
- **Rationale:** Every request reaching the API comes from the BFF's IP. Without forwarding, the backend login rate limiter (10 / 15 min per IP) locks out **all** users after 10 failed attempts anyone makes, and `bitacora` records the frontend server IP instead of the real client (OWASP A09).
- **Impact:** Backend must trust `X-Forwarded-For` **only** from the frontend server IP.
