-- Direct SQL to update 휴가 신청서 form template with new half-day options
-- This is a simple, direct approach to add the new options

-- First, check current template
SELECT 
    id,
    name,
    jsonb_pretty(fields) as current_fields
FROM form_templates 
WHERE name = '휴가 신청서';

-- Update the template - this approach directly updates the options array
WITH field_updates AS (
    SELECT 
        ft.id,
        jsonb_agg(
            CASE 
                WHEN field_obj->>'name' = '휴가형태' THEN
                    field_obj || jsonb_build_object(
                        'options', 
                        '["연차", "오전 반차", "오후 반차", "병가", "경조사", "공가", "대체휴가", "대체휴가 반차", "보상휴가", "보상휴가 반차", "기타"]'::jsonb
                    )
                ELSE 
                    field_obj
            END
            ORDER BY field_index
        ) as updated_fields
    FROM form_templates ft,
         jsonb_array_elements(ft.fields) WITH ORDINALITY AS field_data(field_obj, field_index)
    WHERE ft.name = '휴가 신청서'
    GROUP BY ft.id
)
UPDATE form_templates 
SET 
    fields = field_updates.updated_fields,
    updated_at = CURRENT_TIMESTAMP
FROM field_updates
WHERE form_templates.id = field_updates.id;

-- Verify the update
SELECT 
    name,
    field->>'name' as field_name,
    field->'options' as updated_options
FROM form_templates,
     jsonb_array_elements(fields) as field
WHERE name = '휴가 신청서'
  AND field->>'name' = '휴가형태';