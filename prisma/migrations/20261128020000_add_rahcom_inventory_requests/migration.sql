CREATE TABLE "rahcom_inventory_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "referenceNumber" VARCHAR(40) NOT NULL,
    "requestedAtText" VARCHAR(80) NOT NULL,
    "requestDescription" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    "deliveryDate" VARCHAR(80),
    "deliveryNote" TEXT,
    "deliveredItems" JSONB,
    "consumptionDate" VARCHAR(80),
    "consumptionNote" TEXT,
    "consumedItems" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rahcom_inventory_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rahcom_inventory_requests_organizationId_referenceNumber_key"
ON "rahcom_inventory_requests"("organizationId", "referenceNumber");

CREATE INDEX "rahcom_inventory_requests_organizationId_province_status_idx"
ON "rahcom_inventory_requests"("organizationId", "province", "status");

ALTER TABLE "rahcom_inventory_requests"
ADD CONSTRAINT "rahcom_inventory_requests_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
