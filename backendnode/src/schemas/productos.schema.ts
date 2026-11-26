import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { CategoriaDtoSchema } from './categorias.schema';
import { ErrorResponseSchema, NumericIdParamSchema } from './common.schema';

export const ProductoSearchQuerySchema = z.object({
  s: z.string().trim().max(255).optional(),
});

export const ProductoCategoriaParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  categoriaid: z.coerce.number().int().positive(),
});

export const AssignCategoriaBodySchema = z
  .object({
    categoriaid: z.coerce.number().int().positive(),
  })
  .openapi('AssignCategoriaRequest');

export const ProductoDtoSchema = z
  .object({
    productoId: z.number().int().positive(),
    titulo: z.string(),
    descripcion: z.string(),
    precio: z.number().nonnegative(),
    archivoid: z.number().int().positive().nullable(),
    categorias: z.array(CategoriaDtoSchema),
  })
  .openapi('ProductoDto');

export const ProductoListResponseSchema = z
  .array(ProductoDtoSchema)
  .openapi('ProductoListResponse');

export const CreateProductoRequestSchema = z
  .object({
    titulo: z.string().trim().min(1).max(255),
    descripcion: z.string().trim().min(1).max(5000),
    precio: z.coerce.number().finite().nonnegative().max(99999999.99),
    archivoid: z.number().int().positive().nullable().optional(),
  })
  .openapi('CreateProductoRequest');

export const UpdateProductoRequestSchema = CreateProductoRequestSchema.openapi(
  'UpdateProductoRequest',
);

export type ProductoSearchQuery = z.infer<typeof ProductoSearchQuerySchema>;
export type ProductoCategoriaParams = z.infer<typeof ProductoCategoriaParamsSchema>;
export type AssignCategoriaBody = z.infer<typeof AssignCategoriaBodySchema>;
export type ProductoDto = z.infer<typeof ProductoDtoSchema>;
export type CreateProductoRequest = z.infer<typeof CreateProductoRequestSchema>;
export type UpdateProductoRequest = z.infer<typeof UpdateProductoRequestSchema>;

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
  409: {
    description: 'La categoría ya está asignada al producto.',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
} as const;

export function registerProductosPaths(registry: OpenAPIRegistry): void {
  registry.register('AssignCategoriaRequest', AssignCategoriaBodySchema);
  registry.register('ProductoDto', ProductoDtoSchema);
  registry.register('ProductoListResponse', ProductoListResponseSchema);
  registry.register('CreateProductoRequest', CreateProductoRequestSchema);
  registry.register('UpdateProductoRequest', UpdateProductoRequestSchema);

  registry.registerPath({
    method: 'get',
    path: '/api/productos',
    operationId: 'GetProductos',
    tags: ['Productos'],
    summary: 'Obtener productos con búsqueda opcional',
    security: [{ bearerAuth: [] }],
    request: {
      query: ProductoSearchQuerySchema,
    },
    responses: {
      200: {
        description: 'Lista de productos.',
        content: { 'application/json': { schema: ProductoListResponseSchema } },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/productos/{id}',
    operationId: 'GetProductoById',
    tags: ['Productos'],
    summary: 'Obtener un producto por ID',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
    },
    responses: {
      200: {
        description: 'Producto encontrado.',
        content: { 'application/json': { schema: ProductoDtoSchema } },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/productos',
    operationId: 'CreateProducto',
    tags: ['Productos'],
    summary: 'Crear un nuevo producto',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateProductoRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Producto creado.',
        content: { 'application/json': { schema: ProductoDtoSchema } },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/productos/{id}',
    operationId: 'UpdateProducto',
    tags: ['Productos'],
    summary: 'Actualizar un producto existente',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateProductoRequestSchema,
          },
        },
      },
    },
    responses: {
      204: {
        description: 'Producto actualizado.',
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/productos/{id}',
    operationId: 'DeleteProducto',
    tags: ['Productos'],
    summary: 'Eliminar un producto existente',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
    },
    responses: {
      204: {
        description: 'Producto eliminado.',
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/productos/{id}/categoria',
    operationId: 'AssignProductoCategoria',
    tags: ['Productos'],
    summary: 'Asignar una categoría a un producto',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: AssignCategoriaBodySchema,
          },
        },
      },
    },
    responses: {
      204: {
        description: 'Categoría asignada al producto.',
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
      409: errorResponses[409],
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/productos/{id}/categoria/{categoriaid}',
    operationId: 'RemoveProductoCategoria',
    tags: ['Productos'],
    summary: 'Remover una categoría de un producto',
    security: [{ bearerAuth: [] }],
    request: {
      params: ProductoCategoriaParamsSchema,
    },
    responses: {
      204: {
        description: 'Categoría removida del producto.',
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
    },
  });
}
