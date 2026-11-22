ALTER TABLE "user_preferences"
ADD COLUMN "rahcomSelectedProvince" VARCHAR(80);

-- Earlier releases could save the single available province without a user action.
-- Clear those implicit selections so users must choose explicitly or have an assignment.
UPDATE "organization_members"
SET "rahcomSelectedProvince" = NULL;
