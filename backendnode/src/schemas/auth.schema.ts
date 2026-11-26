import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ErrorResponseSchema, RoleNameSchema, StrongPasswordSchema } from './common.schema';
import { UsuarioDtoSchema } from './usuarios.schema';

export const LoginRequestSchema = z
  .object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(128),
  })
  .openapi('LoginRequest');

export const LoginResponseSchema = z
  .object({
    email: z.string().email(),
    nombre: z.string(),
    rol: RoleNameSchema,
    jwt: z.string(),
  })
  .openapi('LoginResponse');

export const RegisterRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    nombre: z.string().trim().min(1).max(255),
    password: StrongPasswordSchema,
  })
  .openapi('RegisterRequest');

export const TokenTimeResponseSchema = z
  .string()
  .regex(/^00:\d{2}:\d{2}$/)
  .openapi('TokenTimeResponse');

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export function registerAuthPaths(registry: OpenAPIRegistry): void {
  registry.register('LoginRequest', LoginRequestSchema);
  registry.register('LoginResponse', LoginResponseSchema);
  registry.register('RegisterRequest', RegisterRequestSchema);
  registry.register('TokenTimeResponse', TokenTimeResponseSchema);

  registry.registerPath({
    method: 'post',
    path: '/api/auth',
    operationId: 'Login',
    tags: ['Auth'],
    summary: 'Iniciar sesión',
    request: {
      body: {
        content: {
          'application/json': {
            schema: LoginRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Autenticación exitosa.',
        content: {
          'application/json': {
            schema: LoginResponseSchema,
          },
        },
      },
      400: {
        description: 'Datos de entrada inválidos.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      401: {
        description: 'Credenciales inválidas.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      429: {
        description: 'Demasiados intentos de inicio de sesión.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/auth/registro',
    operationId: 'Register',
    tags: ['Auth'],
    summary: 'Registrar nuevo usuario',
    request: {
      body: {
        content: {
          'application/json': {
            schema: RegisterRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Usuario registrado.',
        content: {
          'application/json': {
            schema: UsuarioDtoSchema,
          },
        },
      },
      400: {
        description: 'Datos de entrada inválidos.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      409: {
        description: 'Correo electrónico ya registrado.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      429: {
        description: 'Demasiados intentos de registro.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/auth/tiempo',
    operationId: 'GetTokenRemainingTime',
    tags: ['Auth'],
    summary: 'Obtener tiempo restante del token',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Tiempo restante del token en formato 00:MM:SS.',
        content: {
          'text/plain': {
            schema: TokenTimeResponseSchema,
          },
        },
      },
      401: {
        description: 'No autenticado.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Tiempo de token no disponible.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });
}
