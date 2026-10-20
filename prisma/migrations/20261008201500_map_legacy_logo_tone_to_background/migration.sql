UPDATE "organizations"
SET "logoBackground" = CASE
  WHEN "logoTone" = 'LIGHT' THEN 'DARK'
  ELSE 'LIGHT'
END
WHERE "logoBackground" = 'NONE';
