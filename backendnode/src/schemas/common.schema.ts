import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const RoleNameSchema = z.enum(['Administrador', 'Usuario']);
export type RoleName = z.infer<typeof RoleNameSchema>;

export const StrongPasswordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres.')
  .max(128, 'La contraseña no puede exceder 128 caracteres.')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula.')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula.')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un dígito.')
  .regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir al menos un símbolo.');

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
