# Database Switching Guide

This project uses different databases for different branches:

- **Main branch**: `app` database
- **Test branch (SMB Marketplace)**: `app_test` database

## Current Setup

The `.env` file is currently configured for the **test branch** (`app_test`).

## Switching to Main Branch Database

When you switch back to the main branch, update the `.env` file:

```bash
# In apps/api/.env
DATABASE_URL="postgresql://dev:dev@127.0.0.1:5432/app"
```

A backup of the original main branch config is saved as `.env.main-backup`.

## Switching to Test Branch Database

When working on the test branch, use:

```bash
# In apps/api/.env
DATABASE_URL="postgresql://dev:dev@localhost:5432/app_test"
```

## Creating the Test Database

The test database `app_test` has been created. To recreate it if needed:

```bash
docker exec postgres psql -U dev -d postgres -c "DROP DATABASE IF EXISTS app_test;"
docker exec postgres psql -U dev -d postgres -c "CREATE DATABASE app_test;"
```

Then run migrations:
```bash
cd apps/api
npx prisma migrate deploy
```

