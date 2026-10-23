CREATE TABLE "auth_login_attempts" (
  "keyHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_login_attempts_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "auth_login_attempts_windowStartedAt_idx"
  ON "auth_login_attempts"("windowStartedAt");
