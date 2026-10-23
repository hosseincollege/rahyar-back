ALTER TABLE "users" ADD COLUMN "nationalId" TEXT;

CREATE INDEX "users_nationalId_idx" ON "users"("nationalId");
