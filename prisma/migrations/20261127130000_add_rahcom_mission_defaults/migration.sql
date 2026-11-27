CREATE TABLE "rahcom_mission_defaults" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "requestType" VARCHAR(100) NOT NULL,
    "provincialManager" VARCHAR(200) NOT NULL,
    "missionField" VARCHAR(200) NOT NULL,
    "provincialOfficeSupervisor" VARCHAR(200) NOT NULL,
    "provincialOperationsExpert" VARCHAR(200) NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rahcom_mission_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rahcom_mission_defaults_organizationId_province_key"
ON "rahcom_mission_defaults"("organizationId", "province");

CREATE INDEX "rahcom_mission_defaults_organizationId_updatedAt_idx"
ON "rahcom_mission_defaults"("organizationId", "updatedAt");

ALTER TABLE "rahcom_mission_defaults"
ADD CONSTRAINT "rahcom_mission_defaults_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
