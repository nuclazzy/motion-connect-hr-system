-- 한종운 7월 14일 출퇴근 기록 완전 수정 (attendance_records + daily_work_summary)
-- Supabase SQL Editor에서 실행하세요

-- ===============================================
-- 1단계: 한종운의 user_id 확인
-- ===============================================
DO $$
DECLARE
  v_user_id UUID;
  v_employee_number VARCHAR;
BEGIN
  -- 한종운 user_id 조회
  SELECT id, employee_number INTO v_user_id, v_employee_number
  FROM users 
  WHERE name = '한종운'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '한종운 사용자를 찾을 수 없습니다';
  END IF;
  
  RAISE NOTICE '한종운 User ID: %, Employee Number: %', v_user_id, v_employee_number;

  -- ===============================================
  -- 2단계: 7월 14일 기존 기록 완전 삭제
  -- ===============================================
  
  -- attendance_records 삭제
  DELETE FROM attendance_records 
  WHERE user_id = v_user_id
  AND record_date = '2025-07-14';
  
  RAISE NOTICE 'attendance_records 기존 기록 삭제 완료';
  
  -- daily_work_summary 삭제
  DELETE FROM daily_work_summary 
  WHERE user_id = v_user_id
  AND work_date = '2025-07-14';
  
  RAISE NOTICE 'daily_work_summary 기존 기록 삭제 완료';
  
  -- ===============================================
  -- 3단계: 올바른 attendance_records 삽입
  -- ===============================================
  
  -- 출근 기록 (외근)
  INSERT INTO attendance_records (
    id,
    user_id,
    employee_number,
    record_date,
    record_time,
    record_timestamp,
    record_type,
    source,
    reason,
    is_manual,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_employee_number,
    '2025-07-14',
    '11:20:00',
    '2025-07-14 11:20:00+09',
    '출근',
    'WEB',
    '대학내일 정관장 대전 촬영 서울역 출발',
    false,
    NOW(),
    NOW()
  );
  
  -- 퇴근 기록 (사무실 복귀)
  INSERT INTO attendance_records (
    id,
    user_id,
    employee_number,
    record_date,
    record_time,
    record_timestamp,
    record_type,
    source,
    reason,
    is_manual,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_employee_number,
    '2025-07-14',
    '19:09:01',
    '2025-07-14 19:09:01+09',
    '퇴근',
    'CAPS',
    NULL,
    false,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'attendance_records 새 기록 삽입 완료';
  
  -- ===============================================
  -- 4단계: daily_work_summary 정확히 계산하여 삽입
  -- ===============================================
  
  -- 근무시간 계산:
  -- 11:20 ~ 19:09 = 7시간 49분
  -- 점심시간 1시간 차감 = 6시간 49분 = 6.82시간
  
  INSERT INTO daily_work_summary (
    id,
    user_id,
    work_date,
    check_in_time,
    check_out_time,
    basic_hours,
    overtime_hours,
    night_hours,
    substitute_hours,
    compensatory_hours,
    work_status,
    had_dinner,
    auto_calculated,
    calculated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    '2025-07-14',
    '2025-07-14 11:20:00+09',
    '2025-07-14 19:09:01+09',
    6.82,  -- 실제 근무시간 (7시간 49분 - 점심 1시간)
    0,     -- 연장근무 없음
    0,     -- 야간근무 없음
    0,     -- 대체휴가 시간 없음
    0,     -- 보상휴가 시간 없음
    '정상근무',  -- '반차'가 아닌 '정상근무'로 설정
    false,  -- 저녁식사 없음 (19:09 퇴근)
    false,  -- 수동 계산
    NOW()
  );
  
  RAISE NOTICE 'daily_work_summary 새 기록 삽입 완료';
  
  -- ===============================================
  -- 5단계: monthly_work_stats 업데이트
  -- ===============================================
  
  -- 7월 전체 통계 재계산
  UPDATE monthly_work_stats
  SET 
    total_basic_hours = (
      SELECT COALESCE(SUM(basic_hours), 0)
      FROM daily_work_summary
      WHERE user_id = v_user_id
      AND DATE_TRUNC('month', work_date) = '2025-07-01'
    ),
    total_overtime_hours = (
      SELECT COALESCE(SUM(overtime_hours), 0)
      FROM daily_work_summary
      WHERE user_id = v_user_id
      AND DATE_TRUNC('month', work_date) = '2025-07-01'
    ),
    average_daily_hours = (
      SELECT COALESCE(AVG(basic_hours + overtime_hours), 0)
      FROM daily_work_summary
      WHERE user_id = v_user_id
      AND DATE_TRUNC('month', work_date) = '2025-07-01'
    ),
    updated_at = NOW()
  WHERE user_id = v_user_id
  AND work_month = '2025-07-01';
  
  RAISE NOTICE 'monthly_work_stats 업데이트 완료';
  
END $$;

-- ===============================================
-- 6단계: 수정 결과 확인
-- ===============================================

-- 한종운 7월 14일 최종 결과 확인
SELECT 
  u.name as 직원명,
  dws.work_date as 근무일,
  TO_CHAR(dws.check_in_time, 'HH24:MI') as 출근시간,
  TO_CHAR(dws.check_out_time, 'HH24:MI') as 퇴근시간,
  dws.basic_hours as 기본근무시간,
  dws.work_status as 근무상태,
  CASE 
    WHEN dws.basic_hours = 0 THEN '0시간'
    WHEN dws.basic_hours < 4 THEN '반차 수준'
    WHEN dws.basic_hours >= 6 THEN '정상근무'
    ELSE '기타'
  END as 근무분류
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE u.name = '한종운'
AND dws.work_date = '2025-07-14';

-- attendance_records 확인
SELECT 
  record_type as 구분,
  record_time as 시간,
  source as 소스,
  reason as 사유
FROM attendance_records
WHERE user_id = (SELECT id FROM users WHERE name = '한종운')
AND record_date = '2025-07-14'
ORDER BY record_time;

-- 7월 전체 요약
SELECT 
  COUNT(*) as 근무일수,
  SUM(basic_hours) as 총_기본시간,
  SUM(overtime_hours) as 총_연장시간,
  ROUND(AVG(basic_hours), 2) as 평균_일_근무시간
FROM daily_work_summary
WHERE user_id = (SELECT id FROM users WHERE name = '한종운')
AND DATE_TRUNC('month', work_date) = '2025-07-01';