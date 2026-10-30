# Rahyar Backend

Standalone NestJS and Prisma API for Rahyar. Rahyar and ERP use independent code, deployments, authentication secrets, databases, and migration histories. This backend serves Rahcom, Settings, and Development.

## Local setup

```bash
npm install
npm run start:dev
```

The API listens on port `3016` by default. Configure a private `JWT_SECRET` and Rahyar's PostgreSQL connection in `.env`; see [DEPLOYMENT.md](DEPLOYMENT.md) for environment and hosting details. `DATABASE_URL_POOLED` is used for runtime database connections when configured.

## Build

```bash
npm run build
```

## Database changes

Prisma schemas live in `prisma/schema/`; versioned migrations live in `prisma/migrations/`. Review migrations against Rahyar's database before applying them. Never point Prisma at an ERP database or copy ERP data, secrets, or deployment configuration into this project.
