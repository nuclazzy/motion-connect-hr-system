-- Data Synchronization Migration Script
-- Fix inconsistencies between separate columns and JSON fields
-- Priority: Separate columns (substitute_leave_hours, compensatory_leave_hours) are the source of truth

-- Step 1: Create a function to check current inconsistencies
CREATE OR REPLACE FUNCTION check_data_inconsistencies()
RETURNS TABLE(
    user_id UUID,
    username TEXT,
    email TEXT,
    column_substitute DECIMAL(4,1),
    json_substitute DECIMAL(4,1),
    column_compensatory DECIMAL(4,1),
    json_compensatory DECIMAL(4,1),
    substitute_mismatch BOOLEAN,
    compensatory_mismatch BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ld.user_id,
        u.name as username,
        u.email,
        ld.substitute_leave_hours as column_substitute,
        COALESCE((ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1), 0) as json_substitute,
        ld.compensatory_leave_hours as column_compensatory,
        COALESCE((ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1), 0) as json_compensatory,
        (ld.substitute_leave_hours != COALESCE((ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1), 0)) as substitute_mismatch,
        (ld.compensatory_leave_hours != COALESCE((ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1), 0)) as compensatory_mismatch
    FROM leave_days ld
    JOIN users u ON ld.user_id = u.id
    WHERE u.role = 'user'
    AND (
        ld.substitute_leave_hours != COALESCE((ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1), 0)
        OR 
        ld.compensatory_leave_hours != COALESCE((ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1), 0)
    )
    ORDER BY u.name;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Display current inconsistencies
DO $$
DECLARE
    inconsistency_record RECORD;
    inconsistency_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== BEFORE MIGRATION: Data Inconsistencies ===';
    RAISE NOTICE '';
    
    FOR inconsistency_record IN 
        SELECT * FROM check_data_inconsistencies()
    LOOP
        inconsistency_count := inconsistency_count + 1;
        RAISE NOTICE 'User: % (%) - ID: %', 
            inconsistency_record.username, 
            inconsistency_record.email,
            inconsistency_record.user_id;
        
        IF inconsistency_record.substitute_mismatch THEN
            RAISE NOTICE '  - Substitute Leave: Column=% hours, JSON=% hours (MISMATCH)', 
                inconsistency_record.column_substitute, 
                inconsistency_record.json_substitute;
        END IF;
        
        IF inconsistency_record.compensatory_mismatch THEN
            RAISE NOTICE '  - Compensatory Leave: Column=% hours, JSON=% hours (MISMATCH)', 
                inconsistency_record.column_compensatory, 
                inconsistency_record.json_compensatory;
        END IF;
        
        RAISE NOTICE '';
    END LOOP;
    
    IF inconsistency_count = 0 THEN
        RAISE NOTICE 'No data inconsistencies found. All data is already synchronized.';
    ELSE
        RAISE NOTICE 'Total users with inconsistencies: %', inconsistency_count;
    END IF;
    
    RAISE NOTICE '=== END BEFORE MIGRATION ===';
    RAISE NOTICE '';
END $$;

-- Step 3: Perform the synchronization (Update JSON fields to match separate columns)
DO $$
DECLARE
    affected_users INTEGER := 0;
    user_record RECORD;
BEGIN
    RAISE NOTICE '=== STARTING DATA SYNCHRONIZATION ===';
    RAISE NOTICE '';
    
    -- Count users that will be affected
    SELECT COUNT(*) INTO affected_users
    FROM leave_days ld
    JOIN users u ON ld.user_id = u.id
    WHERE u.role = 'user'
    AND (
        ld.substitute_leave_hours != COALESCE((ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1), 0)
        OR 
        ld.compensatory_leave_hours != COALESCE((ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1), 0)
    );
    
    IF affected_users = 0 THEN
        RAISE NOTICE 'No users need synchronization. Exiting.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Synchronizing % users...', affected_users;
    RAISE NOTICE '';
    
    -- Update JSON fields to match separate column values
    UPDATE leave_days 
    SET 
        leave_types = jsonb_set(
            jsonb_set(
                COALESCE(leave_types, '{}'::jsonb),
                '{substitute_leave_hours}',
                substitute_leave_hours::text::jsonb
            ),
            '{compensatory_leave_hours}',
            compensatory_leave_hours::text::jsonb
        ),
        updated_at = NOW()
    FROM users u
    WHERE leave_days.user_id = u.id
    AND u.role = 'user'
    AND (
        substitute_leave_hours != COALESCE((leave_types->>'substitute_leave_hours')::DECIMAL(4,1), 0)
        OR 
        compensatory_leave_hours != COALESCE((leave_types->>'compensatory_leave_hours')::DECIMAL(4,1), 0)
    );
    
    RAISE NOTICE 'Successfully synchronized % users', affected_users;
    RAISE NOTICE '';
END $$;

-- Step 4: Verify the synchronization worked
DO $$
DECLARE
    remaining_inconsistencies INTEGER := 0;
    verification_record RECORD;
BEGIN
    RAISE NOTICE '=== AFTER MIGRATION: Verification ===';
    RAISE NOTICE '';
    
    -- Check if any inconsistencies remain
    SELECT COUNT(*) INTO remaining_inconsistencies
    FROM check_data_inconsistencies();
    
    IF remaining_inconsistencies = 0 THEN
        RAISE NOTICE 'SUCCESS: All data is now synchronized!';
        RAISE NOTICE '';
        
        -- Show summary of current state
        RAISE NOTICE '=== CURRENT DATA SUMMARY ===';
        FOR verification_record IN 
            SELECT 
                u.name as username,
                u.email,
                ld.substitute_leave_hours,
                ld.compensatory_leave_hours,
                (ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1) as json_substitute,
                (ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1) as json_compensatory
            FROM leave_days ld
            JOIN users u ON ld.user_id = u.id
            WHERE u.role = 'user'
            AND (ld.substitute_leave_hours > 0 OR ld.compensatory_leave_hours > 0)
            ORDER BY u.name
        LOOP
            RAISE NOTICE 'User: % (%)', verification_record.username, verification_record.email;
            RAISE NOTICE '  - Substitute Leave: % hours (Column & JSON match)', verification_record.substitute_leave_hours;
            RAISE NOTICE '  - Compensatory Leave: % hours (Column & JSON match)', verification_record.compensatory_leave_hours;
            RAISE NOTICE '';
        END LOOP;
    ELSE
        RAISE NOTICE 'WARNING: % inconsistencies still remain!', remaining_inconsistencies;
        
        -- Show remaining inconsistencies
        FOR verification_record IN 
            SELECT * FROM check_data_inconsistencies()
        LOOP
            RAISE NOTICE 'REMAINING ISSUE - User: % (%)', 
                verification_record.username, 
                verification_record.email;
            
            IF verification_record.substitute_mismatch THEN
                RAISE NOTICE '  - Substitute Leave: Column=%, JSON=%', 
                    verification_record.column_substitute, 
                    verification_record.json_substitute;
            END IF;
            
            IF verification_record.compensatory_mismatch THEN
                RAISE NOTICE '  - Compensatory Leave: Column=%, JSON=%', 
                    verification_record.column_compensatory, 
                    verification_record.json_compensatory;
            END IF;
            
            RAISE NOTICE '';
        END LOOP;
    END IF;
    
    RAISE NOTICE '=== END VERIFICATION ===';
END $$;

-- Step 5: Create a permanent monitoring view for future use
CREATE OR REPLACE VIEW leave_data_sync_monitor AS
SELECT 
    u.name as username,
    u.email,
    u.id as user_id,
    ld.substitute_leave_hours as column_substitute,
    (ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1) as json_substitute,
    ld.compensatory_leave_hours as column_compensatory,
    (ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1) as json_compensatory,
    CASE 
        WHEN ld.substitute_leave_hours = (ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1)
        AND ld.compensatory_leave_hours = (ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1)
        THEN 'SYNCHRONIZED'
        ELSE 'OUT_OF_SYNC'
    END as sync_status,
    ld.updated_at as last_updated
FROM leave_days ld
JOIN users u ON ld.user_id = u.id
WHERE u.role = 'user'
ORDER BY sync_status DESC, u.name;

-- Grant access to the monitoring view
GRANT SELECT ON leave_data_sync_monitor TO authenticated;

-- Step 6: Clean up the temporary function
DROP FUNCTION IF EXISTS check_data_inconsistencies();

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DATA SYNCHRONIZATION MIGRATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'You can monitor future sync status with:';
    RAISE NOTICE 'SELECT * FROM leave_data_sync_monitor WHERE sync_status = ''OUT_OF_SYNC'';';
    RAISE NOTICE '';
END $$;