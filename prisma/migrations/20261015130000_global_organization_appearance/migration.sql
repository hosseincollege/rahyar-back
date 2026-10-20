-- Organization-wide display preferences. Create the settings table for clean
-- installs and add new fields safely when the table already exists.
CREATE TABLE IF NOT EXISTS "organization_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "timezone" TEXT DEFAULT 'Asia/Tehran',
    "locale" TEXT DEFAULT 'fa-IR',
    "currencyCode" TEXT DEFAULT 'IRR',
    "dateFormat" TEXT DEFAULT 'jYYYY/jMM/jDD',
    "accentPreset" TEXT NOT NULL DEFAULT 'blue',
    "accentLightColor" TEXT NOT NULL DEFAULT '#2563eb',
    "accentDarkColor" TEXT NOT NULL DEFAULT '#1d4ed8',
    "backgroundStyle" TEXT NOT NULL DEFAULT 'THEME',
    "calendar" TEXT NOT NULL DEFAULT 'persian',
    "publicRegistrationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bootstrapCompleted" BOOLEAN NOT NULL DEFAULT false,
    "ticketingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inventoryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hrEnabled" BOOLEAN NOT NULL DEFAULT false,
    "crmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "salesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "accountingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "purchasingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "organization_settings"
    ADD COLUMN IF NOT EXISTS "accentPreset" TEXT NOT NULL DEFAULT 'blue',
    ADD COLUMN IF NOT EXISTS "accentLightColor" TEXT NOT NULL DEFAULT '#2563eb',
    ADD COLUMN IF NOT EXISTS "accentDarkColor" TEXT NOT NULL DEFAULT '#1d4ed8',
    ADD COLUMN IF NOT EXISTS "backgroundStyle" TEXT NOT NULL DEFAULT 'THEME',
    ADD COLUMN IF NOT EXISTS "calendar" TEXT NOT NULL DEFAULT 'persian';

ALTER TABLE "user_preferences"
    ADD COLUMN IF NOT EXISTS "calendar" TEXT NOT NULL DEFAULT 'persian';

CREATE UNIQUE INDEX IF NOT EXISTS "organization_settings_organizationId_key"
    ON "organization_settings"("organizationId");
CREATE INDEX IF NOT EXISTS "organization_settings_organizationId_idx"
    ON "organization_settings"("organizationId");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'organization_settings_organizationId_fkey'
    ) THEN
        ALTER TABLE "organization_settings"
            ADD CONSTRAINT "organization_settings_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
