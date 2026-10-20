ALTER TABLE "user_preferences"
  RENAME COLUMN "lightContrast" TO "lightBrightness";

ALTER TABLE "user_preferences"
  RENAME COLUMN "darkContrast" TO "darkBrightness";

ALTER TABLE "user_preferences"
  ADD COLUMN "lightContrast" TEXT NOT NULL DEFAULT 'balanced',
  ADD COLUMN "darkContrast" TEXT NOT NULL DEFAULT 'balanced';
