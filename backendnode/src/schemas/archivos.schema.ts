import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { ErrorResponseSchema, NumericIdParamSchema } from './common.schema';

export const ArchivoMetadataDtoSchema = z
  .object({
    archivoId: z.number().int().positive(),
    mime: z.literal('image/jpeg'),
    indb: z.boolean(),
    nombre: z.string(),
    size: z.number().int().positive(),
  })
  .openapi('ArchivoMetadataDto');

export const ArchivoListResponseSchema = z
  .array(ArchivoMetadataDtoSchema)
  .openapi('ArchivoListResponse');

export type ArchivoMetadataDto = z.infer<typeof ArchivoMetadataDtoSchema>;

const MultipartFileSchema = z.object({
  file: z.string().openapi({ format: 'binary' }),
});

const BinaryJpegSchema = z.string().openapi({ format: 'binary' });

export function registerArchivosPaths(registry: OpenAPIRegistry): void {
  registry.register('ArchivoMetadataDto', ArchivoMetadataDtoSchema);
  registry.register('ArchivoListResponse', ArchivoListResponseSchema);

  registry.registerPath({
    method: 'get',
    path: '/api/archivos',
    operationId: 'GetArchivos',
    tags: ['Archivos'],
    summary: 'Listar metadatos de archivos',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Lista de metadatos de archivos registrados.',
        content: {
          'application/json': {
            schema: ArchivoListResponseSchema,
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
    path: '/api/archivos/{id}',
    operationId: 'DownloadArchivo',
    tags: ['Archivos'],
    summary: 'Descargar binario de imagen JPEG',
    request: {
      params: NumericIdParamSchema,
    },
    responses: {
      200: {
        description: 'Contenido binario de la imagen JPEG.',
        content: {
          'image/jpeg': {
            schema: BinaryJpegSchema,
          },
        },
      },
      400: {
        description: 'Identificador inválido.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Archivo no encontrado.',
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
    path: '/api/archivos/{id}/detalle',
    operationId: 'GetArchivoDetalle',
    tags: ['Archivos'],
    summary: 'Obtener metadatos de un archivo',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
    },
    responses: {
      200: {
        description: 'Metadatos del archivo.',
        content: {
          'application/json': {
            schema: ArchivoMetadataDtoSchema,
          },
        },
      },
      400: {
        description: 'Identificador inválido.',
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
        description: 'Acceso prohibido (requiere rol Administrador).',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Archivo no encontrado.',
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
    path: '/api/archivos',
    operationId: 'UploadArchivo',
    tags: ['Archivos'],
    summary: 'Subir una imagen JPEG',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: MultipartFileSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Archivo almacenado correctamente.',
        content: {
          'application/json': {
            schema: ArchivoMetadataDtoSchema,
          },
        },
      },
      400: {
        description: 'Archivo faltante, inválido o excede 100 KB.',
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
    method: 'put',
    path: '/api/archivos/{id}',
    operationId: 'ReplaceArchivo',
    tags: ['Archivos'],
    summary: 'Reemplazar una imagen JPEG existente',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: MultipartFileSchema,
          },
        },
      },
    },
    responses: {
      204: {
        description: 'Archivo reemplazado correctamente.',
      },
      400: {
        description: 'Identificador o archivo inválido.',
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
        description: 'Acceso prohibido (requiere rol Administrador).',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Archivo no encontrado.',
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
    path: '/api/archivos/{id}',
    operationId: 'DeleteArchivo',
    tags: ['Archivos'],
    summary: 'Eliminar un archivo',
    security: [{ bearerAuth: [] }],
    request: {
      params: NumericIdParamSchema,
    },
    responses: {
      204: {
        description: 'Archivo eliminado correctamente.',
      },
      400: {
        description: 'Identificador inválido.',
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
        description: 'Acceso prohibido (requiere rol Administrador).',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Archivo no encontrado.',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });
}
