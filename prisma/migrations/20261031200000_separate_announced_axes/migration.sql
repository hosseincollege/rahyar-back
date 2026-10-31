ALTER TABLE "rahcom_systems"
ADD COLUMN "announced_axis" VARCHAR(120);

UPDATE "rahcom_systems"
SET "announced_axis" = "axis"
WHERE "axisCode" IS NOT NULL
  AND "axis" IS NOT NULL;
