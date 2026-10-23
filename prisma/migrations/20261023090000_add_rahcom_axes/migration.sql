CREATE TABLE "rahcom_axes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rahcom_axes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rahcom_axes_organizationId_province_name_key"
ON "rahcom_axes"("organizationId", "province", "name");

CREATE INDEX "rahcom_axes_organizationId_province_idx"
ON "rahcom_axes"("organizationId", "province");

ALTER TABLE "rahcom_axes"
ADD CONSTRAINT "rahcom_axes_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
