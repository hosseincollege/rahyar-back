CREATE TABLE IF NOT EXISTS "visits" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "visits_ipAddress_createdAt_idx" ON "visits"("ipAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "visits_createdAt_idx" ON "visits"("createdAt");

CREATE TABLE IF NOT EXISTS "visitor_presence" (
    "visitorId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "visitor_presence_pkey" PRIMARY KEY ("visitorId")
);

CREATE INDEX IF NOT EXISTS "visitor_presence_lastSeenAt_idx" ON "visitor_presence"("lastSeenAt");
