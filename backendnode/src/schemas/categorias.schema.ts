import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ErrorResponseSchema, NumericIdParamSchema } from './common.schema';

export const CategoriaDtoSchema = z
  .object({
    categoriaId: z.number().int().positive(),
    nombre: z.string(),
    protegida: z.boolean(),
  })
  .openapi('CategoriaDto');

export const CategoriaListResponseSchema = z
  .array(CategoriaDtoSchema)
  .openapi('CategoriaListResponse');

export const CreateCategoriaRequestSchema = z
  .object({
    nombre: z.string().trim().min(1).max(255),
  })
  .openapi('CreateCategoriaRequest');

export const UpdateCategoriaRequestSchema = z
  .object({
    nombre: z.string().trim().min(1).max(255),
  })
  .openapi('UpdateCategoriaRequest');

export type CategoriaDto = z.infer<typeof CategoriaDtoSchema>;
export type CreateCategoriaRequest = z.infer<typeof CreateCategoriaRequestSchema>;
export type UpdateCategoriaRequest = z.infer<typeof UpdateCategoriaRequestSchema>;

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
    description: 'Categoría no encontrada.',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
} as const;

export function registerCategoriasPaths(registry: OpenAPIRegistry): void {
  registry.register('CategoriaDto', CategoriaDtoSchema);
  registry.register('CategoriaListResponse', CategoriaListResponseSchema);
  registry.register('CreateCategoriaRequest', CreateCategoriaRequestSchema);
  registry.register('UpdateCategoriaRequest', UpdateCategoriaRequestSchema);

  registry.registerPath({
    method: 'get',
    path: '/api/categorias',
    operationId: 'GetCategorias',
    tags: ['Categorías'],
    summary: 'Obtener todas las categorías',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Lista de categorías.',
        content: { 'application/json': { schema: CategoriaListResponseSchema } },
      },
      401: errorResponses[401],
      403: errorResponses[403],
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/categorias/{id}',
    operationId: 'GetCategoriaById',
    tags: ['Categorías'],
    summary: 'Obtener una categoría por ID',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
    },
    responses: {
      200: {
        description: 'Categoría encontrada.',
        content: { 'application/json': { schema: CategoriaDtoSchema } },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/categorias',
    operationId: 'CreateCategoria',
    tags: ['Categorías'],
    summary: 'Crear una nueva categoría',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateCategoriaRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Categoría creada.',
        content: { 'application/json': { schema: CategoriaDtoSchema } },
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/categorias/{id}',
    operationId: 'UpdateCategoria',
    tags: ['Categorías'],
    summary: 'Actualizar una categoría existente',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateCategoriaRequestSchema,
          },
        },
      },
    },
    responses: {
      204: {
        description: 'Categoría actualizada.',
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/categorias/{id}',
    operationId: 'DeleteCategoria',
    tags: ['Categorías'],
    summary: 'Eliminar una categoría no protegida',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
    },
    responses: {
      204: {
        description: 'Categoría eliminada.',
      },
      400: errorResponses[400],
      401: errorResponses[401],
      403: errorResponses[403],
      404: errorResponses[404],
    },
  });
}
