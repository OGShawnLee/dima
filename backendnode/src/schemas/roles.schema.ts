import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ErrorResponseSchema, RoleNameSchema } from './common.schema';

export const RolDtoSchema = z
  .object({
    id: z.string().uuid(),
    nombre: RoleNameSchema,
  })
  .openapi('RolDto');

export const RolListResponseSchema = z
  .array(RolDtoSchema)
  .openapi('RolListResponse');

export type RolDto = z.infer<typeof RolDtoSchema>;

export function registerRolesPaths(registry: OpenAPIRegistry): void {
  registry.register('RolDto', RolDtoSchema);
  registry.register('RolListResponse', RolListResponseSchema);

  registry.registerPath({
    method: 'get',
    path: '/api/roles',
    operationId: 'GetRoles',
    tags: ['Roles'],
    summary: 'Obtener catálogo de roles',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Lista de roles del sistema.',
        content: {
          'application/json': {
            schema: RolListResponseSchema,
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
}
