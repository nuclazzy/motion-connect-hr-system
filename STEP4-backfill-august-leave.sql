-- STEP 4: 8월 승인된 연차 데이터 소급 적용
-- 이미 승인된 8월 연차에 대해 8시간 근무시간 자동 인정

-- 8월 승인된 연차 신청서를 찾아서 해당 날짜에 8시간 근무시간 인정
INSERT INTO daily_work_summary (
  user_id, 
  work_date, 
  basic_hours, 
  work_status,
  auto_calculated, 
  calculated_at,
  updated_at
)
SELECT 
  fr.user_id,
  generate_series(
    COALESCE((fr.request_data->>'시작일')::DATE, fr.created_at::DATE),
    COALESCE((fr.request_data->>'종료일')::DATE, fr.created_at::DATE),
    '1 day'::interval
  )::DATE as work_date,
  CASE 
    WHEN fr.request_data->>'휴가형태' LIKE '%반차%' THEN 4.0
    WHEN fr.request_data->>'휴가형태' LIKE '%시간차%' THEN 
      COALESCE((fr.request_data->>'hours')::DECIMAL, 0)
    ELSE 8.0
  END as basic_hours,
  CASE 
    WHEN fr.request_data->>'휴가형태' LIKE '%반차%' THEN '반차(유급)'
    WHEN fr.request_data->>'휴가형태' LIKE '%시간차%' THEN '시간차(유급)'
    ELSE '연차(유급)'
  END as work_status,
  true as auto_calculated,
  NOW() as calculated_at,
  NOW() as updated_at
FROM form_requests fr
WHERE fr.status = 'approved'
  AND fr.form_type = '휴가 신청서'
  AND (
    -- 8월에 시작하는 휴가
    COALESCE((fr.request_data->>'시작일')::DATE, fr.created_at::DATE) >= '2025-08-01'
    -- 또는 8월에 끝나는 휴가
    OR COALESCE((fr.request_data->>'종료일')::DATE, fr.created_at::DATE) >= '2025-08-01'
  )
  -- 8월 이후만 처리
  AND generate_series(
    COALESCE((fr.request_data->>'시작일')::DATE, fr.created_at::DATE),
    COALESCE((fr.request_data->>'종료일')::DATE, fr.created_at::DATE),
    '1 day'::interval
  )::DATE >= '2025-08-01'
ON CONFLICT (user_id, work_date) 
DO UPDATE SET
  basic_hours = EXCLUDED.basic_hours,
  work_status = EXCLUDED.work_status,
  auto_calculated = true,
  calculated_at = NOW(),
  updated_at = NOW();

-- 소급 적용 결과 확인
SELECT 
  u.name as 직원명,
  COUNT(*) as 소급적용된날수,
  SUM(dws.basic_hours) as 총인정시간
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.work_date >= '2025-08-01'
  AND dws.work_status LIKE '%유급%'
  AND dws.auto_calculated = true
  AND dws.calculated_at >= NOW() - INTERVAL '1 minute'
GROUP BY u.id, u.name
ORDER BY u.name;

-- 완료 메시지
SELECT '8월 승인된 연차 데이터 소급 적용 완료' as status;