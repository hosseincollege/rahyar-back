CREATE TABLE "rahcom_solar_special_systems" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "systemCode" VARCHAR(100) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rahcom_solar_special_systems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rahcom_solar_special_systems_organizationId_province_systemCode_key"
ON "rahcom_solar_special_systems"("organizationId", "province", "systemCode");

CREATE INDEX "rahcom_solar_special_systems_organizationId_province_idx"
ON "rahcom_solar_special_systems"("organizationId", "province");

ALTER TABLE "rahcom_solar_special_systems" ADD CONSTRAINT "rahcom_solar_special_systems_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
