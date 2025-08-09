-- 6월과 7월 출퇴근 데이터 완전 초기화
-- Supabase SQL Editor에서 실행하세요
-- ⚠️ 주의: 이 스크립트는 6월과 7월의 모든 출퇴근 데이터를 삭제합니다!

-- ===============================================
-- 실행 전 백업 확인 (선택사항)
-- ===============================================
-- 삭제될 데이터 미리보기
SELECT 
  'attendance_records' as table_name,
  COUNT(*) as record_count,
  MIN(record_date) as start_date,
  MAX(record_date) as end_date
FROM attendance_records
WHERE record_date >= '2025-06-01' AND record_date <= '2025-07-31'
UNION ALL
SELECT 
  'daily_work_summary' as table_name,
  COUNT(*) as record_count,
  MIN(work_date) as start_date,
  MAX(work_date) as end_date
FROM daily_work_summary
WHERE work_date >= '2025-06-01' AND work_date <= '2025-07-31'
UNION ALL
SELECT 
  'monthly_work_stats' as table_name,
  COUNT(*) as record_count,
  MIN(work_month) as start_date,
  MAX(work_month) as end_date
FROM monthly_work_stats
WHERE work_month IN ('2025-06-01', '2025-07-01');

-- ===============================================
-- 데이터 삭제 시작 (트랜잭션으로 안전하게 처리)
-- ===============================================
BEGIN;

-- 1. attendance_records 테이블 - 6월과 7월 데이터 삭제
DELETE FROM attendance_records 
WHERE record_date >= '2025-06-01' 
  AND record_date <= '2025-07-31';

-- 삭제된 레코드 수 확인
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ attendance_records 삭제 완료: %건', deleted_count;
END $$;

-- 2. daily_work_summary 테이블 - 6월과 7월 데이터 삭제
DELETE FROM daily_work_summary 
WHERE work_date >= '2025-06-01' 
  AND work_date <= '2025-07-31';

-- 삭제된 레코드 수 확인
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ daily_work_summary 삭제 완료: %건', deleted_count;
END $$;

-- 3. monthly_work_stats 테이블 - 6월과 7월 통계 삭제
DELETE FROM monthly_work_stats 
WHERE work_month IN ('2025-06-01', '2025-07-01');

-- 삭제된 레코드 수 확인
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ monthly_work_stats 삭제 완료: %건', deleted_count;
END $$;

-- 트랜잭션 커밋
COMMIT;

-- ===============================================
-- 삭제 결과 확인
-- ===============================================
SELECT 
  '삭제 완료!' as status,
  (SELECT COUNT(*) FROM attendance_records 
   WHERE record_date >= '2025-06-01' AND record_date <= '2025-07-31') as remaining_attendance,
  (SELECT COUNT(*) FROM daily_work_summary 
   WHERE work_date >= '2025-06-01' AND work_date <= '2025-07-31') as remaining_daily,
  (SELECT COUNT(*) FROM monthly_work_stats 
   WHERE work_month IN ('2025-06-01', '2025-07-01')) as remaining_monthly;

-- ===============================================
-- CSV 재업로드 준비 완료 메시지
-- ===============================================
SELECT 
  '🎯 초기화 완료!' as message,
  '이제 CSV 파일을 다시 업로드할 수 있습니다.' as next_step,
  '덮어쓰기 모드를 사용할 필요가 없습니다 (데이터가 비어있음)' as note;