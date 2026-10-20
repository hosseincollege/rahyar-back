-- Keep the deployed organizations table aligned with the current Prisma model.
ALTER TABLE "organizations"
    ADD COLUMN "registrationNumber" TEXT,
    ADD COLUMN "economicCode" TEXT,
    ADD COLUMN "taxOffice" TEXT,
    ADD COLUMN "website" TEXT,
    ADD COLUMN "postalCode" TEXT,
    ADD COLUMN "currency" TEXT DEFAULT 'IRR',
    ADD COLUMN "fiscalYearStart" TEXT DEFAULT '01-01';
