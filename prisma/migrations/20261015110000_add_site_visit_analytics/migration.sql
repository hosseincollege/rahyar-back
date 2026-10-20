CREATE TABLE IF NOT EXISTS "visitor_sessions" (
  "id" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "userAgent" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "visitor_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "visitor_page_views" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "visitor_page_views_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "visitor_page_views_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "visitor_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "visitor_sessions_ipAddress_startedAt_idx" ON "visitor_sessions"("ipAddress", "startedAt");
CREATE INDEX IF NOT EXISTS "visitor_sessions_lastSeenAt_idx" ON "visitor_sessions"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "visitor_page_views_sessionId_enteredAt_idx" ON "visitor_page_views"("sessionId", "enteredAt");
CREATE INDEX IF NOT EXISTS "visitor_page_views_moduleKey_enteredAt_idx" ON "visitor_page_views"("moduleKey", "enteredAt");
