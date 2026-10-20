CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'REMOTE', 'HALF_DAY');
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID');

CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "baseSalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "allowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_records_employeeId_workDate_key" ON "attendance_records"("employeeId", "workDate");
CREATE INDEX "attendance_records_organizationId_workDate_status_idx" ON "attendance_records"("organizationId", "workDate", "status");
CREATE INDEX "attendance_records_employeeId_workDate_idx" ON "attendance_records"("employeeId", "workDate");
CREATE UNIQUE INDEX "payroll_records_employeeId_period_key" ON "payroll_records"("employeeId", "period");
CREATE INDEX "payroll_records_organizationId_period_status_idx" ON "payroll_records"("organizationId", "period", "status");
CREATE INDEX "payroll_records_employeeId_period_idx" ON "payroll_records"("employeeId", "period");

ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "key", "name", "description")
VALUES
  ('perm_hr_attendance_read', 'hr.attendance.read', 'مشاهده حضور و غیاب', 'مشاهده سوابق حضور و غیاب سازمان'),
  ('perm_hr_attendance_write', 'hr.attendance.write', 'مدیریت حضور و غیاب', 'ثبت و ویرایش سوابق حضور و غیاب'),
  ('perm_hr_payroll_read', 'hr.payroll.read', 'مشاهده حقوق و دستمزد', 'مشاهده اطلاعات حقوق کارکنان'),
  ('perm_hr_payroll_write', 'hr.payroll.write', 'مدیریت حقوق و دستمزد', 'ایجاد و ویرایش اطلاعات حقوق کارکنان')
ON CONFLICT ("key") DO NOTHING;
