CREATE TABLE "rahcom_road_lists" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "sheetName" VARCHAR(120) NOT NULL,
    "headers" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rahcom_road_lists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rahcom_road_lists_organizationId_province_key"
ON "rahcom_road_lists"("organizationId", "province");

CREATE INDEX "rahcom_road_lists_organizationId_importedAt_idx"
ON "rahcom_road_lists"("organizationId", "importedAt");

ALTER TABLE "rahcom_road_lists" ADD CONSTRAINT "rahcom_road_lists_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
