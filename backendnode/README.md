# Dima Backend (`backendnode`)

Node.js + TypeScript + Express + Drizzle ORM + MySQL 8.0 API server for Dima.

## Quick Setup (Teammates)

Run these commands inside `backendnode/`:

```bash
npm ci
npm run setup:env
npm run setup:db
npm run db:seed
npm run dev
```

### What the Setup Scripts Do

1. **`npm run setup:env`** (`scripts/setup-env.mjs`)
   - Prompts for local DB settings (masked `DB_PASSWORD`) and generates a fresh 70-character hex `JWT_SECRET`.
   - Refuses to overwrite an existing `.env` unless `--force` is passed.
   - Refuses `DB_USER=root` or an empty `DB_PASSWORD`.
   - Creates `log/` and `uploads/` runtime directories.
   - Supports `--non-interactive` for automation.

2. **`npm run setup:db`** (`scripts/setup-db.mjs`)
   - Prompts once (masked) for your local MySQL `root` password.
   - Applies the authoritative pure-DDL schema at `db/SCHEMA.sql`.
   - Creates/updates `DB_USER` from `.env` with **least-privilege DML grants only** (`SELECT, INSERT, UPDATE, DELETE` on `DB_DATABASE.*`).
   - Optionally pass `--seed` (`npm run setup:db -- --seed`) to run `npm run db:seed` afterward (blocked when `NODE_ENV=production`).

## Drizzle Introspection (`db:pull`)

`npm run db:pull` works even with the least-privilege `SELECT, INSERT, UPDATE, DELETE` runtime user because MySQL exposes table metadata via `INFORMATION_SCHEMA`. Keep `db/SCHEMA.sql` and `src/db/schema.ts` aligned 1:1.

## Manual `mysql` Fallback

If you prefer to apply the DDL manually:

```bash
mysql -u root -p < db/SCHEMA.sql
```

Then create a dedicated non-root application user matching `.env` with `SELECT, INSERT, UPDATE, DELETE` privileges on `mercadolibrenode.*`.

## Verification Gates

```bash
npm run typecheck
npm run build
npm test
```

## Production Deployment (`deploy/`)

Production deployment templates for the `api` (`10.10.10.20`) and `db` (`10.10.10.30`) servers—including `backendnode.service`, `nginx-api.conf`, `install-api.sh`, `install-db.sh`, nightly `backup-db.timer`, and the lightweight Windows `vagrant up db` dev workflow—are documented in [deploy/README.md](deploy/README.md).
