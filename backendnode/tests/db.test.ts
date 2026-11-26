import { getTableConfig } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';
import type { DbClient } from '../src/db';
import {
  archivo,
  bitacora,
  categoria,
  categoriaproducto,
  producto,
  rol,
  usuario,
} from '../src/db/schema';
import {
  assertSeedAllowed,
  runSeed,
  SEED_CATEGORIA_PRODUCTOS,
  SEED_CATEGORIAS,
  SEED_PRODUCTOS,
  SEED_ROLES,
  SEED_USERS,
} from '../src/db/seed';

describe('B002 Database Schema & Idempotent Seeder', () => {
  describe('Table names & timestamps', () => {
    it.each([
      ['rol', rol],
      ['categoria', categoria],
      ['archivo', archivo],
      ['bitacora', bitacora],
      ['usuario', usuario],
      ['producto', producto],
      ['categoriaproducto', categoriaproducto],
    ])('defines singular table %s with createdAt and updatedAt', (expectedName, table) => {
      const config = getTableConfig(table);
      expect(config.name).toBe(expectedName);
      const columnNames = config.columns.map((col) => col.name);
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
    });
  });

  describe('Columns, types, unique constraints & composite PK', () => {
    it('maps archivo.datos to nullable longblob', () => {
      const config = getTableConfig(archivo);
      const datosCol = config.columns.find((col) => col.name === 'datos');
      expect(datosCol).toBeDefined();
      expect(datosCol?.getSQLType()).toBe('longblob');
      expect(datosCol?.notNull).toBe(false);
    });

    it('maps producto.precio to decimal(10, 2) NOT NULL', () => {
      const config = getTableConfig(producto);
      const precioCol = config.columns.find((col) => col.name === 'precio');
      expect(precioCol).toBeDefined();
      expect(precioCol?.getSQLType()).toBe('decimal(10,2)');
      expect(precioCol?.notNull).toBe(true);
    });

    it('defines unique constraints on usuario.email and rol.nombre', () => {
      const usuarioConfig = getTableConfig(usuario);
      const emailCol = usuarioConfig.columns.find((col) => col.name === 'email');
      expect(emailCol?.isUnique).toBe(true);

      const rolConfig = getTableConfig(rol);
      const nombreCol = rolConfig.columns.find((col) => col.name === 'nombre');
      expect(nombreCol?.isUnique).toBe(true);
    });

    it('defines composite primary key (categoriaid, productoid) on categoriaproducto', () => {
      const config = getTableConfig(categoriaproducto);
      expect(config.primaryKeys).toHaveLength(1);
      const pkColumns = config.primaryKeys[0].columns.map((col) => col.name);
      expect(pkColumns).toEqual(['categoriaid', 'productoid']);
    });
  });

  describe('Foreign keys & referential actions', () => {
    it('defines usuario.rolid -> rol.id (cascade / cascade)', () => {
      const config = getTableConfig(usuario);
      expect(config.foreignKeys).toHaveLength(1);
      const fk = config.foreignKeys[0];
      const ref = fk.reference();
      expect(ref.columns.map((c) => c.name)).toEqual(['rolid']);
      expect(getTableConfig(ref.foreignTable).name).toBe('rol');
      expect(ref.foreignColumns.map((c) => c.name)).toEqual(['id']);
      expect(fk.onUpdate).toBe('cascade');
      expect(fk.onDelete).toBe('cascade');
    });

    it('defines producto.archivoid -> archivo.id (cascade / set null)', () => {
      const config = getTableConfig(producto);
      expect(config.foreignKeys).toHaveLength(1);
      const fk = config.foreignKeys[0];
      const ref = fk.reference();
      expect(ref.columns.map((c) => c.name)).toEqual(['archivoid']);
      expect(getTableConfig(ref.foreignTable).name).toBe('archivo');
      expect(ref.foreignColumns.map((c) => c.name)).toEqual(['id']);
      expect(fk.onUpdate).toBe('cascade');
      expect(fk.onDelete).toBe('set null');
    });

    it('defines categoriaproducto FKs to categoria.id and producto.id (cascade / cascade)', () => {
      const config = getTableConfig(categoriaproducto);
      expect(config.foreignKeys).toHaveLength(2);

      const byLocalCol = new Map(
        config.foreignKeys.map((fk) => {
          const ref = fk.reference();
          return [ref.columns[0].name, { fk, ref }];
        }),
      );

      const catFk = byLocalCol.get('categoriaid');
      expect(catFk).toBeDefined();
      expect(getTableConfig(catFk!.ref.foreignTable).name).toBe('categoria');
      expect(catFk!.ref.foreignColumns[0].name).toBe('id');
      expect(catFk!.fk.onUpdate).toBe('cascade');
      expect(catFk!.fk.onDelete).toBe('cascade');

      const prodFk = byLocalCol.get('productoid');
      expect(prodFk).toBeDefined();
      expect(getTableConfig(prodFk!.ref.foreignTable).name).toBe('producto');
      expect(prodFk!.ref.foreignColumns[0].name).toBe('id');
      expect(prodFk!.fk.onUpdate).toBe('cascade');
      expect(prodFk!.fk.onDelete).toBe('cascade');
    });
  });

  describe('Lazy DB initialization', () => {
    it('imports src/db/index.ts without .env or opening live connections', async () => {
      const dbModule = await import('../src/db/index');
      expect(typeof dbModule.createDbPool).toBe('function');
      expect(typeof dbModule.createDb).toBe('function');
      expect(typeof dbModule.getDb).toBe('function');
      expect(typeof dbModule.closeDb).toBe('function');
      expect(dbModule.db).toBeDefined();
    });
  });

  describe('Seeder guard & seed datasets', () => {
    it('blocks seeding in production and allows development and test', async () => {
      expect(() => assertSeedAllowed('production')).toThrow(
        'Seeding is disabled in production environment.',
      );
      expect(() => assertSeedAllowed('development')).not.toThrow();
      expect(() => assertSeedAllowed('test')).not.toThrow();

      await expect(runSeed({} as DbClient, 'production')).rejects.toThrow(
        'Seeding is disabled in production environment.',
      );
    });

    it('defines exact SEED_ROLES, SEED_CATEGORIAS, SEED_PRODUCTOS, SEED_CATEGORIA_PRODUCTOS, and SEED_USERS', () => {
      expect(SEED_ROLES).toEqual(['Administrador', 'Usuario']);

      expect(SEED_CATEGORIAS).toHaveLength(15);
      expect(SEED_CATEGORIAS.map((c) => c.nombre)).toEqual([
        'Televisores',
        'Celulares y tecnología',
        'Laptops',
        'Electrodomésticos',
        'Hogar y muebles',
        'Moda',
        'Deportes',
        'Construcción',
        'Oficina',
        'Juguetes',
        'Bebés',
        'Salud',
        'Belleza',
        'Videojuegos',
        'Supermercado',
      ]);
      expect(SEED_CATEGORIAS.every((c, idx) => c.id === idx + 1 && c.protegida === true)).toBe(
        true,
      );

      expect(SEED_PRODUCTOS).toHaveLength(15);
      for (const [idx, prod] of SEED_PRODUCTOS.entries()) {
        expect(prod.id).toBe(idx + 1);
        expect(Number(prod.precio)).toBeGreaterThanOrEqual(0);
        expect(prod.precio).toMatch(/^\d+\.\d{2}$/);
        expect(prod.archivoid).toBeNull();
      }

      expect(SEED_CATEGORIA_PRODUCTOS).toHaveLength(15);
      for (let i = 0; i < 15; i += 1) {
        expect(SEED_CATEGORIA_PRODUCTOS[i]).toEqual({
          categoriaid: i + 1,
          productoid: i + 1,
        });
      }

      expect(SEED_USERS).toEqual([
        {
          email: 'gvera@uv.mx',
          nombre: 'Guillermo Vera',
          rol: 'Administrador',
          protegido: true,
        },
        {
          email: 'patito@uv.mx',
          nombre: 'Usuario patito',
          rol: 'Usuario',
          protegido: false,
        },
      ]);
    });
  });
});
