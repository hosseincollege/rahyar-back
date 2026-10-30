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
- The user will move project folders. Do not move or rename directories.

## Rahyar product objective

- Build an independent multi-province system monitoring and fault management service. Authorized users must be able to find systems in their assigned province, understand failures, record repair work, and coordinate maintenance.
- During audits, follow each workflow end to end across UI, API, authorization, and persistence. Verify organization and province scoping for every read, write, import, export, and aggregate; never infer access from client-supplied province values alone.
- Keep the Rahyar product surface limited to Rahcom, Settings, and Development. Do not restore ERP business modules or ERP-specific roadmap assumptions.
