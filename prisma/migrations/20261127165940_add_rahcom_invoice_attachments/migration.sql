CREATE TABLE "rahcom_invoice_attachments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "invoiceNumber" VARCHAR(80) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rahcom_invoice_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rahcom_invoice_attachments_organizationId_province_invoiceN_idx"
    ON "rahcom_invoice_attachments"("organizationId", "province", "invoiceNumber", "category");

ALTER TABLE "rahcom_invoice_attachments"
    ADD CONSTRAINT "rahcom_invoice_attachments_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
