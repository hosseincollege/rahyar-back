CREATE TABLE "business_trip_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "estimatedCost" DECIMAL(18,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_trip_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_trip_requests_organizationId_status_idx" ON "business_trip_requests"("organizationId", "status");
CREATE INDEX "business_trip_requests_employeeId_startAt_idx" ON "business_trip_requests"("employeeId", "startAt");
CREATE INDEX "business_trip_requests_reviewedById_idx" ON "business_trip_requests"("reviewedById");

ALTER TABLE "business_trip_requests" ADD CONSTRAINT "business_trip_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_trip_requests" ADD CONSTRAINT "business_trip_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_trip_requests" ADD CONSTRAINT "business_trip_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
