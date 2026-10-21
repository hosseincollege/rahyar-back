ALTER TABLE "organization_members"
    ADD COLUMN IF NOT EXISTS "branchId" TEXT,
    ADD COLUMN IF NOT EXISTS "departmentId" TEXT,
    ADD COLUMN IF NOT EXISTS "teamId" TEXT;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_branchId_fkey') THEN
        ALTER TABLE "organization_members"
            ADD CONSTRAINT "organization_members_branchId_fkey"
            FOREIGN KEY ("branchId") REFERENCES "branches"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_departmentId_fkey') THEN
        ALTER TABLE "organization_members"
            ADD CONSTRAINT "organization_members_departmentId_fkey"
            FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_teamId_fkey') THEN
        ALTER TABLE "organization_members"
            ADD CONSTRAINT "organization_members_teamId_fkey"
            FOREIGN KEY ("teamId") REFERENCES "department_teams"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
