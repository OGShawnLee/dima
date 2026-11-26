import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ErrorResponseSchema, RoleNameSchema } from './common.schema';

export const UsuarioEmailParamSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const UsuarioDtoSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    nombre: z.string(),
    rol: RoleNameSchema,
  })
  .openapi('UsuarioDto');

export const UsuarioListResponseSchema = z
  .array(UsuarioDtoSchema)
  .openapi('UsuarioListResponse');

export const CreateUsuarioRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(6).max(128),
    nombre: z.string().trim().min(1).max(255),
    rol: RoleNameSchema,
  })
  .openapi('CreateUsuarioRequest');

export const UpdateUsuarioRequestSchema = z
  .object({
    nombre: z.string().trim().min(1).max(255).optional(),
    rol: RoleNameSchema,
  })
  .openapi('UpdateUsuarioRequest');

export type UsuarioEmailParam = z.infer<typeof UsuarioEmailParamSchema>;
export type UsuarioDto = z.infer<typeof UsuarioDtoSchema>;
export type CreateUsuarioRequest = z.infer<typeof CreateUsuarioRequestSchema>;
export type UpdateUsuarioRequest = z.infer<typeof UpdateUsuarioRequestSchema>;

export function registerUsuariosPaths(registry: OpenAPIRegistry): void {
  registry.register('UsuarioDto', UsuarioDtoSchema);
  registry.register('UsuarioListResponse', UsuarioListResponseSchema);
  registry.register('CreateUsuarioRequest', CreateUsuarioRequestSchema);
  registry.register('UpdateUsuarioRequest', UpdateUsuarioRequestSchema);

  registry.registerPath({
    method: 'get',
    path: '/api/usuarios',
    operationId: 'GetUsuarios',
    tags: ['Usuarios'],
    summary: 'Listar usuarios',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Lista de usuarios.',
        content: {
          'application/json': {
            schema: UsuarioListResponseSchema,
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
      403: {
        description: 'Acceso prohibido (requiere rol Administrador).',
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
    path: '/api/usuarios/{email}',
    operationId: 'GetUsuarioByEmail',
    tags: ['Usuarios'],
    summary: 'Obtener usuario por correo electrónico',
    security: [{ bearerAuth: [] }],
    request: {
      params: UsuarioEmailParamSchema,
    },
    responses: {
      200: {
        description: 'Usuario encontrado.',
        content: {
          'application/json': {
            schema: UsuarioDtoSchema,
          },
        },
      },
      400: {
        description: 'Parámetro de correo inválido.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
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
      403: {
        description: 'Acceso prohibido.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Usuario no encontrado.',
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
    path: '/api/usuarios',
    operationId: 'CreateUsuario',
    tags: ['Usuarios'],
    summary: 'Crear usuario',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateUsuarioRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Usuario creado.',
        content: {
          'application/json': {
            schema: UsuarioDtoSchema,
          },
        },
      },
      400: {
        description: 'Datos inválidos o rol inexistente.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
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
      403: {
        description: 'Acceso prohibido.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      409: {
        description: 'Correo electrónico duplicado.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/usuarios/{email}',
    operationId: 'UpdateUsuario',
    tags: ['Usuarios'],
    summary: 'Actualizar usuario',
    security: [{ bearerAuth: [] }],
    request: {
      params: UsuarioEmailParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateUsuarioRequestSchema,
          },
        },
      },
    },
    responses: {
      204: {
        description: 'Usuario actualizado.',
      },
      400: {
        description: 'Datos inválidos o rol inexistente.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
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
      403: {
        description: 'Usuario protegido o auto-edición prohibida.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Usuario no encontrado.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/usuarios/{email}',
    operationId: 'DeleteUsuario',
    tags: ['Usuarios'],
    summary: 'Eliminar usuario',
    security: [{ bearerAuth: [] }],
    request: {
      params: UsuarioEmailParamSchema,
    },
    responses: {
      204: {
        description: 'Usuario eliminado.',
      },
      400: {
        description: 'Parámetro de correo inválido.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
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
      403: {
        description: 'Usuario protegido o auto-eliminación prohibida.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Usuario no encontrado.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });
}
