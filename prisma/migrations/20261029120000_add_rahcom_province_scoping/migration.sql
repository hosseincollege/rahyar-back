ALTER TABLE "organization_members"
ADD COLUMN "rahcomProvince" VARCHAR(80);

ALTER TABLE "organization_members"
ADD COLUMN "rahcomSelectedProvince" VARCHAR(80);

ALTER TABLE "rahcom_imported_tickets"
ADD COLUMN "province" VARCHAR(80);

CREATE INDEX "rahcom_imported_tickets_organizationId_province_idx"
ON "rahcom_imported_tickets"("organizationId", "province");

-- Backfill only unambiguous system-code matches; leave the rest unassigned.
WITH "unique_system_provinces" AS (
  SELECT "organizationId", "systemCode", MIN("province") AS "province"
  FROM "rahcom_systems"
  WHERE "systemCode" <> ''
  GROUP BY "organizationId", "systemCode"
  HAVING COUNT(DISTINCT "province") = 1
)
UPDATE "rahcom_imported_tickets" AS ticket
SET "province" = system."province"
FROM "unique_system_provinces" AS system
WHERE ticket."organizationId" = system."organizationId"
  AND ticket."systemCode" = system."systemCode"
  AND ticket."province" IS NULL;
