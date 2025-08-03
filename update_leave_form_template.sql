-- Update 휴가 신청서 form template to add 대체휴가 반차 and 보상휴가 반차 options
-- This script will:
-- 1. Query the current form_templates table to find the '휴가 신청서' template
-- 2. Update the 휴가형태 field options to include new half-day options

-- First, let's check the current form template structure
-- Run this query to see the current template:
SELECT 
    id,
    name,
    description,
    fields,
    is_active,
    created_at,
    updated_at
FROM form_templates 
WHERE name = '휴가 신청서';

-- Update the 휴가 신청서 template to add new half-day options
UPDATE form_templates 
SET 
    fields = jsonb_set(
        fields,
        '{0,options}',
        '["연차", "오전 반차", "오후 반차", "병가", "경조사", "공가", "대체휴가", "대체휴가 반차", "보상휴가", "보상휴가 반차", "기타"]'::jsonb
    ),
    updated_at = NOW()
WHERE name = '휴가 신청서'
  AND jsonb_path_exists(fields, '$[*] ? (@.name == "휴가형태")');

-- Verify the update by checking the updated template
SELECT 
    id,
    name,
    jsonb_pretty(fields) as formatted_fields,
    updated_at
FROM form_templates 
WHERE name = '휴가 신청서';

-- Alternative update approach if the above doesn't work due to array structure
-- This approach reconstructs the entire fields array with updated options
WITH updated_fields AS (
    SELECT 
        id,
        jsonb_agg(
            CASE 
                WHEN field->>'name' = '휴가형태' THEN
                    jsonb_set(
                        field,
                        '{options}',
                        '["연차", "오전 반차", "오후 반차", "병가", "경조사", "공가", "대체휴가", "대체휴가 반차", "보상휴가", "보상휴가 반차", "기타"]'::jsonb
                    )
                ELSE field
            END
        ) as new_fields
    FROM form_templates,
         jsonb_array_elements(fields) as field
    WHERE name = '휴가 신청서'
    GROUP BY id
)
UPDATE form_templates ft
SET 
    fields = uf.new_fields,
    updated_at = NOW()
FROM updated_fields uf
WHERE ft.id = uf.id;

-- Final verification query
SELECT 
    name,
    field->>'name' as field_name,
    field->>'label' as field_label,
    field->'options' as options
FROM form_templates,
     jsonb_array_elements(fields) as field
WHERE name = '휴가 신청서'
  AND field->>'name' = '휴가형태';