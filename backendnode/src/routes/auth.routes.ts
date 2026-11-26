import { Router, type RequestHandler } from 'express';
import { createAuthController } from '../controllers/auth.controller';
import { authorize } from '../middlewares/auth.middleware';
import { createAuthRateLimiter } from '../middlewares/ratelimit.middleware';
import { validate } from '../middlewares/validate.middleware';
import { LoginRequestSchema, RegisterRequestSchema } from '../schemas/auth.schema';
import type { RoleName } from '../schemas/common.schema';
import type { IAuthService } from '../services/auth.service';

export interface AuthRouterDeps {
  service?: IAuthService;
  rateLimiter?: RequestHandler;
  registerRateLimiter?: RequestHandler;
  authorizeMiddleware?: (...allowedRoles: RoleName[]) => RequestHandler;
}

export function createAuthRouter(deps?: AuthRouterDeps): Router {
  const router = Router();
  const controller = createAuthController(deps?.service);
  const limiter = deps?.rateLimiter ?? createAuthRateLimiter();
  const registerLimiter =
    deps?.registerRateLimiter ?? deps?.rateLimiter ?? createAuthRateLimiter();
  const auth = deps?.authorizeMiddleware ?? authorize;

  router.post('/', limiter, validate({ body: LoginRequestSchema }), controller.login);
  router.post(
    '/registro',
    registerLimiter,
    validate({ body: RegisterRequestSchema }),
    controller.register,
  );
  router.get('/tiempo', auth('Usuario', 'Administrador'), controller.tiempo);

  return router;
}

export const authRouter = createAuthRouter();
