CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "body" JSONB,
    "href" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_recipientUserId_readAt_createdAt_idx"
ON "notifications"("recipientUserId", "readAt", "createdAt");

CREATE INDEX "notifications_organizationId_createdAt_idx"
ON "notifications"("organizationId", "createdAt");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
