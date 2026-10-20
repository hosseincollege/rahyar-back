ALTER TABLE "employees" ADD COLUMN "managerId" TEXT;
ALTER TABLE "departments" ADD COLUMN "managerEmployeeId" TEXT;

CREATE TABLE "department_teams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "managerEmployeeId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "department_teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "department_team_members" (
    "teamId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "department_team_members_pkey" PRIMARY KEY ("teamId", "employeeId")
);

CREATE UNIQUE INDEX "department_teams_departmentId_code_key"
    ON "department_teams"("departmentId", "code");
CREATE INDEX "department_teams_organizationId_departmentId_idx"
    ON "department_teams"("organizationId", "departmentId");
CREATE INDEX "department_teams_managerEmployeeId_idx"
    ON "department_teams"("managerEmployeeId");
CREATE INDEX "department_team_members_employeeId_idx"
    ON "department_team_members"("employeeId");
CREATE INDEX "employees_managerId_idx" ON "employees"("managerId");
CREATE INDEX "departments_managerEmployeeId_idx"
    ON "departments"("managerEmployeeId");

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "employees"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "departments"
    ADD CONSTRAINT "departments_managerEmployeeId_fkey"
    FOREIGN KEY ("managerEmployeeId") REFERENCES "employees"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "department_teams"
    ADD CONSTRAINT "department_teams_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_teams"
    ADD CONSTRAINT "department_teams_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_teams"
    ADD CONSTRAINT "department_teams_managerEmployeeId_fkey"
    FOREIGN KEY ("managerEmployeeId") REFERENCES "employees"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "department_team_members"
    ADD CONSTRAINT "department_team_members_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "department_teams"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_team_members"
    ADD CONSTRAINT "department_team_members_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
