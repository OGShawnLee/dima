import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { registerArchivosPaths } from '../schemas/archivos.schema';
import { registerAuthPaths } from '../schemas/auth.schema';
import { registerBitacoraPaths } from '../schemas/bitacora.schema';
import { registerCategoriasPaths } from '../schemas/categorias.schema';
import { ErrorResponseSchema } from '../schemas/common.schema';
import { registerPedidosPaths } from '../schemas/pedidos.schema';
import { registerProductosPaths } from '../schemas/productos.schema';
import { registerRolesPaths } from '../schemas/roles.schema';
import { registerUsuariosPaths } from '../schemas/usuarios.schema';

export function generateOpenApiDocument(): OpenAPIObject {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  registry.register('ErrorResponse', ErrorResponseSchema);

  registerAuthPaths(registry);
  registerBitacoraPaths(registry);
  registerRolesPaths(registry);
  registerUsuariosPaths(registry);
  registerCategoriasPaths(registry);
  registerProductosPaths(registry);
  registerPedidosPaths(registry);
  registerArchivosPaths(registry);

  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Dima Backend API',
      version: '1.0.0',
      description: 'Stateless TypeScript REST API for Dima (Secure Programming)',
    },
    servers: [{ url: 'http://localhost:3000' }],
  });
}
