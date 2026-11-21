CREATE TABLE "rahcom_inventory_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "equipmentName" VARCHAR(200) NOT NULL,
    "systemId" TEXT,
    "systemNameSnapshot" VARCHAR(200) NOT NULL,
    "systemCodeSnapshot" VARCHAR(100) NOT NULL,
    "usageDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rahcom_inventory_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rahcom_inventory_entries_organizationId_province_usageDate_idx"
ON "rahcom_inventory_entries"("organizationId", "province", "usageDate");

CREATE INDEX "rahcom_inventory_entries_organizationId_systemId_usageDate_idx"
ON "rahcom_inventory_entries"("organizationId", "systemId", "usageDate");

ALTER TABLE "rahcom_inventory_entries" ADD CONSTRAINT "rahcom_inventory_entries_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rahcom_inventory_entries" ADD CONSTRAINT "rahcom_inventory_entries_systemId_fkey"
FOREIGN KEY ("systemId") REFERENCES "rahcom_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
