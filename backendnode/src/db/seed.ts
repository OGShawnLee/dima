import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { getEnv } from '../config/env';
import { closeDb, getDb, type DbClient } from './index';
import { categoria, categoriaproducto, producto, rol, usuario } from './schema';

export const SEED_ROLES = ['Administrador', 'Usuario'] as const;

export const SEED_CATEGORIAS = [
  { id: 1, nombre: 'Televisores', protegida: true },
  { id: 2, nombre: 'Celulares y tecnología', protegida: true },
  { id: 3, nombre: 'Laptops', protegida: true },
  { id: 4, nombre: 'Electrodomésticos', protegida: true },
  { id: 5, nombre: 'Hogar y muebles', protegida: true },
  { id: 6, nombre: 'Moda', protegida: true },
  { id: 7, nombre: 'Deportes', protegida: true },
  { id: 8, nombre: 'Construcción', protegida: true },
  { id: 9, nombre: 'Oficina', protegida: true },
  { id: 10, nombre: 'Juguetes', protegida: true },
  { id: 11, nombre: 'Bebés', protegida: true },
  { id: 12, nombre: 'Salud', protegida: true },
  { id: 13, nombre: 'Belleza', protegida: true },
  { id: 14, nombre: 'Videojuegos', protegida: true },
  { id: 15, nombre: 'Supermercado', protegida: true },
] as const;

export const SEED_PRODUCTOS = [
  {
    id: 1,
    titulo: 'Smart TV 55" 4K UHD',
    descripcion: 'Televisor LED 4K Ultra HD con HDR10 y sistema operativo integrado.',
    precio: '12999.00',
    archivoid: null,
  },
  {
    id: 2,
    titulo: 'Smartphone 5G 256GB',
    descripcion: 'Teléfono inteligente con pantalla AMOLED de 6.5 pulgadas y cámara triple.',
    precio: '8499.00',
    archivoid: null,
  },
  {
    id: 3,
    titulo: 'Laptop Ultrabook 14" 16GB RAM',
    descripcion: 'Computadora portátil ligera con procesador de última generación y SSD 512GB.',
    precio: '18999.00',
    archivoid: null,
  },
  {
    id: 4,
    titulo: 'Refrigerador Inverter 14 Pies',
    descripcion: 'Refrigerador de bajo consumo energético con despachador de agua.',
    precio: '11499.00',
    archivoid: null,
  },
  {
    id: 5,
    titulo: 'Sofá Modular 3 Plazas',
    descripcion: 'Sala moderna tapizada en tela antimanchas con estructura de madera.',
    precio: '9500.00',
    archivoid: null,
  },
  {
    id: 6,
    titulo: 'Chamarra Impermeable Urbana',
    descripcion: 'Chamarra ligera resistente al viento y lluvia para uso diario.',
    precio: '1299.00',
    archivoid: null,
  },
  {
    id: 7,
    titulo: 'Bicicleta de Montaña R29',
    descripcion: 'Bicicleta con cuadro de aluminio, 21 velocidades y frenos de disco.',
    precio: '6499.00',
    archivoid: null,
  },
  {
    id: 8,
    titulo: 'Taladro Percutor Inalámbrico 20V',
    descripcion: 'Kit de taladro recargable con dos baterías de litio y maletín.',
    precio: '2399.00',
    archivoid: null,
  },
  {
    id: 9,
    titulo: 'Silla Ergonómica de Oficina',
    descripcion: 'Silla con soporte lumbar ajustable, respaldo de malla y pistón neumático.',
    precio: '3299.00',
    archivoid: null,
  },
  {
    id: 10,
    titulo: 'Set de Bloques de Construcción 500 Piezas',
    descripcion: 'Juego didáctico de bloques creativos compatible con sets estándar.',
    precio: '799.00',
    archivoid: null,
  },
  {
    id: 11,
    titulo: 'Carriola Plegable Ligera',
    descripcion: 'Carriola compacta con arnés de 5 puntos y toldo con protección UV.',
    precio: '3899.00',
    archivoid: null,
  },
  {
    id: 12,
    titulo: 'Baumanómetro Digital de Brazo',
    descripcion: 'Monitor automático de presión arterial con memoria para dos usuarios.',
    precio: '899.00',
    archivoid: null,
  },
  {
    id: 13,
    titulo: 'Secadora de Cabello Iónica 2000W',
    descripcion: 'Secadora profesional con control de temperatura y boquilla concentradora.',
    precio: '1150.00',
    archivoid: null,
  },
  {
    id: 14,
    titulo: 'Consola Portátil 512GB',
    descripcion: 'Consola de videojuegos de alto rendimiento con pantalla táctil Full HD.',
    precio: '13499.00',
    archivoid: null,
  },
  {
    id: 15,
    titulo: 'Café Molido Orgánico 1kg',
    descripcion: 'Café de altura tostado medio con notas de chocolate y nuez.',
    precio: '349.00',
    archivoid: null,
  },
] as const;

export const SEED_CATEGORIA_PRODUCTOS = SEED_CATEGORIAS.map((cat) => ({
  categoriaid: cat.id,
  productoid: cat.id,
}));

export const SEED_USERS = [
  {
    email: 'gvera@uv.mx',
    nombre: 'Guillermo Vera',
    rol: 'Administrador' as const,
    protegido: true,
  },
  {
    email: 'patito@uv.mx',
    nombre: 'Usuario patito',
    rol: 'Usuario' as const,
    protegido: false,
  },
] as const;

export function assertSeedAllowed(nodeEnv: string): void {
  if (nodeEnv === 'production') {
    throw new Error('Seeding is disabled in production environment.');
  }
}

export async function runSeed(dbClient: DbClient, nodeEnv: string): Promise<void> {
  assertSeedAllowed(nodeEnv);

  const roleIdByName = new Map<(typeof SEED_ROLES)[number], string>();

  for (const roleName of SEED_ROLES) {
    const existing = await dbClient
      .select({ id: rol.id })
      .from(rol)
      .where(eq(rol.nombre, roleName))
      .limit(1);

    if (existing.length > 0) {
      roleIdByName.set(roleName, existing[0].id);
    } else {
      const id = crypto.randomUUID();
      await dbClient
        .insert(rol)
        .values({ id, nombre: roleName })
        .onDuplicateKeyUpdate({ set: { nombre: roleName } });
      const resolved = await dbClient
        .select({ id: rol.id })
        .from(rol)
        .where(eq(rol.nombre, roleName))
        .limit(1);
      roleIdByName.set(roleName, resolved[0]?.id ?? id);
    }
  }

  for (const userSeed of SEED_USERS) {
    const rolid = roleIdByName.get(userSeed.rol);
    if (!rolid) {
      throw new Error(`Missing seeded role: ${userSeed.rol}`);
    }

    const existingUser = await dbClient
      .select({ id: usuario.id })
      .from(usuario)
      .where(eq(usuario.email, userSeed.email))
      .limit(1);

    if (existingUser.length === 0) {
      const passwordhash = await bcrypt.hash('patito', 10);
      await dbClient
        .insert(usuario)
        .values({
          id: crypto.randomUUID(),
          email: userSeed.email,
          passwordhash,
          nombre: userSeed.nombre,
          protegido: userSeed.protegido,
          rolid,
        })
        .onDuplicateKeyUpdate({
          set: {
            nombre: userSeed.nombre,
            protegido: userSeed.protegido,
            rolid,
          },
        });
    } else {
      await dbClient
        .update(usuario)
        .set({
          nombre: userSeed.nombre,
          protegido: userSeed.protegido,
          rolid,
        })
        .where(eq(usuario.email, userSeed.email));
    }
  }

  for (const cat of SEED_CATEGORIAS) {
    await dbClient
      .insert(categoria)
      .values({
        id: cat.id,
        nombre: cat.nombre,
        protegida: cat.protegida,
      })
      .onDuplicateKeyUpdate({
        set: {
          nombre: cat.nombre,
          protegida: cat.protegida,
        },
      });
  }

  for (const prod of SEED_PRODUCTOS) {
    await dbClient
      .insert(producto)
      .values({
        id: prod.id,
        titulo: prod.titulo,
        descripcion: prod.descripcion,
        precio: prod.precio,
        archivoid: prod.archivoid,
      })
      .onDuplicateKeyUpdate({
        set: {
          titulo: prod.titulo,
          descripcion: prod.descripcion,
          precio: prod.precio,
        },
      });
  }

  for (const link of SEED_CATEGORIA_PRODUCTOS) {
    await dbClient
      .insert(categoriaproducto)
      .values({
        categoriaid: link.categoriaid,
        productoid: link.productoid,
      })
      .onDuplicateKeyUpdate({
        set: {
          categoriaid: link.categoriaid,
        },
      });
  }
}

if (require.main === module) {
  const env = getEnv();
  runSeed(getDb(), env.NODE_ENV)
    .then(async () => {
      console.log('Database seeded successfully.');
      await closeDb();
    })
    .catch(async (err: unknown) => {
      console.error('Database seed failed:', err);
      await closeDb();
      process.exit(1);
    });
}
