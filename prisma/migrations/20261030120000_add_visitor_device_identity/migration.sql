ALTER TABLE "visitor_sessions" ADD COLUMN "visitorId" TEXT;
ALTER TABLE "visitor_presence" ADD COLUMN "label" TEXT;
CREATE INDEX "visitor_sessions_visitorId_startedAt_idx" ON "visitor_sessions"("visitorId", "startedAt");
