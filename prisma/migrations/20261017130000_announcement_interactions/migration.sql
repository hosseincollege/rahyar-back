ALTER TABLE "announcements"
  ADD COLUMN "allowLikes" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowReactions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowComments" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowMentions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "branchId" TEXT;

CREATE INDEX "announcements_branchId_idx" ON "announcements"("branchId");
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "announcement_reactions" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "announcement_reactions_announcementId_userId_emoji_key" ON "announcement_reactions"("announcementId", "userId", "emoji");
CREATE INDEX "announcement_reactions_announcementId_createdAt_idx" ON "announcement_reactions"("announcementId", "createdAt");
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "announcement_comments" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "announcement_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcement_comments_announcementId_createdAt_idx" ON "announcement_comments"("announcementId", "createdAt");
ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "announcement_comment_mentions" (
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "announcement_comment_mentions_pkey" PRIMARY KEY ("commentId", "userId")
);
CREATE INDEX "announcement_comment_mentions_userId_idx" ON "announcement_comment_mentions"("userId");
ALTER TABLE "announcement_comment_mentions" ADD CONSTRAINT "announcement_comment_mentions_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "announcement_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_comment_mentions" ADD CONSTRAINT "announcement_comment_mentions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
