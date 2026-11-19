# Backend source layout

## Product modules

- `src/rahcom/`, `src/settings/`, `src/development/`, and `src/notifications/` own their controllers, services, and feature types.
- Keep settings subdomains such as `company/`, `organization/`, `projects/`, and their multi-file `dto/` groups with the feature they serve.
- Keep a DTO directly in its module when it is the only file of that kind. Use a `dto/` folder for a cohesive group of related DTOs, not for a single file.

## Shared infrastructure

- `src/core/` contains shared authentication, setup, and Prisma infrastructure.
- `src/core/auth/` owns the JWT strategy and auth module. Keep the multi-file `decorators/`, `guards/`, and `dto/` groups together because they are distinct concepts used across modules.
- `src/system/` contains app-wide system endpoints and services.

Keep feature implementation in its owning module. Avoid one-file directories and deep paths that do not represent a route or a meaningful group.
