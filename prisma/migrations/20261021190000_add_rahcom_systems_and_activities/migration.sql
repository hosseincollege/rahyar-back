CREATE TABLE "rahcom_systems" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "systemName" VARCHAR(200) NOT NULL,
    "systemCode" VARCHAR(100) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rahcom_systems_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rahcom_activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "activityDate" DATE NOT NULL,
    "activityType" VARCHAR(40) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "description" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rahcom_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rahcom_systems_organizationId_province_systemCode_key"
ON "rahcom_systems"("organizationId", "province", "systemCode");
CREATE INDEX "rahcom_systems_organizationId_province_idx"
ON "rahcom_systems"("organizationId", "province");
CREATE INDEX "rahcom_activities_organizationId_activityDate_idx"
ON "rahcom_activities"("organizationId", "activityDate");

ALTER TABLE "rahcom_systems" ADD CONSTRAINT "rahcom_systems_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rahcom_activities" ADD CONSTRAINT "rahcom_activities_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
