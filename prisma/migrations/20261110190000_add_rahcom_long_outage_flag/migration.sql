ALTER TABLE "rahcom_systems"
ADD COLUMN "long_outage" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "rahcom_systems"
SET "long_outage" = TRUE
WHERE "province" = 'isfahan'
  AND UPPER("systemCode") IN (
    '062D13029',
    '007E13025',
    '065E13005',
    '065W13000',
    '903N13004'
  );
