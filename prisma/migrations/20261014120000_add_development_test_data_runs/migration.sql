CREATE TABLE "development_test_data_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "appliedById" TEXT NOT NULL,
    "moduleKey" VARCHAR(40) NOT NULL,
    "recordCounts" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_test_data_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "development_test_data_runs_organizationId_moduleKey_key"
    ON "development_test_data_runs"("organizationId", "moduleKey");
CREATE INDEX "development_test_data_runs_appliedById_appliedAt_idx"
    ON "development_test_data_runs"("appliedById", "appliedAt");

ALTER TABLE "development_test_data_runs"
    ADD CONSTRAINT "development_test_data_runs_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "development_test_data_runs"
    ADD CONSTRAINT "development_test_data_runs_appliedById_fkey"
    FOREIGN KEY ("appliedById") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
