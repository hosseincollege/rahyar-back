CREATE TABLE "rahcom_traffic_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "sheetName" VARCHAR(120) NOT NULL,
    "headers" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rahcom_traffic_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rahcom_traffic_snapshots_organizationId_createdAt_idx"
ON "rahcom_traffic_snapshots"("organizationId", "createdAt");

ALTER TABLE "rahcom_traffic_snapshots"
ADD CONSTRAINT "rahcom_traffic_snapshots_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
