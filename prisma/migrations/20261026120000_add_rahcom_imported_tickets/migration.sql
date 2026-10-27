CREATE TABLE "rahcom_imported_tickets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketCode" VARCHAR(100) NOT NULL,
    "systemCode" VARCHAR(100) NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "customer" TEXT NOT NULL DEFAULT '',
    "equipment" TEXT NOT NULL DEFAULT '',
    "type" VARCHAR(120) NOT NULL DEFAULT '',
    "status" VARCHAR(120) NOT NULL DEFAULT '',
    "priority" VARCHAR(120) NOT NULL DEFAULT '',
    "supportTeam" VARCHAR(200) NOT NULL DEFAULT '',
    "createdOn" VARCHAR(120) NOT NULL DEFAULT '',
    "sourceFileName" VARCHAR(255) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rahcom_imported_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rahcom_imported_tickets_organizationId_ticketCode_key"
ON "rahcom_imported_tickets"("organizationId", "ticketCode");

CREATE INDEX "rahcom_imported_tickets_organizationId_systemCode_idx"
ON "rahcom_imported_tickets"("organizationId", "systemCode");

CREATE INDEX "rahcom_imported_tickets_organizationId_importedAt_idx"
ON "rahcom_imported_tickets"("organizationId", "importedAt");

ALTER TABLE "rahcom_imported_tickets"
ADD CONSTRAINT "rahcom_imported_tickets_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
