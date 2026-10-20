ALTER TABLE "organization_settings"
  ALTER COLUMN "accentLightColor" SET DEFAULT '#3b82f6',
  ALTER COLUMN "accentDarkColor" SET DEFAULT '#60a5fa';

UPDATE "organization_settings"
SET "accentLightColor" = CASE "accentPreset"
      WHEN 'blue' THEN '#3b82f6'
      WHEN 'green' THEN '#22c55e'
      WHEN 'red' THEN '#ef4444'
      WHEN 'amber' THEN '#facc15'
      WHEN 'violet' THEN '#8b5cf6'
      ELSE "accentLightColor"
    END,
    "accentDarkColor" = CASE "accentPreset"
      WHEN 'blue' THEN '#60a5fa'
      WHEN 'green' THEN '#4ade80'
      WHEN 'red' THEN '#f87171'
      WHEN 'amber' THEN '#fde047'
      WHEN 'violet' THEN '#a78bfa'
      ELSE "accentDarkColor"
    END
WHERE
  ("accentPreset" = 'blue' AND "accentDarkColor" = '#1d4ed8') OR
  ("accentPreset" = 'green' AND "accentDarkColor" = '#15803d') OR
  ("accentPreset" = 'red' AND "accentDarkColor" = '#b91c1c') OR
  ("accentPreset" = 'amber' AND "accentDarkColor" = '#ca8a04') OR
  ("accentPreset" = 'violet' AND "accentDarkColor" = '#6d28d9');
