# Rahyar deployment and database setup

## Local PostgreSQL

1. Create a PostgreSQL database named `rahyar_dev` using pgAdmin or `createdb`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to the local database credentials.
3. Set `JWT_SECRET` to a long random secret. Do not commit `.env`.
4. Run `npm run db:push` to create/update tables from `prisma/schema`.
5. Start the API with `npm run start:dev` (port `3016`) and the frontend with `npm run dev` (port `3015`).

## Vercel

The frontend deployment is `https://rahyar-front.vercel.app` and its API is `https://rahyar-back-piuy.vercel.app`.

Set these project environment variables in Vercel, then redeploy:

- **Frontend project:** `NEXT_PUBLIC_API_BASE_URL=https://rahyar-back-piuy.vercel.app`
- **Backend project:** `DATABASE_URL=<connection string for a hosted PostgreSQL database>`
- **Backend project (recommended for Vercel Functions):** `DATABASE_URL_POOLED=<pooled Prisma Postgres connection string>`
- **Backend project:** `JWT_SECRET=<long random private secret>`
- **Backend project (optional):** `JWT_EXPIRES_IN=86400`
- **Backend project (optional):** `RAHYAR_FRONTEND_ORIGINS=<comma-separated exact Rahyar frontend origins>` for additional preview deployments. The API accepts the production Rahyar frontend and local port `3015` by default; it does not allow arbitrary Vercel origins.

The Prisma Postgres Vercel integration sets `DATABASE_URL` to a direct connection string. Keep it for Prisma CLI operations such as `db:push`; for production function traffic, create a pooled connection string in Prisma Console and add it to the backend project as `DATABASE_URL_POOLED`. The API uses `DATABASE_URL_POOLED` when present and falls back to `DATABASE_URL`. The PostgreSQL service installed on a developer's computer is not reachable by Vercel; do not expose the local database to the public internet. The backend's Vercel function is routed through `api/index.ts` by `vercel.json`.

To initialize the hosted database, temporarily set the hosted `DATABASE_URL` in the backend environment and run `npm run db:push` from a trusted machine. Keep the connection string private and remove it from the local environment when finished.
