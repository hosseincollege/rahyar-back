CREATE TABLE "rahcom_bill_identifier_lists" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "headers" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rahcom_bill_identifier_lists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rahcom_bill_identifier_lists_organizationId_province_key"
ON "rahcom_bill_identifier_lists"("organizationId", "province");

CREATE INDEX "rahcom_bill_identifier_lists_organizationId_updatedAt_idx"
ON "rahcom_bill_identifier_lists"("organizationId", "updatedAt");

ALTER TABLE "rahcom_bill_identifier_lists"
ADD CONSTRAINT "rahcom_bill_identifier_lists_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
