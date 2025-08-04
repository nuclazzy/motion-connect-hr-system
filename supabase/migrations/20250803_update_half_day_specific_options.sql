-- Migration: Update 휴가형태 options to replace generic half-day with specific morning/afternoon options
-- Date: 2025-08-03
-- Description: Replace '대체휴가 반차', '보상휴가 반차' with '대체휴가 오전 반차', '대체휴가 오후 반차', '보상휴가 오전 반차', '보상휴가 오후 반차'

-- Update the 휴가형태 field options in the 휴가 신청서 form template
DO $$
DECLARE
    template_record RECORD;
    updated_fields JSONB;
    field_item JSONB;
BEGIN
    -- Get the current template
    SELECT * INTO template_record 
    FROM form_templates 
    WHERE name = '휴가 신청서' AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE NOTICE '휴가 신청서 template not found, skipping update';
        RETURN;
    END IF;
    
    -- Initialize the updated fields array
    updated_fields := '[]'::jsonb;
    
    -- Loop through each field and update the 휴가형태 field options
    FOR field_item IN SELECT jsonb_array_elements(template_record.fields)
    LOOP
        IF field_item->>'name' = '휴가형태' THEN
            -- Update the options array with specific morning/afternoon half-day options
            field_item := jsonb_set(
                field_item,
                '{options}',
                '["연차", "오전 반차", "오후 반차", "병가", "경조사", "공가", "대체휴가", "대체휴가 오전 반차", "대체휴가 오후 반차", "보상휴가", "보상휴가 오전 반차", "보상휴가 오후 반차", "기타"]'::jsonb
            );
            RAISE NOTICE 'Updated 휴가형태 field options with specific morning/afternoon half-day options';
        END IF;
        
        -- Add the field to the updated fields array
        updated_fields := updated_fields || jsonb_build_array(field_item);
    END LOOP;
    
    -- Update the template with the new fields
    UPDATE form_templates 
    SET 
        fields = updated_fields,
        updated_at = NOW()
    WHERE id = template_record.id;
    
    RAISE NOTICE 'Successfully updated 휴가 신청서 template with specific half-day options';
    
    -- Log the update for audit purposes
    INSERT INTO audit_logs (
        user_id, 
        action, 
        table_name, 
        record_id, 
        changes, 
        created_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid, -- System user
        'UPDATE',
        'form_templates',
        template_record.id::text,
        jsonb_build_object(
            'description', 'Updated 휴가형태 field options to replace generic half-day with specific morning/afternoon options',
            'old_options', '["연차", "오전 반차", "오후 반차", "병가", "경조사", "공가", "대체휴가", "대체휴가 반차", "보상휴가", "보상휴가 반차", "기타"]',
            'new_options', '["연차", "오전 반차", "오후 반차", "병가", "경조사", "공가", "대체휴가", "대체휴가 오전 반차", "대체휴가 오후 반차", "보상휴가", "보상휴가 오전 반차", "보상휴가 오후 반차", "기타"]'
        ),
        NOW()
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update 휴가 신청서 template: %', SQLERRM;
END $$;

-- Verify the update was successful
SELECT 
    'Migration completed successfully' as status,
    name,
    field->>'name' as field_name,
    field->'options' as updated_options
FROM form_templates,
     jsonb_array_elements(fields) as field
WHERE name = '휴가 신청서'
  AND field->>'name' = '휴가형태';