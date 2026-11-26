import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const RoleNameSchema = z.enum(['Administrador', 'Usuario']);
export type RoleName = z.infer<typeof RoleNameSchema>;

export const NumericIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const ErrorResponseSchema = z
  .object({
    mensaje: z.string(),
    status: z.number().int().optional(),
    stack: z.string().optional(),
    detalles: z
      .array(
        z.object({
          path: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
  })
  .openapi('ErrorResponse');

export interface AuditContext {
  ip: string;
  actorEmail: string;
}
