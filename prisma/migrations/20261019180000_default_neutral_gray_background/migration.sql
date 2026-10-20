-- Use neutral gray as the initial background for newly created organizations.
-- Existing organizations keep their explicitly saved appearance.
ALTER TABLE "organization_settings"
    ALTER COLUMN "backgroundStyle" SET DEFAULT 'GRAY';
