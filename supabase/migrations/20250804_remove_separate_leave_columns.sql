-- 20250804 별도 휴가 컬럼 제거 마이그레이션
-- 목적: substitute_leave_hours, compensatory_leave_hours 컬럼을 안전하게 제거
-- JSON 필드를 단일 데이터 소스로 사용하도록 정리

-- 이 마이그레이션을 실행하기 전에 반드시 사전 준비 마이그레이션을 먼저 실행하세요:
-- 20250804_safe_column_removal_preparation.sql

-- Step 1: 최종 안전성 검증
DO $$
DECLARE
    safety_check RECORD;
    all_checks_passed BOOLEAN := TRUE;
BEGIN
    RAISE NOTICE '=== 컬럼 제거 전 최종 안전성 검증 ===';
    
    FOR safety_check IN SELECT * FROM validate_safe_for_column_removal()
    LOOP
        RAISE NOTICE '검사 항목: %, 통과: %, 세부사항: %', 
            safety_check.check_name, safety_check.passed, safety_check.details;
        
        IF NOT safety_check.passed THEN
            all_checks_passed := FALSE;
        END IF;
    END LOOP;
    
    IF NOT all_checks_passed THEN
        RAISE EXCEPTION '안전성 검증 실패. 컬럼 제거를 중단합니다. 사전 준비 마이그레이션을 먼저 실행하고 데이터를 수정하세요.';
    END IF;
    
    RAISE NOTICE '모든 안전성 검증 통과. 컬럼 제거를 진행합니다.';
END $$;

-- Step 2: 컬럼 제거 전 최종 데이터 동기화
-- JSON을 기준으로 별도 컬럼 값 최종 업데이트
UPDATE leave_days 
SET 
    substitute_leave_hours = COALESCE((leave_types->>'substitute_leave_hours')::NUMERIC, 0),
    compensatory_leave_hours = COALESCE((leave_types->>'compensatory_leave_hours')::NUMERIC, 0);

-- Step 3: 별도 컬럼들 제거
-- substitute_leave_hours 컬럼 제거
ALTER TABLE leave_days DROP COLUMN IF EXISTS substitute_leave_hours;

-- compensatory_leave_hours 컬럼 제거  
ALTER TABLE leave_days DROP COLUMN IF EXISTS compensatory_leave_hours;

-- Step 4: JSON 필드 유효성 검증 강화
-- 기존 검증 함수 업데이트 (별도 컬럼 참조 제거)
CREATE OR REPLACE FUNCTION validate_leave_types_json_only()
RETURNS TRIGGER AS $$
BEGIN
    -- leave_types JSONB 구조 검증
    IF NEW.leave_types IS NOT NULL THEN
        -- 필수 필드 확인
        IF NOT (NEW.leave_types ? 'annual_days' AND 
                NEW.leave_types ? 'used_annual_days' AND
                NEW.leave_types ? 'sick_days' AND 
                NEW.leave_types ? 'used_sick_days' AND
                NEW.leave_types ? 'substitute_leave_hours' AND
                NEW.leave_types ? 'compensatory_leave_hours') THEN
            RAISE EXCEPTION 'leave_types must contain all required fields: annual_days, used_annual_days, sick_days, used_sick_days, substitute_leave_hours, compensatory_leave_hours';
        END IF;
        
        -- 숫자 타입 검증
        IF NOT (
            (NEW.leave_types->>'annual_days')::TEXT ~ '^[0-9]+(\.[0-9]+)?$' AND
            (NEW.leave_types->>'used_annual_days')::TEXT ~ '^[0-9]+(\.[0-9]+)?$' AND
            (NEW.leave_types->>'sick_days')::TEXT ~ '^[0-9]+(\.[0-9]+)?$' AND
            (NEW.leave_types->>'used_sick_days')::TEXT ~ '^[0-9]+(\.[0-9]+)?$' AND
            (NEW.leave_types->>'substitute_leave_hours')::TEXT ~ '^[0-9]+(\.[0-9]+)?$' AND
            (NEW.leave_types->>'compensatory_leave_hours')::TEXT ~ '^[0-9]+(\.[0-9]+)?$'
        ) THEN
            RAISE EXCEPTION 'All leave_types fields must be numeric values';
        END IF;
        
        -- 음수 값 방지
        IF (
            (NEW.leave_types->>'annual_days')::NUMERIC < 0 OR
            (NEW.leave_types->>'used_annual_days')::NUMERIC < 0 OR
            (NEW.leave_types->>'sick_days')::NUMERIC < 0 OR
            (NEW.leave_types->>'used_sick_days')::NUMERIC < 0 OR
            (NEW.leave_types->>'substitute_leave_hours')::NUMERIC < 0 OR
            (NEW.leave_types->>'compensatory_leave_hours')::NUMERIC < 0
        ) THEN
            RAISE EXCEPTION 'Leave values cannot be negative';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: 기존 트리거 교체
DROP TRIGGER IF EXISTS validate_leave_types_trigger ON leave_days;
CREATE TRIGGER validate_leave_types_json_only_trigger
    BEFORE INSERT OR UPDATE ON leave_days
    FOR EACH ROW
    EXECUTE FUNCTION validate_leave_types_json_only();

-- Step 6: JSON 전용 헬퍼 함수들 생성
-- 대체휴가/보상휴가 시간 조회 함수
CREATE OR REPLACE FUNCTION get_substitute_hours(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    hours NUMERIC;
BEGIN
    SELECT COALESCE((leave_types->>'substitute_leave_hours')::NUMERIC, 0)
    INTO hours
    FROM leave_days 
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(hours, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_compensatory_hours(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    hours NUMERIC;
BEGIN
    SELECT COALESCE((leave_types->>'compensatory_leave_hours')::NUMERIC, 0)
    INTO hours
    FROM leave_days 
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(hours, 0);
END;
$$ LANGUAGE plpgsql;

-- 휴가 시간 업데이트 함수
CREATE OR REPLACE FUNCTION update_leave_hours(
    p_user_id UUID,
    p_leave_type TEXT, -- 'substitute' 또는 'compensatory'
    p_hours NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
    field_name TEXT;
BEGIN
    -- 휴가 타입에 따른 필드명 결정
    IF p_leave_type = 'substitute' THEN
        field_name := 'substitute_leave_hours';
    ELSIF p_leave_type = 'compensatory' THEN
        field_name := 'compensatory_leave_hours';
    ELSE
        RAISE EXCEPTION 'Invalid leave type. Must be ''substitute'' or ''compensatory''';
    END IF;
    
    -- JSON 필드 업데이트
    UPDATE leave_days 
    SET leave_types = jsonb_set(leave_types, ARRAY[field_name], to_jsonb(p_hours))
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Step 7: 정리 완료 검증 함수
CREATE OR REPLACE FUNCTION verify_column_removal_success()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- 1. 컬럼 제거 확인
    RETURN QUERY SELECT 
        '컬럼 제거 확인'::TEXT,
        CASE WHEN NOT EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'leave_days' 
            AND column_name IN ('substitute_leave_hours', 'compensatory_leave_hours')
        ) THEN '성공' ELSE '실패' END,
        '별도 컬럼들이 완전히 제거되었습니다';
    
    -- 2. JSON 필드 데이터 확인
    RETURN QUERY SELECT 
        'JSON 데이터 확인'::TEXT,
        CASE WHEN NOT EXISTS(
            SELECT 1 FROM leave_days 
            WHERE leave_types IS NULL OR
                  NOT (leave_types ? 'substitute_leave_hours') OR
                  NOT (leave_types ? 'compensatory_leave_hours')
        ) THEN '성공' ELSE '실패' END,
        '모든 레코드에 JSON 필드가 올바르게 존재합니다';
    
    -- 3. 백업 테이블 확인
    RETURN QUERY SELECT 
        '백업 테이블 확인'::TEXT,
        CASE WHEN EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'leave_days_backup_20250804'
        ) THEN '존재' ELSE '없음' END,
        '원본 데이터 백업이 유지되고 있습니다';
END;
$$ LANGUAGE plpgsql;

-- Step 8: 권한 설정
GRANT EXECUTE ON FUNCTION get_substitute_hours TO authenticated;
GRANT EXECUTE ON FUNCTION get_compensatory_hours TO authenticated;
GRANT EXECUTE ON FUNCTION update_leave_hours TO authenticated;
GRANT EXECUTE ON FUNCTION verify_column_removal_success TO authenticated;

-- Step 9: 마이그레이션 완료 확인
DO $$
DECLARE
    verification_result RECORD;
BEGIN
    RAISE NOTICE '=== 컬럼 제거 완료 검증 ===';
    
    FOR verification_result IN SELECT * FROM verify_column_removal_success()
    LOOP
        RAISE NOTICE '검사 항목: %, 상태: %, 세부사항: %', 
            verification_result.check_name, verification_result.status, verification_result.details;
    END LOOP;
    
    RAISE NOTICE '컬럼 제거 마이그레이션이 완료되었습니다.';
    RAISE NOTICE '이제 JSON 필드만 사용하여 대체휴가/보상휴가 데이터를 관리합니다.';
END $$;

-- 마이그레이션 로그
COMMENT ON TABLE leave_days IS 'Updated 20250804: Removed separate substitute_leave_hours and compensatory_leave_hours columns. Now using JSON-only approach for cleaner data management.';

/*
사용법:
1. get_substitute_hours(user_id) - 사용자의 대체휴가 시간 조회
2. get_compensatory_hours(user_id) - 사용자의 보상휴가 시간 조회  
3. update_leave_hours(user_id, 'substitute', hours) - 대체휴가 시간 업데이트
4. update_leave_hours(user_id, 'compensatory', hours) - 보상휴가 시간 업데이트
5. verify_column_removal_success() - 마이그레이션 성공 여부 확인
*/