import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

interface OpenApiOperation {
  operationId?: string;
  security?: Array<Record<string, string[]>>;
  requestBody?: {
    content?: Record<string, unknown>;
  };
  responses?: Record<
    string,
    {
      content?: Record<string, unknown>;
    }
  >;
}

interface OpenApiDoc {
  openapi: string;
  components?: {
    securitySchemes?: Record<string, unknown>;
    schemas?: Record<string, unknown>;
  };
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

const EXPECTED_SCHEMAS = [
  'LoginRequest',
  'LoginResponse',
  'TokenTimeResponse',
  'BitacoraDto',
  'RolDto',
  'UsuarioDto',
  'CreateUsuarioRequest',
  'UpdateUsuarioRequest',
  'CategoriaDto',
  'CreateCategoriaRequest',
  'UpdateCategoriaRequest',
  'ProductoDto',
  'CreateProductoRequest',
  'UpdateProductoRequest',
  'AssignCategoriaRequest',
  'ArchivoMetadataDto',
  'ErrorResponse',
] as const;

const EXPECTED_OPERATION_IDS = [
  // Auth
  'Login',
  'GetTokenRemainingTime',
  // Bitácora
  'GetBitacora',
  // Roles
  'GetRoles',
  // Usuarios
  'GetUsuarios',
  'GetUsuarioByEmail',
  'CreateUsuario',
  'UpdateUsuario',
  'DeleteUsuario',
  // Categorías
  'GetCategorias',
  'GetCategoriaById',
  'CreateCategoria',
  'UpdateCategoria',
  'DeleteCategoria',
  // Productos
  'GetProductos',
  'GetProductoById',
  'CreateProducto',
  'UpdateProducto',
  'DeleteProducto',
  'AssignProductoCategoria',
  'RemoveProductoCategoria',
  // Archivos
  'GetArchivos',
  'DownloadArchivo',
  'GetArchivoDetalle',
  'UploadArchivo',
  'ReplaceArchivo',
  'DeleteArchivo',
] as const;

const PUBLIC_OPERATION_IDS = new Set(['Login', 'DownloadArchivo']);

describe('B008 OpenAPI 3.0.3 Registry, Full Route Wiring & Integration Suite', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempLogFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dima-b008-'));
    tempDirs.push(dir);
    return path.join(dir, 'log.txt');
  }

  describe('GET /openapi.json', () => {
    it('returns valid OpenAPI 3.0.3 with bearerAuth, all 17 named schemas, and all operationIds', async () => {
      const app = createApp({ logFilePath: createTempLogFile(), nodeEnv: 'test' });
      const res = await request(app).get('/openapi.json');

      expect(res.status).toBe(200);
      const doc = res.body as OpenApiDoc;

      expect(doc.openapi).toBe('3.0.3');
      expect(doc.components?.securitySchemes?.bearerAuth).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });

      const schemaNames = Object.keys(doc.components?.schemas ?? {});
      for (const expectedSchema of EXPECTED_SCHEMAS) {
        expect(schemaNames).toContain(expectedSchema);
      }

      const operationsById = new Map<string, OpenApiOperation>();
      for (const pathItem of Object.values(doc.paths ?? {})) {
        for (const operation of Object.values(pathItem)) {
          if (operation.operationId) {
            operationsById.set(operation.operationId, operation);
          }
        }
      }

      for (const opId of EXPECTED_OPERATION_IDS) {
        const op = operationsById.get(opId);
        expect(op, `Missing operationId ${opId}`).toBeDefined();
        if (PUBLIC_OPERATION_IDS.has(opId)) {
          expect(op?.security).toBeUndefined();
        } else {
          expect(op?.security).toEqual([{ bearerAuth: [] }]);
        }
      }

      expect(operationsById.size).toBe(EXPECTED_OPERATION_IDS.length);

      expect(operationsById.get('GetTokenRemainingTime')?.responses?.['200']?.content).toHaveProperty(
        'text/plain',
      );
      expect(operationsById.get('DownloadArchivo')?.responses?.['200']?.content).toHaveProperty(
        'image/jpeg',
      );
      expect(operationsById.get('UploadArchivo')?.requestBody?.content).toHaveProperty(
        'multipart/form-data',
      );
      expect(operationsById.get('ReplaceArchivo')?.requestBody?.content).toHaveProperty(
        'multipart/form-data',
      );
    });
  });

  describe('Documentation UIs (/swagger and /docs)', () => {
    it('serves Swagger UI at /swagger/ and Scalar API Reference at /docs with 200 HTML', async () => {
      const app = createApp({ logFilePath: createTempLogFile(), nodeEnv: 'test' });

      const swaggerRes = await request(app).get('/swagger/');
      expect(swaggerRes.status).toBe(200);
      expect(swaggerRes.headers['content-type']).toMatch(/text\/html/);

      const docsRes = await request(app).get('/docs');
      expect(docsRes.status).toBe(200);
      expect(docsRes.headers['content-type']).toMatch(/text\/html/);
      expect(docsRes.text).toContain('/openapi.json');
    });
  });

  describe('Full Wired-App Security Smoke Tests', () => {
    it.each([
      '/api/bitacora',
      '/api/roles',
      '/api/usuarios',
      '/api/categorias',
      '/api/productos',
      '/api/archivos',
      '/api/auth/tiempo',
    ])('rejects unauthenticated GET %s with 401 and keeps helmet headers active', async (route) => {
      const app = createApp({ logFilePath: createTempLogFile(), nodeEnv: 'test' });
      const res = await request(app).get(route);

      expect(res.status).toBe(401);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('validates POST /api/auth body with 400 and structured detalles', async () => {
      const app = createApp({ logFilePath: createTempLogFile(), nodeEnv: 'test' });
      const res = await request(app).post('/api/auth').send({ email: 'not-an-email', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.mensaje).toBe('Datos de entrada inválidos.');
      expect(Array.isArray(res.body.detalles)).toBe(true);
      expect(res.body.detalles.length).toBeGreaterThan(0);
    });
  });
});
