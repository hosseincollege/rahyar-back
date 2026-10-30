UPDATE "rahcom_systems" AS system
SET "incidentType" = CASE special."category"
  WHEN 'THEFT' THEN 'THEFT'
  WHEN 'DAMAGE' THEN 'DAMAGE'
  WHEN 'WIDENING_RELOCATION' THEN 'WIDENING_RELOCATION'
  ELSE 'THEFT_AND_DAMAGE'
END
FROM "rahcom_solar_special_systems" AS special
WHERE system."organizationId" = special."organizationId"
  AND system."province" = special."province"
  AND upper(trim(system."systemCode")) = upper(trim(special."systemCode"))
  AND system."incidentType" IS NULL;
