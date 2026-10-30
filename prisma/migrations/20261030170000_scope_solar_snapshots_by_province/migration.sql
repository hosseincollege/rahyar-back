ALTER TABLE "rahcom_solar_snapshots"
ADD COLUMN "province" VARCHAR(80);

CREATE INDEX "rahcom_solar_snapshots_organizationId_province_capturedAt_idx"
ON "rahcom_solar_snapshots"("organizationId", "province", "capturedAt");
