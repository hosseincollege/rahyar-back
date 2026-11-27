# Agent Workflow

## Local source and Vercel

- For routine feature work and fixes, make and validate changes in the local project only. Do not deploy to Vercel directly; the user will commit/push through Git and let the connected Vercel project deploy from that source.
- Keep local source as the source of truth. Do not make dashboard-only or production-only changes that are absent from the repository.
- Direct Vercel changes or deployments are reserved for an active production incident when they are necessary to restore service. Keep the corresponding source change in the repository so Git-based deployments do not undo the fix.
- Do not commit, push, or deploy unless the user explicitly asks for that action.

## Independent Rahyar backend scope

- This repository is the Rahyar backend only. ERP and Rahyar are independent products; do not sync ERP backend changes unless cross-product work is explicitly requested.
- Rahyar product modules are Rahcom, Settings, and Development only. Do not expose or add APIs for Dashboard or other business modules as Rahyar product features.
- Keep Rahyar API host/port, deployment settings, secrets, database, and migration history independent from ERP. Never reuse ERP connections or data.
- Preserve Rahyar DATABASE_URL_POOLED handling and main.ts runtime configuration.
- Inspect this repository Git status and diffs before editing; preserve unrelated work. Do not run migrations unless explicitly requested.
- Bill identifier assignments support only Rahcom, USO, and VSAT families. Do not add other system families to backend validation or persistence.
- The user will move project folders. Do not move or rename directories.

## Rahyar product objective

- Build an independent multi-province system monitoring and fault management service. Authorized users must be able to find systems in their assigned province, understand failures, record repair work, and coordinate maintenance.
- During audits, follow each workflow end to end across UI, API, authorization, and persistence. Verify organization and province scoping for every read, write, import, export, and aggregate; never infer access from client-supplied province values alone.
- **Rahcom province prerequisite:** Every Rahcom data operation requires at least one active organization branch mapped to a supported Rahcom province and the current user must either have a province assignment or explicitly select one in the top header. A single configured province must never be auto-selected. `/rahcom/me` may return the configured province IDs and access state for the selector; all other Rahcom operations must enforce both the user's province eligibility and organization scope.
- Keep the Rahyar product surface limited to Rahcom, Settings, and Development. Do not restore ERP business modules or ERP-specific roadmap assumptions.

## Local Windows server configuration

- Keep local development on API port 3016 and the Windows server API on port 3116, bound to loopback behind Caddy.
- Rahyar has no demo login or demo account. Do not seed a demo user or membership in test-data setup.
- For authorized Windows server database updates, apply checked-in migrations with `npm exec -- prisma migrate deploy --schema=prisma/schema`; preserve the existing database and migration history.
