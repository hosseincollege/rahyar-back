ALTER TABLE "rahcom_systems"
ADD COLUMN "station_name" VARCHAR(200),
ADD COLUMN "aggregation_code" VARCHAR(100);

UPDATE "rahcom_systems"
SET "long_outage" = TRUE,
    "long_outage_reason" = CASE UPPER("systemCode")
      WHEN '062D13029' THEN 'RELOCATION'
      WHEN '007E13025' THEN 'THEFT_DAMAGE'
      WHEN '065E13005' THEN 'THEFT_DAMAGE'
      WHEN '065W13000' THEN 'RELOCATION'
      WHEN '903N13004' THEN 'THEFT_DAMAGE'
    END
WHERE "province" = 'isfahan'
  AND UPPER("systemCode") IN ('062D13029', '007E13025', '065E13005', '065W13000', '903N13004');
