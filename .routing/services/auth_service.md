# Auth Service (`auth`)

- **Base Route:** `/api/auth`
- **Owned Files:**
  - `src/config/claimtypes.ts`
  - `src/services/jwttoken.service.ts`
  - `src/services/auth.service.ts`
  - `src/middlewares/auth.middleware.ts`
  - `src/schemas/auth.schema.ts`
  - `src/controllers/auth.controller.ts`
  - `src/routes/auth.routes.ts`
- **Dependencies:** Reads `usuario` ([usuarios_service.md](usuarios_service.md)) and `rol` ([roles_service.md](roles_service.md)); logs via `IBitacoraService` ([bitacora_service.md](bitacora_service.md)).

---

## 1. SQL Schema Entities

Owns **no** database tables. Performs read-only join on:
- `usuario` (`id`, `email`, `passwordhash`, `nombre`, `rolid`)
- `rol` (`id`, `nombre`)

---

## 2. Zod Mappings (`src/schemas/auth.schema.ts`)

```ts
import { z } from 'zod';
import { RoleNameSchema } from './common.schema';

export const LoginRequestSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
}).openapi('LoginRequest');

export const LoginResponseSchema = z.object({
  email: z.string().email(),
  nombre: z.string(),
  rol: RoleNameSchema,
  jwt: z.string(),
}).openapi('LoginResponse');

export const TokenTimeResponseSchema = z
  .string()
  .regex(/^00:\d{2}:\d{2}$/)
  .openapi('TokenTimeResponse');

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
```

---

## 3. API Endpoints

| Method | Path | `operationId` | Roles | Request | Response | Audit Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth` | `Login` | Public | `LoginRequest` JSON | `200` `LoginResponse` \| `400` Validation \| `401` `{ mensaje: 'Usuario o contraseña incorrectos.' }` \| `429` Rate limit | `usuario.login` (`email`) |
| `GET` | `/api/auth/tiempo` | `GetTokenRemainingTime` | `Usuario`, `Administrador` | `Authorization: Bearer <jwt>` | `200` `text/plain` (`"00:MM:SS"`) \| `401` Unauthorized \| `404` Unavailable | None |

### Security & Business Rules
1. **Rate limiting:** Apply strict `express-rate-limit` on `POST /api/auth`.
2. **Timing protection:** If `email` is not found, perform a dummy `bcrypt.compare` before returning `401` with the exact same message (`Usuario o contraseña incorrectos.`).
3. **JWT claims & signing (`HS256`, `expiresIn: '20m'`):**
   - `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name`: `email`
   - `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname`: `nombre`
   - `http://schemas.microsoft.com/ws/2008/06/identity/claims/role`: `rol`
   - `iss`: `"ServidorFeiJWT"`, `aud`: `"ClientesFeiJWT"`
4. **JWT verification (`authorize(...allowedRoles)`):**
   - Guard missing/non-Bearer header → `401` (`"Acceso denegado"`).
   - Pin `jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'ServidorFeiJWT', audience: 'ClientesFeiJWT' })`.
   - Valid token with role not in `allowedRoles` → `403` (`"Acceso denegado"`).
   - If remaining time `< 5` minutes, issue fresh 20m token in `Set-Authorization` header (exposed via CORS).
5. **Plain-text response:** `GET /api/auth/tiempo` sets `Content-Type: text/plain; charset=utf-8` (and returns immediately on `404` to avoid double-send).

---

## 4. TypeScript Interfaces

```ts
import type { AuditContext, RoleName } from '../schemas/common.schema';
import type { LoginRequest, LoginResponse } from '../schemas/auth.schema';
import type { DecodedTokenPayload } from '../types/express';

export interface IJwtTokenService {
  generaToken(email: string, nombre: string, rol: RoleName): string;
  verificarToken(token: string): DecodedTokenPayload;
  tiempoRestanteDesdeToken(token: string): string | null;
}

export interface IAuthService {
  login(input: LoginRequest, audit: AuditContext): Promise<LoginResponse>;
  obtenerTiempoRestante(bearerHeader: string | undefined): string | null;
}
```
