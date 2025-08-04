-- 20250804 컬럼 제거 롤백 스크립트
-- 목적: 컬럼 제거 마이그레이션을 롤백하여 이전 상태로 복원
-- 주의: 이 스크립트는 백업 데이터가 존재할 때만 안전하게 실행 가능

-- Step 1: 백업 테이블 존재 확인
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'leave_days_backup_20250804'
    ) THEN
        RAISE EXCEPTION '백업 테이블이 존재하지 않습니다. 롤백을 중단합니다.';
    END IF;
    
    RAISE NOTICE '백업 테이블 확인 완료. 롤백을 진행합니다.';
END $$;

-- Step 2: 현재 데이터 임시 백업 (롤백 전 상태 보존)
CREATE TABLE IF NOT EXISTS leave_days_before_rollback_20250804 AS 
SELECT * FROM leave_days;

-- Step 3: 별도 컬럼들 다시 생성
ALTER TABLE leave_days 
ADD COLUMN IF NOT EXISTS substitute_leave_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS compensatory_leave_hours NUMERIC DEFAULT 0;

-- Step 4: 백업 데이터로부터 복원
-- 우선 JSON 데이터부터 복원
UPDATE leave_days 
SET leave_types = backup.leave_types
FROM leave_days_backup_20250804 backup
WHERE leave_days.user_id = backup.user_id;

-- 별도 컬럼 데이터 복원
UPDATE leave_days 
SET 
    substitute_leave_hours = backup.substitute_leave_hours,
    compensatory_leave_hours = backup.compensatory_leave_hours
FROM leave_days_backup_20250804 backup
WHERE leave_days.user_id = backup.user_id;

-- Step 5: 누락된 레코드가 있는지 확인하고 복원
INSERT INTO leave_days (
    user_id, leave_types, substitute_leave_hours, compensatory_leave_hours,
    created_at, updated_at
)
SELECT 
    backup.user_id, 
    backup.leave_types, 
    backup.substitute_leave_hours, 
    backup.compensatory_leave_hours,
    backup.created_at, 
    backup.updated_at
FROM leave_days_backup_20250804 backup
WHERE NOT EXISTS (
    SELECT 1 FROM leave_days current 
    WHERE current.user_id = backup.user_id
);

-- Step 6: 기존 검증 트리거 복원
DROP TRIGGER IF EXISTS validate_leave_types_json_only_trigger ON leave_days;

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

-- 기존 트리거 재생성
CREATE TRIGGER validate_leave_types_trigger
    BEFORE INSERT OR UPDATE ON leave_days
    FOR EACH ROW
    EXECUTE FUNCTION validate_leave_types_structure();

-- Step 7: JSON 전용 함수들 제거 (롤백)
DROP FUNCTION IF EXISTS get_substitute_hours(UUID);
DROP FUNCTION IF EXISTS get_compensatory_hours(UUID);
DROP FUNCTION IF EXISTS update_leave_hours(UUID, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS validate_leave_types_json_only();
DROP FUNCTION IF EXISTS verify_column_removal_success();

-- Step 8: 데이터 일관성 재확인
DO $$
DECLARE
    inconsistent_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM leave_days;
    
    SELECT COUNT(*) INTO inconsistent_count
    FROM leave_days ld
    WHERE 
        COALESCE(ld.substitute_leave_hours, 0) != COALESCE((ld.leave_types->>'substitute_leave_hours')::NUMERIC, 0) OR
        COALESCE(ld.compensatory_leave_hours, 0) != COALESCE((ld.leave_types->>'compensatory_leave_hours')::NUMERIC, 0);
    
    RAISE NOTICE '=== 롤백 완료 상태 ===';
    RAISE NOTICE '총 레코드: %개', total_count;
    RAISE NOTICE '불일치 레코드: %개', inconsistent_count;
    
    IF inconsistent_count > 0 THEN
        RAISE WARNING '데이터 불일치가 발견되었습니다. verify_column_json_consistency() 함수로 확인하세요.';
    ELSE
        RAISE NOTICE '모든 데이터가 일치합니다.';
    END IF;
END $$;

-- Step 9: 롤백 검증 함수
CREATE OR REPLACE FUNCTION verify_rollback_success()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- 1. 컬럼 복원 확인
    RETURN QUERY SELECT 
        '컬럼 복원 확인'::TEXT,
        CASE WHEN EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'leave_days' 
            AND column_name IN ('substitute_leave_hours', 'compensatory_leave_hours')
        ) THEN '성공' ELSE '실패' END,
        '별도 컬럼들이 다시 생성되었습니다';
    
    -- 2. 데이터 복원 확인
    RETURN QUERY SELECT 
        '데이터 복원 확인'::TEXT,
        CASE WHEN NOT EXISTS(
            SELECT 1 FROM leave_days 
            WHERE substitute_leave_hours IS NULL OR compensatory_leave_hours IS NULL
        ) THEN '성공' ELSE '실패' END,
        '모든 레코드에 컬럼 데이터가 복원되었습니다';
    
    -- 3. 백업 테이블 확인
    RETURN QUERY SELECT 
        '백업 보존 확인'::TEXT,
        CASE WHEN EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'leave_days_backup_20250804'
        ) THEN '보존됨' ELSE '없음' END,
        '원본 백업이 보존되어 있습니다';
        
    -- 4. 롤백 이전 상태 백업 확인
    RETURN QUERY SELECT 
        '롤백 전 백업 확인'::TEXT,
        CASE WHEN EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'leave_days_before_rollback_20250804'
        ) THEN '생성됨' ELSE '없음' END,
        '롤백 이전 상태가 백업되었습니다';
END;
$$ LANGUAGE plpgsql;

-- Step 10: 권한 설정
GRANT EXECUTE ON FUNCTION verify_rollback_success TO authenticated;

-- Step 11: 롤백 완료 확인
DO $$
DECLARE
    verification_result RECORD;
BEGIN
    RAISE NOTICE '=== 롤백 완료 검증 ===';
    
    FOR verification_result IN SELECT * FROM verify_rollback_success()
    LOOP
        RAISE NOTICE '검사 항목: %, 상태: %, 세부사항: %', 
            verification_result.check_name, verification_result.status, verification_result.details;
    END LOOP;
    
    RAISE NOTICE '롤백이 완료되었습니다.';
    RAISE NOTICE '이제 다시 별도 컬럼과 JSON 필드 둘 다 사용 가능합니다.';
END $$;

-- 테이블 주석 업데이트
COMMENT ON TABLE leave_days IS 'Rolled back 20250804: Restored separate substitute_leave_hours and compensatory_leave_hours columns alongside JSON fields.';

/*
롤백 후 정리 작업 (필요시):
1. verify_rollback_success() - 롤백 성공 여부 확인
2. verify_column_json_consistency() - 데이터 일관성 확인
3. fix_column_json_inconsistencies() - 불일치 데이터 수정

백업 테이블 정리 (충분한 검증 후):
- DROP TABLE leave_days_backup_20250804;
- DROP TABLE leave_days_before_rollback_20250804;
*/