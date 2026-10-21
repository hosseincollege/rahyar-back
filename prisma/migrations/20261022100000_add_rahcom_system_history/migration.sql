ALTER TABLE "rahcom_activities"
  ADD COLUMN "systemId" TEXT,
  ADD COLUMN "systemNameSnapshot" VARCHAR(200),
  ADD COLUMN "systemCodeSnapshot" VARCHAR(100),
  ADD COLUMN "provinceSnapshot" VARCHAR(80),
  ADD COLUMN "accompaniedBy" VARCHAR(200),
  ADD COLUMN "handedOverTo" VARCHAR(200),
  ADD COLUMN "performedBy" VARCHAR(200);

CREATE INDEX "rahcom_activities_organizationId_systemId_activityDate_idx"
  ON "rahcom_activities"("organizationId", "systemId", "activityDate");

ALTER TABLE "rahcom_activities"
  ADD CONSTRAINT "rahcom_activities_systemId_fkey"
  FOREIGN KEY ("systemId") REFERENCES "rahcom_systems"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
