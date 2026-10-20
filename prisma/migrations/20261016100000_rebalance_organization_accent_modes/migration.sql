ALTER TABLE "organization_settings"
  ALTER COLUMN "accentLightColor" SET DEFAULT '#60a5fa',
  ALTER COLUMN "accentDarkColor" SET DEFAULT '#3b82f6';

UPDATE "organization_settings"
SET "accentLightColor" = CASE "accentPreset"
      WHEN 'blue' THEN '#60a5fa'
      WHEN 'green' THEN '#4ade80'
      WHEN 'red' THEN '#f87171'
      WHEN 'amber' THEN '#fde047'
      WHEN 'violet' THEN '#a78bfa'
      ELSE "accentLightColor"
    END,
    "accentDarkColor" = CASE "accentPreset"
      WHEN 'blue' THEN '#3b82f6'
      WHEN 'green' THEN '#22c55e'
      WHEN 'red' THEN '#ef4444'
      WHEN 'amber' THEN '#facc15'
      WHEN 'violet' THEN '#8b5cf6'
      ELSE "accentDarkColor"
    END
WHERE
  ("accentPreset" = 'blue' AND "accentLightColor" = '#3b82f6' AND "accentDarkColor" = '#60a5fa') OR
  ("accentPreset" = 'green' AND "accentLightColor" = '#22c55e' AND "accentDarkColor" = '#4ade80') OR
  ("accentPreset" = 'red' AND "accentLightColor" = '#ef4444' AND "accentDarkColor" = '#f87171') OR
  ("accentPreset" = 'amber' AND "accentLightColor" = '#facc15' AND "accentDarkColor" = '#fde047') OR
  ("accentPreset" = 'violet' AND "accentLightColor" = '#8b5cf6' AND "accentDarkColor" = '#a78bfa');
