ALTER TABLE "rahcom_traffic_snapshots" ADD COLUMN "snapshotDate" DATE;
UPDATE "rahcom_traffic_snapshots"
SET "snapshotDate" = ("createdAt" AT TIME ZONE 'Asia/Tehran')::date
WHERE "snapshotDate" IS NULL;
ALTER TABLE "rahcom_traffic_snapshots" ALTER COLUMN "snapshotDate" SET NOT NULL;
CREATE INDEX "rahcom_traffic_snapshots_organizationId_snapshotDate_createdAt_idx"
ON "rahcom_traffic_snapshots"("organizationId", "snapshotDate", "createdAt");

ALTER TABLE "rahcom_imported_tickets" ADD COLUMN "listDate" DATE;
UPDATE "rahcom_imported_tickets"
SET "listDate" = ("importedAt" AT TIME ZONE 'Asia/Tehran')::date
WHERE "listDate" IS NULL;
ALTER TABLE "rahcom_imported_tickets" ALTER COLUMN "listDate" SET NOT NULL;
DROP INDEX "rahcom_imported_tickets_organizationId_ticketCode_key";
CREATE UNIQUE INDEX "rahcom_imported_tickets_organizationId_province_listDate_ticketCode_key"
ON "rahcom_imported_tickets"("organizationId", "province", "listDate", "ticketCode");
CREATE INDEX "rahcom_imported_tickets_organizationId_province_listDate_idx"
ON "rahcom_imported_tickets"("organizationId", "province", "listDate");
