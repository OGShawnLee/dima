import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ErrorResponseSchema } from './common.schema';

export const BitacoraDtoSchema = z
  .object({
    bitacoraId: z.number().int().positive(),
    accion: z.string(),
    elementoid: z.string().nullable(),
    ip: z.string(),
    usuario: z.string(),
    fecha: z.string().datetime(),
  })
  .openapi('BitacoraDto');

export const BitacoraListResponseSchema = z
  .array(BitacoraDtoSchema)
  .openapi('BitacoraListResponse');

export type BitacoraDto = z.infer<typeof BitacoraDtoSchema>;

export function registerBitacoraPaths(registry: OpenAPIRegistry): void {
  registry.register('BitacoraDto', BitacoraDtoSchema);
  registry.register('BitacoraListResponse', BitacoraListResponseSchema);

  registry.registerPath({
    method: 'get',
    path: '/api/bitacora',
    operationId: 'GetBitacora',
    tags: ['Bitácora'],
    summary: 'Obtener registros de bitácora',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Lista de eventos de bitácora ordenados por id descendente.',
        content: {
          'application/json': {
            schema: BitacoraListResponseSchema,
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
