UPDATE "organization_settings"
SET "shell_visibility" = jsonb_set(
  jsonb_set(
    COALESCE("shell_visibility", '{}'::jsonb),
    '{navigationModules}',
    '{"rahcom":true,"settings":true,"development":true}'::jsonb,
    true
  ),
  '{navigationItems}',
  COALESCE((
    SELECT jsonb_object_agg(item.key, item.value)
    FROM jsonb_each(COALESCE("organization_settings"."shell_visibility"->'navigationItems', '{}'::jsonb)) AS item(key, value)
    WHERE item.key LIKE '/rahcom/%'
       OR item.key LIKE '/settings/%'
       OR item.key LIKE '/development/%'
  ), '{}'::jsonb),
  true
);
