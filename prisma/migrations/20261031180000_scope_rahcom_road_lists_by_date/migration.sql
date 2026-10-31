ALTER TABLE "rahcom_road_lists" ADD COLUMN "listDate" DATE;

UPDATE "rahcom_road_lists"
SET "listDate" = "importedAt"::date
WHERE "listDate" IS NULL;

ALTER TABLE "rahcom_road_lists" ALTER COLUMN "listDate" SET NOT NULL;

DROP INDEX "rahcom_road_lists_organizationId_province_key";

CREATE UNIQUE INDEX "rahcom_road_lists_organizationId_province_listDate_key"
ON "rahcom_road_lists"("organizationId", "province", "listDate");
