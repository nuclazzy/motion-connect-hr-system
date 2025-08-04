-- 20250804 안전한 컬럼 제거를 위한 사전 준비 마이그레이션
-- 목적: substitute_leave_hours, compensatory_leave_hours 별도 컬럼을 제거하기 전 안전성 확보

-- Step 1: 데이터 백업 테이블 생성
CREATE TABLE IF NOT EXISTS leave_days_backup_20250804 AS 
SELECT * FROM leave_days;

-- Step 2: 백업 테이블에 타임스탬프 추가
ALTER TABLE leave_days_backup_20250804 
ADD COLUMN IF NOT EXISTS backup_created_at TIMESTAMP DEFAULT NOW();

-- Step 3: 데이터 일관성 검증 함수
CREATE OR REPLACE FUNCTION verify_column_json_consistency()
RETURNS TABLE(
    user_id UUID,
    username TEXT,
    column_substitute NUMERIC,
    json_substitute NUMERIC,
    column_compensatory NUMERIC,
    json_compensatory NUMERIC,
    is_consistent BOOLEAN,
    issue_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ld.user_id,
        u.name as username,
        ld.substitute_leave_hours as column_substitute,
        COALESCE((ld.leave_types->>'substitute_leave_hours')::NUMERIC, 0) as json_substitute,
        ld.compensatory_leave_hours as column_compensatory,
        COALESCE((ld.leave_types->>'compensatory_leave_hours')::NUMERIC, 0) as json_compensatory,
        (
            COALESCE(ld.substitute_leave_hours, 0) = COALESCE((ld.leave_types->>'substitute_leave_hours')::NUMERIC, 0) AND
            COALESCE(ld.compensatory_leave_hours, 0) = COALESCE((ld.leave_types->>'compensatory_leave_hours')::NUMERIC, 0)
        ) as is_consistent,
        CASE 
            WHEN COALESCE(ld.substitute_leave_hours, 0) != COALESCE((ld.leave_types->>'substitute_leave_hours')::NUMERIC, 0) 
                THEN 'substitute_leave_hours 불일치: 컬럼=' || COALESCE(ld.substitute_leave_hours, 0) || ', JSON=' || COALESCE((ld.leave_types->>'substitute_leave_hours')::NUMERIC, 0)
            WHEN COALESCE(ld.compensatory_leave_hours, 0) != COALESCE((ld.leave_types->>'compensatory_leave_hours')::NUMERIC, 0)
                THEN 'compensatory_leave_hours 불일치: 컬럼=' || COALESCE(ld.compensatory_leave_hours, 0) || ', JSON=' || COALESCE((ld.leave_types->>'compensatory_leave_hours')::NUMERIC, 0)
            ELSE '일치'
        END as issue_description
    FROM leave_days ld
    JOIN users u ON ld.user_id = u.id
    ORDER BY is_consistent ASC, ld.user_id;
END;
$$ LANGUAGE plpgsql;

-- Step 4: 불일치 데이터 자동 수정 함수
CREATE OR REPLACE FUNCTION fix_column_json_inconsistencies()
RETURNS TABLE(
    user_id UUID,
    action_taken TEXT
) AS $$
DECLARE
    r RECORD;
    fix_count INTEGER := 0;
BEGIN
    -- JSON 필드를 기준으로 컬럼 값 업데이트 (JSON이 단일 소스 역할)
    FOR r IN 
        SELECT ld.user_id, ld.substitute_leave_hours, ld.compensatory_leave_hours,
               COALESCE((ld.leave_types->>'substitute_leave_hours')::NUMERIC, 0) as json_substitute,
               COALESCE((ld.leave_types->>'compensatory_leave_hours')::NUMERIC, 0) as json_compensatory
        FROM leave_days ld
        WHERE 
            COALESCE(ld.substitute_leave_hours, 0) != COALESCE((ld.leave_types->>'substitute_leave_hours')::NUMERIC, 0) OR
            COALESCE(ld.compensatory_leave_hours, 0) != COALESCE((ld.leave_types->>'compensatory_leave_hours')::NUMERIC, 0)
    LOOP
        UPDATE leave_days 
        SET 
            substitute_leave_hours = r.json_substitute,
            compensatory_leave_hours = r.json_compensatory
        WHERE leave_days.user_id = r.user_id;
        
        fix_count := fix_count + 1;
        
        RETURN QUERY SELECT 
            r.user_id,
            format('컬럼 값 수정: substitute %s→%s, compensatory %s→%s', 
                   r.substitute_leave_hours, r.json_substitute,
                   r.compensatory_leave_hours, r.json_compensatory);
    END LOOP;
    
    -- 수정된 항목이 없으면 메시지 반환
    IF fix_count = 0 THEN
        RETURN QUERY SELECT 
            NULL::UUID,
            '모든 데이터가 일치합니다. 수정할 항목이 없습니다.'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 5: 컬럼 제거 전 최종 검증 함수
CREATE OR REPLACE FUNCTION validate_safe_for_column_removal()
RETURNS TABLE(
    check_name TEXT,
    passed BOOLEAN,
    details TEXT
) AS $$
DECLARE
    inconsistent_count INTEGER;
    backup_count INTEGER;
    original_count INTEGER;
BEGIN
    -- 1. 데이터 일관성 확인
    SELECT COUNT(*) INTO inconsistent_count
    FROM leave_days ld
    WHERE 
        COALESCE(ld.substitute_leave_hours, 0) != COALESCE((ld.leave_types->>'substitute_leave_hours')::NUMERIC, 0) OR
        COALESCE(ld.compensatory_leave_hours, 0) != COALESCE((ld.leave_types->>'compensatory_leave_hours')::NUMERIC, 0);
    
    RETURN QUERY SELECT 
        '데이터 일관성'::TEXT,
        (inconsistent_count = 0),
        format('%s개의 불일치 항목', inconsistent_count);
    
    -- 2. 백업 테이블 존재 및 데이터 확인
    SELECT COUNT(*) INTO backup_count FROM leave_days_backup_20250804;
    SELECT COUNT(*) INTO original_count FROM leave_days;
    
    RETURN QUERY SELECT 
        '백업 테이블'::TEXT,
        (backup_count = original_count AND backup_count > 0),
        format('백업: %s개, 원본: %s개', backup_count, original_count);
    
    -- 3. JSON 필드 필수 구조 확인
    RETURN QUERY SELECT 
        'JSON 구조'::TEXT,
        NOT EXISTS(
            SELECT 1 FROM leave_days 
            WHERE leave_types IS NULL OR 
                  NOT (leave_types ? 'substitute_leave_hours') OR 
                  NOT (leave_types ? 'compensatory_leave_hours')
        ),
        '모든 레코드에 필수 JSON 필드 존재 여부';
END;
$$ LANGUAGE plpgsql;

-- Step 6: 권한 설정
GRANT EXECUTE ON FUNCTION verify_column_json_consistency TO authenticated;
GRANT EXECUTE ON FUNCTION fix_column_json_inconsistencies TO authenticated;
GRANT EXECUTE ON FUNCTION validate_safe_for_column_removal TO authenticated;

-- Step 7: 사용법 안내 (주석)
/*
이 마이그레이션 실행 후 다음 단계를 수행하세요:

1. 데이터 일관성 확인:
   SELECT * FROM verify_column_json_consistency();

2. 불일치 데이터가 있다면 수정:
   SELECT * FROM fix_column_json_inconsistencies();

3. 컬럼 제거 안전성 최종 확인:
   SELECT * FROM validate_safe_for_column_removal();

4. 모든 검증이 통과하면 다음 마이그레이션으로 컬럼 제거 진행
*/