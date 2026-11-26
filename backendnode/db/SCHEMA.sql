-- Dima Authoritative Database Schema (MySQL 8.0 Pure DDL)
-- Aligned 1:1 with backendnode/src/db/schema.ts (DEC-002 & DEC-012).
-- Contains pure DDL only: no account statements, privileges, credentials, or seed data.

CREATE DATABASE IF NOT EXISTS `mercadolibrenode`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `mercadolibrenode`;

-- Layer 0: Foundational tables with no foreign keys

CREATE TABLE IF NOT EXISTS `rol` (
  `id` VARCHAR(36) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rol_nombre_unique` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categoria` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(255) NOT NULL,
  `protegida` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `archivo` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `mime` VARCHAR(255) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `size` INT NOT NULL,
  `indb` BOOLEAN NOT NULL DEFAULT TRUE,
  `datos` LONGBLOB NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bitacora` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `accion` VARCHAR(255) NOT NULL,
  `elementoid` VARCHAR(255) NULL,
  `ip` VARCHAR(255) NOT NULL,
  `usuario` VARCHAR(255) NOT NULL,
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Layer 1: Dependent entities referencing Layer 0

CREATE TABLE IF NOT EXISTS `usuario` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `passwordhash` VARCHAR(255) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `protegido` BOOLEAN NOT NULL DEFAULT FALSE,
  `rolid` VARCHAR(36) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario_email_unique` (`email`),
  CONSTRAINT `fk_usuario_rol`
    FOREIGN KEY (`rolid`) REFERENCES `rol` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `producto` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(255) NOT NULL DEFAULT 'Sin título',
  `descripcion` TEXT NOT NULL,
  `precio` DECIMAL(10,2) NOT NULL,
  `archivoid` INT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_producto_archivo`
    FOREIGN KEY (`archivoid`) REFERENCES `archivo` (`id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Layer 2: Join tables

CREATE TABLE IF NOT EXISTS `categoriaproducto` (
  `categoriaid` INT NOT NULL,
  `productoid` INT NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`categoriaid`, `productoid`),
  CONSTRAINT `fk_categoriaproducto_categoria`
    FOREIGN KEY (`categoriaid`) REFERENCES `categoria` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT `fk_categoriaproducto_producto`
    FOREIGN KEY (`productoid`) REFERENCES `producto` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
