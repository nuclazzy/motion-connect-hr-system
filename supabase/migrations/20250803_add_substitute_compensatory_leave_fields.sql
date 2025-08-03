-- 대체휴가와 보상휴가 필드 추가 및 기본값 설정

-- leave_days 테이블의 leave_types JSONB에 새 필드들 추가
-- 기존 데이터에 대체휴가와 보상휴가 필드가 없으면 0으로 초기화

UPDATE leave_days 
SET leave_types = leave_types || jsonb_build_object(
    'substitute_leave_hours', COALESCE((leave_types->>'substitute_leave_hours')::NUMERIC, 0),
    'compensatory_leave_hours', COALESCE((leave_types->>'compensatory_leave_hours')::NUMERIC, 0)
)
WHERE leave_types IS NOT NULL;

-- leave_types가 NULL인 경우 기본 구조 생성
UPDATE leave_days 
SET leave_types = jsonb_build_object(
    'annual_days', 15,
    'used_annual_days', 0,
    'sick_days', 3,
    'used_sick_days', 0,
    'substitute_leave_hours', 0,
    'compensatory_leave_hours', 0
)
WHERE leave_types IS NULL;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_leave_days_substitute_hours 
ON leave_days USING GIN ((leave_types->'substitute_leave_hours'));

CREATE INDEX IF NOT EXISTS idx_leave_days_compensatory_hours 
ON leave_days USING GIN ((leave_types->'compensatory_leave_hours'));

-- 휴가 타입 검증 함수
CREATE OR REPLACE FUNCTION validate_leave_types_structure()
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

-- 트리거 생성 (기존 트리거가 있으면 삭제 후 재생성)
DROP TRIGGER IF EXISTS validate_leave_types_trigger ON leave_days;
CREATE TRIGGER validate_leave_types_trigger
    BEFORE INSERT OR UPDATE ON leave_days
    FOR EACH ROW
    EXECUTE FUNCTION validate_leave_types_structure();

-- 휴가 데이터 일관성 확인 함수
CREATE OR REPLACE FUNCTION check_leave_data_consistency()
RETURNS TABLE(
    user_id UUID,
    username TEXT,
    inconsistencies TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ld.user_id,
        u.name as username,
        ARRAY[
            CASE WHEN (ld.leave_types->>'used_annual_days')::NUMERIC > (ld.leave_types->>'annual_days')::NUMERIC 
                THEN 'used_annual_days exceeds annual_days' 
                ELSE NULL END,
            CASE WHEN (ld.leave_types->>'used_sick_days')::NUMERIC > (ld.leave_types->>'sick_days')::NUMERIC 
                THEN 'used_sick_days exceeds sick_days' 
                ELSE NULL END,
            CASE WHEN (ld.leave_types->>'substitute_leave_hours')::NUMERIC < 0 
                THEN 'substitute_leave_hours is negative' 
                ELSE NULL END,
            CASE WHEN (ld.leave_types->>'compensatory_leave_hours')::NUMERIC < 0 
                THEN 'compensatory_leave_hours is negative' 
                ELSE NULL END
        ]::TEXT[] 
    FROM leave_days ld
    JOIN users u ON ld.user_id = u.id
    WHERE 
        (ld.leave_types->>'used_annual_days')::NUMERIC > (ld.leave_types->>'annual_days')::NUMERIC OR
        (ld.leave_types->>'used_sick_days')::NUMERIC > (ld.leave_types->>'sick_days')::NUMERIC OR
        (ld.leave_types->>'substitute_leave_hours')::NUMERIC < 0 OR
        (ld.leave_types->>'compensatory_leave_hours')::NUMERIC < 0;
END;
$$ LANGUAGE plpgsql;

-- 권한 설정
GRANT EXECUTE ON FUNCTION check_leave_data_consistency TO authenticated;

-- 댓글: 이 migration은 기존 leave_days 테이블에 대체휴가와 보상휴가 필드를 안전하게 추가합니다.
-- 기존 데이터는 유지되며, 새 필드들은 기본값 0으로 설정됩니다.