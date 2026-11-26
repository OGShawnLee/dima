import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  datetime,
  decimal,
  int,
  mysqlTable,
  primaryKey,
  text,
  varchar,
} from 'drizzle-orm/mysql-core';

const longblob = customType<{ data: Buffer }>({
  dataType() {
    return 'longblob';
  },
});

const timestamps = {
  createdAt: datetime('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updatedAt')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => new Date()),
};

// Layer 0 (Foundational tables with no foreign keys)

export const rol = mysqlTable('rol', {
  id: varchar('id', { length: 36 }).primaryKey(),
  nombre: varchar('nombre', { length: 255 }).notNull().unique(),
  ...timestamps,
});

export const categoria = mysqlTable('categoria', {
  id: int('id').autoincrement().primaryKey(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  protegida: boolean('protegida').notNull().default(false),
  ...timestamps,
});

export const archivo = mysqlTable('archivo', {
  id: int('id').autoincrement().primaryKey(),
  mime: varchar('mime', { length: 255 }).notNull(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  size: int('size').notNull(),
  indb: boolean('indb').notNull().default(true),
  datos: longblob('datos'),
  ...timestamps,
});

export const bitacora = mysqlTable('bitacora', {
  id: int('id').autoincrement().primaryKey(),
  accion: varchar('accion', { length: 255 }).notNull(),
  elementoid: varchar('elementoid', { length: 255 }),
  ip: varchar('ip', { length: 255 }).notNull(),
  usuario: varchar('usuario', { length: 255 }).notNull(),
  fecha: datetime('fecha').notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
});

// Layer 1 (Dependent entities referencing Layer 0)

export const usuario = mysqlTable('usuario', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordhash: varchar('passwordhash', { length: 255 }).notNull(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  protegido: boolean('protegido').notNull().default(false),
  rolid: varchar('rolid', { length: 36 })
    .notNull()
    .references(() => rol.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  ...timestamps,
});

export const producto = mysqlTable('producto', {
  id: int('id').autoincrement().primaryKey(),
  titulo: varchar('titulo', { length: 255 }).notNull().default('Sin título'),
  descripcion: text('descripcion').notNull(),
  precio: decimal('precio', { precision: 10, scale: 2 }).notNull(),
  archivoid: int('archivoid').references(() => archivo.id, {
    onUpdate: 'cascade',
    onDelete: 'set null',
  }),
  ...timestamps,
});

// Layer 2 (Join tables)

export const categoriaproducto = mysqlTable(
  'categoriaproducto',
  {
    categoriaid: int('categoriaid')
      .notNull()
      .references(() => categoria.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    productoid: int('productoid')
      .notNull()
      .references(() => producto.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.categoriaid, table.productoid] })],
);

// Drizzle Relations

export const rolRelations = relations(rol, ({ many }) => ({
  usuarios: many(usuario),
}));

export const usuarioRelations = relations(usuario, ({ one }) => ({
  rol: one(rol, {
    fields: [usuario.rolid],
    references: [rol.id],
  }),
}));

export const archivoRelations = relations(archivo, ({ many }) => ({
  productos: many(producto),
}));

export const categoriaRelations = relations(categoria, ({ many }) => ({
  categoriaproductos: many(categoriaproducto),
}));

export const productoRelations = relations(producto, ({ one, many }) => ({
  archivo: one(archivo, {
    fields: [producto.archivoid],
    references: [archivo.id],
  }),
  categoriaproductos: many(categoriaproducto),
}));

export const categoriaproductoRelations = relations(categoriaproducto, ({ one }) => ({
  categoria: one(categoria, {
    fields: [categoriaproducto.categoriaid],
    references: [categoria.id],
  }),
  producto: one(producto, {
    fields: [categoriaproducto.productoid],
    references: [producto.id],
  }),
}));

// Inferred Select / Insert Types

export type Rol = typeof rol.$inferSelect;
export type NewRol = typeof rol.$inferInsert;

export type Categoria = typeof categoria.$inferSelect;
export type NewCategoria = typeof categoria.$inferInsert;

export type Archivo = typeof archivo.$inferSelect;
export type NewArchivo = typeof archivo.$inferInsert;

export type Bitacora = typeof bitacora.$inferSelect;
export type NewBitacora = typeof bitacora.$inferInsert;

export type Usuario = typeof usuario.$inferSelect;
export type NewUsuario = typeof usuario.$inferInsert;

export type Producto = typeof producto.$inferSelect;
export type NewProducto = typeof producto.$inferInsert;

export type CategoriaProducto = typeof categoriaproducto.$inferSelect;
export type NewCategoriaProducto = typeof categoriaproducto.$inferInsert;
