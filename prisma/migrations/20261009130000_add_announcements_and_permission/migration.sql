CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications" ADD COLUMN "announcementId" TEXT;

CREATE INDEX "announcements_organizationId_isActive_isPinned_createdAt_idx"
ON "announcements"("organizationId", "isActive", "isPinned", "createdAt");

CREATE INDEX "notifications_announcementId_recipientUserId_idx"
ON "notifications"("announcementId", "recipientUserId");

ALTER TABLE "announcements"
ADD CONSTRAINT "announcements_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "announcements"
ADD CONSTRAINT "announcements_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_announcementId_fkey"
FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "key", "name", "description")
VALUES ('perm_announcements_write', 'announcements.write', 'مدیریت اعلان‌ها', 'ایجاد و بایگانی اطلاعیه‌های سازمانی')
ON CONFLICT ("key") DO NOTHING;
