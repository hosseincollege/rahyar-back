INSERT INTO "permissions" ("id", "key", "name", "description")
VALUES
  ('perm_settings_read', 'settings.read', 'View organization settings', 'View organization profile and structure settings'),
  ('perm_settings_write', 'settings.write', 'Manage organization settings', 'Create and update organization profile and structure settings'),
  ('perm_users_read', 'users.read', 'View user accounts', 'View organization user accounts'),
  ('perm_users_write', 'users.write', 'Manage user accounts', 'Create, update, disable, and remove organization user accounts'),
  ('perm_roles_read', 'roles.read', 'View roles', 'View organization roles and permissions'),
  ('perm_roles_write', 'roles.write', 'Manage roles', 'Create and update organization roles and permissions')
ON CONFLICT ("key") DO NOTHING;

-- Preserve access that was previously granted through the broad settings permissions.
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT DISTINCT role_permission."roleId", target_permission."id"
FROM "role_permissions" AS role_permission
JOIN "permissions" AS source_permission
  ON source_permission."id" = role_permission."permissionId"
JOIN "permissions" AS target_permission
  ON target_permission."key" IN ('users.read', 'roles.read')
WHERE source_permission."key" = 'settings.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT DISTINCT role_permission."roleId", target_permission."id"
FROM "role_permissions" AS role_permission
JOIN "permissions" AS source_permission
  ON source_permission."id" = role_permission."permissionId"
JOIN "permissions" AS target_permission
  ON target_permission."key" IN ('users.write', 'roles.write')
WHERE source_permission."key" = 'settings.write'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
