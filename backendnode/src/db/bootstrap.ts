import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { StrongPasswordSchema } from '../schemas/common.schema';
import { closeDb, getDb, type DbClient } from './index';
import { usuario } from './schema';
import { seedRolesAndCatalog } from './seed';

export interface ProductionBootstrapOptions {
  adminEmail: string;
  adminPassword: string;
  adminNombre?: string;
  userEmail?: string;
  userPassword?: string;
  userNombre?: string;
}

const EmailSchema = z
  .string()
  .trim()
  .min(1, 'El correo electrónico es obligatorio.')
  .email('El correo electrónico no tiene un formato válido.')
  .transform((value) => value.toLowerCase());

async function upsertBootstrapUser(
  dbClient: DbClient,
  params: {
    email: string;
    password: string;
    nombre: string;
    protegido: boolean;
    rolid: string;
  },
): Promise<void> {
  const passwordhash = await bcrypt.hash(params.password, 10);
  const existing = await dbClient
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.email, params.email))
    .limit(1);

  if (existing.length === 0) {
    await dbClient
      .insert(usuario)
      .values({
        id: crypto.randomUUID(),
        email: params.email,
        passwordhash,
        nombre: params.nombre,
        protegido: params.protegido,
        rolid: params.rolid,
      })
      .onDuplicateKeyUpdate({
        set: {
          passwordhash,
          nombre: params.nombre,
          protegido: params.protegido,
          rolid: params.rolid,
        },
      });
  } else {
    await dbClient
      .update(usuario)
      .set({
        passwordhash,
        nombre: params.nombre,
        protegido: params.protegido,
        rolid: params.rolid,
      })
      .where(eq(usuario.email, params.email));
  }
}

/**
 * Idempotently initializes roles, catalog data, and a protected Administrador
 * account for production using operator-supplied strong credentials.
 */
export async function runProductionBootstrap(
  dbClient: DbClient,
  options: ProductionBootstrapOptions,
): Promise<void> {
  const adminEmail = EmailSchema.parse(options.adminEmail);
  const adminPassword = StrongPasswordSchema.parse(options.adminPassword);
  const adminNombre = options.adminNombre?.trim() || 'Administrador';

  const hasUserEmail = Boolean(options.userEmail?.trim());
  const hasUserPassword = Boolean(options.userPassword);
  if (hasUserEmail !== hasUserPassword) {
    throw new Error('USER_EMAIL and USER_PASSWORD must both be provided together.');
  }

  let validatedUser: { email: string; password: string; nombre: string } | null = null;
  if (hasUserEmail && hasUserPassword) {
    validatedUser = {
      email: EmailSchema.parse(options.userEmail),
      password: StrongPasswordSchema.parse(options.userPassword),
      nombre: options.userNombre?.trim() || 'Usuario',
    };
  }

  const roleIdByName = await seedRolesAndCatalog(dbClient);
  const adminRoleId = roleIdByName.get('Administrador');
  if (!adminRoleId) {
    throw new Error('Missing Administrador role after catalog bootstrap.');
  }

  await upsertBootstrapUser(dbClient, {
    email: adminEmail,
    password: adminPassword,
    nombre: adminNombre,
    protegido: true,
    rolid: adminRoleId,
  });

  if (validatedUser) {
    const userRoleId = roleIdByName.get('Usuario');
    if (!userRoleId) {
      throw new Error('Missing Usuario role after catalog bootstrap.');
    }
    await upsertBootstrapUser(dbClient, {
      email: validatedUser.email,
      password: validatedUser.password,
      nombre: validatedUser.nombre,
      protegido: false,
      rolid: userRoleId,
    });
  }
}

if (require.main === module) {
  runProductionBootstrap(getDb(), {
    adminEmail: process.env.ADMIN_EMAIL ?? '',
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
    adminNombre: process.env.ADMIN_NOMBRE,
    userEmail: process.env.USER_EMAIL,
    userPassword: process.env.USER_PASSWORD,
    userNombre: process.env.USER_NOMBRE,
  })
    .then(async () => {
      console.log('Production database bootstrap completed successfully.');
      await closeDb();
    })
    .catch(async (err: unknown) => {
      console.error('Production database bootstrap failed:', err);
      await closeDb();
      process.exit(1);
    });
}
