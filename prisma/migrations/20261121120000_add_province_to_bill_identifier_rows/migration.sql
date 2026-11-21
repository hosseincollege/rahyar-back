UPDATE "rahcom_bill_identifier_lists" AS bill_list
SET
  "headers" = bill_list."headers" || '["استان"]'::jsonb,
  "rows" = COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(bill_row.value) = 'array'
            THEN bill_row.value || '["اصفهان"]'::jsonb
          ELSE bill_row.value
        END
        ORDER BY bill_row.ordinality
      )
      FROM jsonb_array_elements(bill_list."rows") WITH ORDINALITY AS bill_row(value, ordinality)
    ),
    '[]'::jsonb
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE bill_list."province" = 'isfahan'
  AND NOT bill_list."headers" @> '["استان"]'::jsonb;
