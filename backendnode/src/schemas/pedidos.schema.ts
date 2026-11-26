import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ErrorResponseSchema, NumericIdParamSchema } from './common.schema';

export const PedidoEstadoSchema = z.enum(['pendiente', 'confirmado', 'cancelado']);
export type PedidoEstado = z.infer<typeof PedidoEstadoSchema>;

export const CreatePedidoItemSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().min(1).max(99),
});

export const CreatePedidoRequestSchema = z
  .object({
    items: z.array(CreatePedidoItemSchema).min(1).max(50),
  })
  .openapi('CreatePedidoRequest');

export const PedidoCreatedDtoSchema = z
  .object({
    pedidoId: z.number().int().positive(),
    total: z.number().nonnegative(),
    fecha: z.string().datetime(),
    estado: PedidoEstadoSchema,
  })
  .openapi('PedidoCreatedDto');

export const PedidoSummaryDtoSchema = z
  .object({
    pedidoId: z.number().int().positive(),
    total: z.number().nonnegative(),
    fecha: z.string().datetime(),
    estado: PedidoEstadoSchema,
    itemCount: z.number().int().nonnegative(),
  })
  .openapi('PedidoSummaryDto');

export const PedidoSummaryListResponseSchema = z
  .array(PedidoSummaryDtoSchema)
  .openapi('PedidoSummaryListResponse');

export const PedidoAdminSummaryDtoSchema = PedidoSummaryDtoSchema.extend({
  usuarioEmail: z.string().email(),
  usuarioNombre: z.string(),
}).openapi('PedidoAdminSummaryDto');

export const PedidoAdminSummaryListResponseSchema = z
  .array(PedidoAdminSummaryDtoSchema)
  .openapi('PedidoAdminSummaryListResponse');

export const PedidoLineaDtoSchema = z
  .object({
    productoId: z.number().int().positive().nullable(),
    titulo: z.string(),
    precioUnitario: z.number().nonnegative(),
    cantidad: z.number().int().positive(),
  })
  .openapi('PedidoLineaDto');

export const PedidoDetailDtoSchema = z
  .object({
    pedidoId: z.number().int().positive(),
    usuarioEmail: z.string().email(),
    usuarioNombre: z.string(),
    total: z.number().nonnegative(),
    fecha: z.string().datetime(),
    estado: PedidoEstadoSchema,
    items: z.array(PedidoLineaDtoSchema),
  })
  .openapi('PedidoDetailDto');

export type CreatePedidoItem = z.infer<typeof CreatePedidoItemSchema>;
export type CreatePedidoRequest = z.infer<typeof CreatePedidoRequestSchema>;
export type PedidoCreatedDto = z.infer<typeof PedidoCreatedDtoSchema>;
export type PedidoSummaryDto = z.infer<typeof PedidoSummaryDtoSchema>;
export type PedidoAdminSummaryDto = z.infer<typeof PedidoAdminSummaryDtoSchema>;
export type PedidoLineaDto = z.infer<typeof PedidoLineaDtoSchema>;
export type PedidoDetailDto = z.infer<typeof PedidoDetailDtoSchema>;

const errorResponses = {
  400: {
    description: 'Solicitud inválida.',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
  401: {
    description: 'No autenticado.',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
  403: {
    description: 'Acceso prohibido.',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
  404: {
    description: 'Recurso no encontrado.',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
} as const;

export function registerPedidosPaths(registry: OpenAPIRegistry): void {
  registry.register('CreatePedidoRequest', CreatePedidoRequestSchema);
  registry.register('PedidoCreatedDto', PedidoCreatedDtoSchema);
  registry.register('PedidoSummaryDto', PedidoSummaryDtoSchema);
  registry.register('PedidoSummaryListResponse', PedidoSummaryListResponseSchema);
  registry.register('PedidoAdminSummaryDto', PedidoAdminSummaryDtoSchema);
  registry.register('PedidoAdminSummaryListResponse', PedidoAdminSummaryListResponseSchema);
  registry.register('PedidoLineaDto', PedidoLineaDtoSchema);
  registry.register('PedidoDetailDto', PedidoDetailDtoSchema);

  registry.registerPath({
    method: 'post',
    path: '/api/pedidos',
    operationId: 'CreatePedido',
    tags: ['Pedidos'],
    summary: 'Crear un pedido con precios autoritativos del servidor',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreatePedidoRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Pedido creado.',
        content: { 'application/json': { schema: PedidoCreatedDtoSchema } },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/pedidos/mios',
    operationId: 'GetMyPedidos',
    tags: ['Pedidos'],
    summary: 'Obtener los pedidos del usuario autenticado',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Lista de pedidos del usuario autenticado.',
        content: { 'application/json': { schema: PedidoSummaryListResponseSchema } },
      },
      401: errorResponses[401],
      403: errorResponses[403],
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/pedidos',
    operationId: 'GetPedidos',
    tags: ['Pedidos'],
    summary: 'Obtener todos los pedidos (solo Administrador)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Lista completa de pedidos.',
        content: { 'application/json': { schema: PedidoAdminSummaryListResponseSchema } },
      },
      401: errorResponses[401],
      403: errorResponses[403],
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/pedidos/{id}',
    operationId: 'GetPedidoById',
    tags: ['Pedidos'],
    summary: 'Obtener el detalle de un pedido por ID',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
    },
    responses: {
      200: {
        description: 'Detalle del pedido.',
        content: { 'application/json': { schema: PedidoDetailDtoSchema } },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
    },
  });
}
