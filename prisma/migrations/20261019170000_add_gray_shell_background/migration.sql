-- Preserve the existing blue-gray shell selection under its new explicit name.
UPDATE "organization_settings"
SET "backgroundStyle" = 'NAVY'
WHERE "backgroundStyle" = 'GRAY';

ALTER TABLE "organization_settings"
    ALTER COLUMN "backgroundStyle" SET DEFAULT 'NAVY';
