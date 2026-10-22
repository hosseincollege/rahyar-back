CREATE TABLE "rahcom_solar_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downText" TEXT NOT NULL,
    "unreachableText" TEXT NOT NULL,
    "equipmentColumns" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rahcom_solar_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rahcom_solar_snapshots_organizationId_capturedAt_idx"
ON "rahcom_solar_snapshots"("organizationId", "capturedAt");

ALTER TABLE "rahcom_solar_snapshots"
ADD CONSTRAINT "rahcom_solar_snapshots_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
