ALTER TABLE "rahcom_invoice_attachments"
    ADD COLUMN "storagePath" VARCHAR(1024);

ALTER TABLE "rahcom_invoice_attachments"
    ALTER COLUMN "content" DROP NOT NULL;

CREATE UNIQUE INDEX "rahcom_invoice_attachments_storagePath_key"
    ON "rahcom_invoice_attachments"("storagePath");
