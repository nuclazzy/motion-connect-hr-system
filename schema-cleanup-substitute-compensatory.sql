-- 대체휴가/보상휴가 스키마 정리 및 일관성 확보
-- 이 스크립트는 별도 컬럼을 제거하고 JSON 필드만 사용하도록 스키마를 정리합니다.

-- 1. 기존 별도 컬럼이 존재하는지 확인하고 제거
DO $$
BEGIN
    -- substitute_leave_hours 컬럼 존재 여부 확인 및 제거
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leave_days' 
        AND column_name = 'substitute_leave_hours'
    ) THEN
        -- 기존 데이터 백업을 위해 JSON으로 마이그레이션 먼저 실행
        UPDATE leave_days 
        SET leave_types = jsonb_set(
            COALESCE(leave_types, '{}'::jsonb),
            '{substitute_leave_hours}',
            COALESCE(substitute_leave_hours::text::jsonb, '0'::jsonb)
        )
        WHERE substitute_leave_hours IS NOT NULL;
        
        -- 컬럼 제거
        ALTER TABLE leave_days DROP COLUMN substitute_leave_hours;
        RAISE NOTICE 'substitute_leave_hours 컬럼이 제거되었습니다.';
    ELSE
        RAISE NOTICE 'substitute_leave_hours 컬럼이 존재하지 않습니다.';
    END IF;
    
    -- compensatory_leave_hours 컬럼 존재 여부 확인 및 제거
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leave_days' 
        AND column_name = 'compensatory_leave_hours'
    ) THEN
        -- 기존 데이터 백업을 위해 JSON으로 마이그레이션 먼저 실행
        UPDATE leave_days 
        SET leave_types = jsonb_set(
            COALESCE(leave_types, '{}'::jsonb),
            '{compensatory_leave_hours}',
            COALESCE(compensatory_leave_hours::text::jsonb, '0'::jsonb)
        )
        WHERE compensatory_leave_hours IS NOT NULL;
        
        -- 컬럼 제거
        ALTER TABLE leave_days DROP COLUMN compensatory_leave_hours;
        RAISE NOTICE 'compensatory_leave_hours 컬럼이 제거되었습니다.';
    ELSE
        RAISE NOTICE 'compensatory_leave_hours 컬럼이 존재하지 않습니다.';
    END IF;
END $$;

-- 2. leave_types JSONB 필드의 데이터 일관성 확보
-- 모든 레코드에 필수 필드들이 존재하도록 보장
UPDATE leave_days 
SET leave_types = jsonb_build_object(
    'annual_days', COALESCE((leave_types->>'annual_days')::NUMERIC, 15),
    'used_annual_days', COALESCE((leave_types->>'used_annual_days')::NUMERIC, 0),
    'sick_days', COALESCE((leave_types->>'sick_days')::NUMERIC, 60),
    'used_sick_days', COALESCE((leave_types->>'used_sick_days')::NUMERIC, 0),
    'substitute_leave_hours', COALESCE((leave_types->>'substitute_leave_hours')::NUMERIC, 0),
    'compensatory_leave_hours', COALESCE((leave_types->>'compensatory_leave_hours')::NUMERIC, 0)
) || COALESCE(leave_types, '{}'::jsonb)
WHERE leave_types IS NULL OR 
      NOT (leave_types ? 'substitute_leave_hours') OR 
      NOT (leave_types ? 'compensatory_leave_hours');

-- 3. 데이터 검증 제약조건 추가
-- JSONB 구조 검증 함수 생성/업데이트
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

-- 4. 트리거 재생성
DROP TRIGGER IF EXISTS validate_leave_types_trigger ON leave_days;
CREATE TRIGGER validate_leave_types_trigger
    BEFORE INSERT OR UPDATE ON leave_days
    FOR EACH ROW
    EXECUTE FUNCTION validate_leave_types_structure();

-- 5. 성능 최적화를 위한 인덱스 추가/업데이트
DROP INDEX IF EXISTS idx_leave_days_substitute_hours;
DROP INDEX IF EXISTS idx_leave_days_compensatory_hours;

CREATE INDEX IF NOT EXISTS idx_leave_days_substitute_hours 
ON leave_days USING GIN ((leave_types->'substitute_leave_hours'));

CREATE INDEX IF NOT EXISTS idx_leave_days_compensatory_hours 
ON leave_days USING GIN ((leave_types->'compensatory_leave_hours'));

-- 6. 헬퍼 함수 생성 (선택사항 - 쿼리 편의성을 위함)
CREATE OR REPLACE FUNCTION get_substitute_leave_hours(user_uuid UUID)
RETURNS NUMERIC AS $$
BEGIN
    RETURN (
        SELECT COALESCE((leave_types->>'substitute_leave_hours')::NUMERIC, 0)
        FROM leave_days 
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_compensatory_leave_hours(user_uuid UUID)
RETURNS NUMERIC AS $$
BEGIN
    RETURN (
        SELECT COALESCE((leave_types->>'compensatory_leave_hours')::NUMERIC, 0)
        FROM leave_days 
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql;

-- 7. 권한 설정
GRANT EXECUTE ON FUNCTION get_substitute_leave_hours TO authenticated;
GRANT EXECUTE ON FUNCTION get_compensatory_leave_hours TO authenticated;

-- 8. 최종 검증 쿼리
-- 스키마 정리 후 데이터 일관성 확인
DO $$
DECLARE
    inconsistent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO inconsistent_count
    FROM leave_days
    WHERE leave_types IS NULL OR 
          NOT (leave_types ? 'substitute_leave_hours') OR 
          NOT (leave_types ? 'compensatory_leave_hours') OR
          (leave_types->>'substitute_leave_hours')::NUMERIC < 0 OR
          (leave_types->>'compensatory_leave_hours')::NUMERIC < 0;
    
    IF inconsistent_count > 0 THEN
        RAISE WARNING '% 개의 레코드에서 데이터 일관성 문제가 발견되었습니다.', inconsistent_count;
    ELSE
        RAISE NOTICE '모든 데이터가 일관성 있게 정리되었습니다.';
    END IF;
END $$;

-- 9. 최종 확인 출력
SELECT 
    '스키마 정리 완료' as status,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE leave_types ? 'substitute_leave_hours') as records_with_substitute,
    COUNT(*) FILTER (WHERE leave_types ? 'compensatory_leave_hours') as records_with_compensatory
FROM leave_days;