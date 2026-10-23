# Agent Workflow

## Local source and Vercel

- For routine feature work and fixes, make and validate changes in the local project only. Do not deploy to Vercel directly; the user will commit/push through Git and let the connected Vercel project deploy from that source.
- Keep local source as the source of truth. Do not make dashboard-only or production-only changes that are absent from the repository.
- Direct Vercel changes or deployments are reserved for an active production incident when they are necessary to restore service. Keep the corresponding source change in the repository so Git-based deployments do not undo the fix.
- Do not commit, push, or deploy unless the user explicitly asks for that action.

## ERP canonical source and reduced Rahyar edition

- ERP is the canonical source for shared application code; shared backend changes are applied from ERP through DevHub, not maintained as a parallel implementation in Rahyar.
- Rahyar receives all shared application code from ERP. Accounting, Commerce, Human Resources, Support, and Statistics remain in source but are hidden/disabled by default using the Rahyar product edition settings.
- Keep Rahyar API host/port, Vercel settings, environment variables, secrets, and database connection independent from ERP. Never sync `.env*`, deployment configuration, or database contents.
- Preserve Rahyar's Prisma connection handling (including `DATABASE_URL_POOLED`) and `main.ts` runtime configuration when applying shared module code.
- Keep separate Prisma databases and migration histories. Any shared schema change must have a reviewed migration compatible with Rahyar before application.
- Sync must preserve destination changes in a backup and avoid deleting files unless explicitly declared in a reviewed manifest.
- For every requested ERP behavior change, implement it in ERP first and apply the equivalent shared backend change in Rahyar during the same task.
- Keep the shared module navigation order Dashboard first and Rahcom second, followed by the remaining modules; the Rahyar frontend should show Dashboard, Rahcom, Settings, and Development by default while keeping Accounting, Commerce, Human Resources, Support, and Statistics hidden unless enabled.
- Keep local ports and API URLs, Vercel configuration, `.env*` files and secrets, databases and data, and deployment files specific to Rahyar. Never copy ERP runtime resources or point Rahyar at ERP services.
- Treat every feature request made in the ERP workspace as authorization to implement the shared behavior in ERP first and apply the corresponding backend change to Rahyar in the same task; the user should not need to repeat the request for Rahyar.
- Keep the Development data creation feature named “Create Data” in the frontend catalogs. Seed persistent business records with stable identifiers and idempotent upserts; do not add test/sample labels to user-facing record fields.
- Seed the Rahyar organization with its distinct “رهیار” identity and Rahcom road/traffic camera logo while preserving organization-specific runtime configuration and administrator-customized branding.
