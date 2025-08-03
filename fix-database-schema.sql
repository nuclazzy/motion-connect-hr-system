-- 휴가 시스템 데이터베이스 스키마 완전 수정
-- 누락된 컬럼 추가 및 데이터 마이그레이션

-- 1. 누락된 컬럼들 추가
ALTER TABLE leave_days 
ADD COLUMN IF NOT EXISTS substitute_leave_hours DECIMAL(4,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS compensatory_leave_hours DECIMAL(4,1) DEFAULT 0;

-- 2. JSON 데이터에서 별도 컬럼으로 데이터 마이그레이션
UPDATE leave_days 
SET 
  substitute_leave_hours = COALESCE(
    (leave_types->>'substitute_leave_hours')::DECIMAL(4,1), 
    0
  ),
  compensatory_leave_hours = COALESCE(
    (leave_types->>'compensatory_leave_hours')::DECIMAL(4,1), 
    0
  )
WHERE 
  substitute_leave_hours IS NULL 
  OR compensatory_leave_hours IS NULL
  OR substitute_leave_hours = 0 
  OR compensatory_leave_hours = 0;

-- 3. JSON 필드도 별도 컬럼 값으로 동기화
UPDATE leave_days 
SET leave_types = jsonb_set(
  jsonb_set(
    leave_types::jsonb,
    '{substitute_leave_hours}',
    substitute_leave_hours::text::jsonb
  ),
  '{compensatory_leave_hours}',
  compensatory_leave_hours::text::jsonb
),
updated_at = NOW()
WHERE leave_types IS NOT NULL;

-- 4. NOT NULL 제약조건 추가
ALTER TABLE leave_days 
ALTER COLUMN substitute_leave_hours SET NOT NULL,
ALTER COLUMN compensatory_leave_hours SET NOT NULL;

-- 5. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_leave_days_substitute_hours 
ON leave_days(substitute_leave_hours) 
WHERE substitute_leave_hours > 0;

CREATE INDEX IF NOT EXISTS idx_leave_days_compensatory_hours 
ON leave_days(compensatory_leave_hours) 
WHERE compensatory_leave_hours > 0;

-- 6. 데이터 일관성 확인 뷰 생성
CREATE OR REPLACE VIEW leave_data_consistency AS
SELECT 
  u.name,
  u.email,
  ld.substitute_leave_hours as column_substitute,
  (ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1) as json_substitute,
  ld.compensatory_leave_hours as column_compensatory,
  (ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1) as json_compensatory,
  CASE 
    WHEN ld.substitute_leave_hours = (ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1)
    AND ld.compensatory_leave_hours = (ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1)
    THEN 'CONSISTENT'
    ELSE 'INCONSISTENT'
  END as consistency_status,
  ld.updated_at
FROM leave_days ld
JOIN users u ON ld.user_id = u.id
WHERE u.role = 'user'
ORDER BY u.name;

-- 7. 간단한 휴가 잔량 조회 함수
CREATE OR REPLACE FUNCTION get_available_leave_hours(
  p_user_id UUID,
  p_leave_type TEXT
) RETURNS DECIMAL(4,1)
LANGUAGE plpgsql
AS $$
DECLARE
  available_hours DECIMAL(4,1);
BEGIN
  SELECT 
    CASE 
      WHEN p_leave_type = 'substitute' THEN substitute_leave_hours
      WHEN p_leave_type = 'compensatory' THEN compensatory_leave_hours
      ELSE 0
    END
  INTO available_hours
  FROM leave_days
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(available_hours, 0);
END;
$$;

-- 8. 휴가 차감 함수
CREATE OR REPLACE FUNCTION deduct_leave_hours(
  p_user_id UUID,
  p_leave_type TEXT,
  p_hours DECIMAL(4,1)
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_hours DECIMAL(4,1);
  field_name TEXT;
BEGIN
  -- 유효성 검사
  IF p_leave_type NOT IN ('substitute', 'compensatory') THEN
    RAISE EXCEPTION 'Invalid leave type: %', p_leave_type;
  END IF;
  
  -- 현재 잔량 확인
  current_hours := get_available_leave_hours(p_user_id, p_leave_type);
  
  IF current_hours < p_hours THEN
    RAISE EXCEPTION 'Insufficient leave hours. Available: %, Requested: %', current_hours, p_hours;
  END IF;
  
  -- 잔량 차감
  IF p_leave_type = 'substitute' THEN
    UPDATE leave_days 
    SET 
      substitute_leave_hours = substitute_leave_hours - p_hours,
      leave_types = jsonb_set(
        leave_types::jsonb,
        '{substitute_leave_hours}',
        (substitute_leave_hours - p_hours)::text::jsonb
      ),
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE leave_days 
    SET 
      compensatory_leave_hours = compensatory_leave_hours - p_hours,
      leave_types = jsonb_set(
        leave_types::jsonb,
        '{compensatory_leave_hours}',
        (compensatory_leave_hours - p_hours)::text::jsonb
      ),
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 9. 결과 확인
SELECT * FROM leave_data_consistency;

-- 10. 성공 메시지
SELECT 
  'Database schema fix completed successfully!' as status,
  COUNT(*) as total_users,
  SUM(substitute_leave_hours) as total_substitute_hours,
  SUM(compensatory_leave_hours) as total_compensatory_hours
FROM leave_days ld
JOIN users u ON ld.user_id = u.id
WHERE u.role = 'user';