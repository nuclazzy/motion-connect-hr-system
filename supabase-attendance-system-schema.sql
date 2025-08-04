-- 출퇴근 기록 시스템 데이터베이스 스키마
-- Google Apps Script 근무시간관리 웹앱 기반 구현

-- 연결 확인
SELECT '출퇴근 기록 시스템 스키마 설치 시작' as status;

-- 1. 출퇴근 기록 테이블 생성
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  record_time TIME NOT NULL,
  record_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  record_type VARCHAR(10) NOT NULL CHECK (record_type IN ('출근', '퇴근')),
  reason TEXT, -- 출근 시 사유 (프로젝트명, 업무내용 등)
  location_lat DECIMAL(10, 7), -- 위도
  location_lng DECIMAL(10, 7), -- 경도
  location_accuracy INTEGER, -- 위치 정확도 (미터)
  source VARCHAR(20) DEFAULT 'web', -- 기록 출처 (web, mobile, manual)
  had_dinner BOOLEAN DEFAULT false, -- 저녁식사 여부 (퇴근 시)
  is_manual BOOLEAN DEFAULT false, -- 수동 입력 여부
  approved_by UUID REFERENCES users(id), -- 수동 입력 승인자
  approved_at TIMESTAMP WITH TIME ZONE, -- 승인 시간
  notes TEXT, -- 관리자 메모
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 일별 근무시간 요약 테이블
CREATE TABLE IF NOT EXISTS daily_work_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE, -- 출근 시간
  check_out_time TIMESTAMP WITH TIME ZONE, -- 퇴근 시간
  basic_hours DECIMAL(4,1) DEFAULT 0, -- 기본 근무시간
  overtime_hours DECIMAL(4,1) DEFAULT 0, -- 연장 근무시간
  night_hours DECIMAL(4,1) DEFAULT 0, -- 야간 근무시간
  substitute_hours DECIMAL(4,1) DEFAULT 0, -- 대체휴가 발생시간
  compensatory_hours DECIMAL(4,1) DEFAULT 0, -- 보상휴가 발생시간
  break_minutes INTEGER DEFAULT 0, -- 휴게시간 (분)
  work_status VARCHAR(50), -- 근무상태 (정상근무, 정상근무+저녁, 결근, 휴가 등)
  work_type VARCHAR(20), -- 근무유형 (평일, 휴일, 주말)
  had_dinner BOOLEAN DEFAULT false, -- 저녁식사 여부
  notes TEXT, -- 비고
  is_holiday BOOLEAN DEFAULT false, -- 공휴일 여부
  flex_work_applied BOOLEAN DEFAULT false, -- 탄력근로제 적용 여부
  auto_calculated BOOLEAN DEFAULT true, -- 자동 계산 여부
  calculated_at TIMESTAMP WITH TIME ZONE, -- 계산 시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, work_date)
);

-- 3. 월별 근무시간 통계 테이블
CREATE TABLE IF NOT EXISTS monthly_work_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_month DATE NOT NULL, -- 해당 월 (YYYY-MM-01 형식)
  total_work_days INTEGER DEFAULT 0, -- 총 근무일수
  total_basic_hours DECIMAL(6,1) DEFAULT 0, -- 총 기본 근무시간
  total_overtime_hours DECIMAL(6,1) DEFAULT 0, -- 총 연장 근무시간
  total_night_hours DECIMAL(6,1) DEFAULT 0, -- 총 야간 근무시간
  total_substitute_hours DECIMAL(6,1) DEFAULT 0, -- 총 대체휴가 발생시간
  total_compensatory_hours DECIMAL(6,1) DEFAULT 0, -- 총 보상휴가 발생시간
  average_daily_hours DECIMAL(4,1) DEFAULT 0, -- 일평균 근무시간
  standard_work_hours DECIMAL(6,1) DEFAULT 0, -- 기준 근무시간
  actual_work_hours DECIMAL(6,1) DEFAULT 0, -- 실 근무시간
  recognized_hours DECIMAL(6,1) DEFAULT 0, -- 인정 근무시간 (유급휴가 포함)
  dinner_count INTEGER DEFAULT 0, -- 저녁식사 횟수
  late_count INTEGER DEFAULT 0, -- 지각 횟수
  early_leave_count INTEGER DEFAULT 0, -- 조퇴 횟수
  absent_count INTEGER DEFAULT 0, -- 결근 횟수
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, work_month)
);

-- 4. 공휴일 및 특별근무일 관리 테이블
CREATE TABLE IF NOT EXISTS work_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_date DATE NOT NULL UNIQUE,
  calendar_type VARCHAR(20) NOT NULL CHECK (calendar_type IN ('공휴일', '특별근무일', '휴무일')),
  description TEXT, -- 공휴일명 또는 설명
  is_paid BOOLEAN DEFAULT true, -- 유급 여부
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 탄력근로제 설정 테이블
CREATE TABLE IF NOT EXISTS flex_work_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_standard_hours INTEGER DEFAULT 8, -- 일 기준 근무시간
  weekly_standard_hours INTEGER DEFAULT 40, -- 주 기준 근무시간
  overtime_threshold INTEGER DEFAULT 8, -- 연장근무 기준시간
  description TEXT, -- 탄력근로제 설명
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date ON attendance_records(user_id, record_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_timestamp ON attendance_records(record_timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_records_type ON attendance_records(record_type);
CREATE INDEX IF NOT EXISTS idx_daily_work_summary_user_date ON daily_work_summary(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_daily_work_summary_date ON daily_work_summary(work_date);
CREATE INDEX IF NOT EXISTS idx_monthly_work_stats_month ON monthly_work_stats(work_month);
CREATE INDEX IF NOT EXISTS idx_work_calendar_date ON work_calendar(calendar_date);
CREATE INDEX IF NOT EXISTS idx_flex_work_settings_dates ON flex_work_settings(start_date, end_date);

-- 7. 자동 업데이트 트리거 함수들

-- 출퇴근 기록 시 자동 계산 함수
CREATE OR REPLACE FUNCTION calculate_daily_work_time()
RETURNS TRIGGER AS $$
DECLARE
  check_in_record TIMESTAMP WITH TIME ZONE;
  check_out_record TIMESTAMP WITH TIME ZONE;
  work_minutes INTEGER;
  break_minutes INTEGER := 0;
  basic_hours DECIMAL(4,1) := 0;
  overtime_hours DECIMAL(4,1) := 0;
  night_hours DECIMAL(4,1) := 0;
  work_status TEXT := '';
  is_holiday BOOLEAN := false;
  overtime_threshold INTEGER := 8;
BEGIN
  -- 해당 날짜의 공휴일 여부 확인
  SELECT EXISTS(
    SELECT 1 FROM work_calendar 
    WHERE calendar_date = NEW.record_date 
    AND calendar_type = '공휴일'
  ) INTO is_holiday;

  -- 탄력근로제 설정 확인
  SELECT COALESCE(
    (SELECT overtime_threshold 
     FROM flex_work_settings 
     WHERE NEW.record_date BETWEEN start_date AND end_date 
     AND is_active = true 
     LIMIT 1), 8
  ) INTO overtime_threshold;

  -- 해당 날짜의 출근/퇴근 기록 조회
  SELECT 
    MIN(CASE WHEN record_type = '출근' THEN record_timestamp END),
    MAX(CASE WHEN record_type = '퇴근' THEN record_timestamp END)
  INTO check_in_record, check_out_record
  FROM attendance_records 
  WHERE user_id = NEW.user_id 
  AND record_date = NEW.record_date;

  -- 출퇴근이 모두 기록된 경우 근무시간 계산
  IF check_in_record IS NOT NULL AND check_out_record IS NOT NULL THEN
    work_minutes := EXTRACT(EPOCH FROM (check_out_record - check_in_record)) / 60;
    
    -- 휴게시간 계산 (4시간 이상 근무 시 1시간, 저녁식사 시 추가 1시간)
    IF work_minutes >= 240 THEN
      break_minutes := 60;
    END IF;
    
    -- 저녁식사 여부 확인
    IF NEW.record_type = '퇴근' AND NEW.had_dinner = true THEN
      break_minutes := break_minutes + 60;
      work_status := work_status || '+저녁';
    END IF;

    -- 실 근무시간 계산 (총 근무시간 - 휴게시간)
    basic_hours := ROUND(((work_minutes - break_minutes) / 60.0)::NUMERIC, 1);
    
    -- 연장근무시간 계산
    IF basic_hours > overtime_threshold THEN
      overtime_hours := basic_hours - overtime_threshold;
      basic_hours := overtime_threshold;
    END IF;

    -- 야간근무시간 계산 (22시~06시)
    -- 이 부분은 복잡한 로직이므로 별도 함수로 분리 가능

    work_status := '정상근무' || work_status;
  ELSE
    -- 출근 또는 퇴근 기록이 누락된 경우
    IF check_in_record IS NOT NULL THEN
      work_status := '퇴근기록누락';
    ELSIF check_out_record IS NOT NULL THEN
      work_status := '출근기록누락';
    END IF;
  END IF;

  -- daily_work_summary 테이블에 삽입 또는 업데이트
  INSERT INTO daily_work_summary (
    user_id, work_date, check_in_time, check_out_time,
    basic_hours, overtime_hours, night_hours,
    break_minutes, work_status, is_holiday,
    had_dinner, calculated_at
  ) VALUES (
    NEW.user_id, NEW.record_date, check_in_record, check_out_record,
    basic_hours, overtime_hours, night_hours,
    break_minutes, work_status, is_holiday,
    NEW.had_dinner, NOW()
  )
  ON CONFLICT (user_id, work_date) 
  DO UPDATE SET
    check_in_time = EXCLUDED.check_in_time,
    check_out_time = EXCLUDED.check_out_time,
    basic_hours = EXCLUDED.basic_hours,
    overtime_hours = EXCLUDED.overtime_hours,
    night_hours = EXCLUDED.night_hours,
    break_minutes = EXCLUDED.break_minutes,
    work_status = EXCLUDED.work_status,
    is_holiday = EXCLUDED.is_holiday,
    had_dinner = EXCLUDED.had_dinner,
    calculated_at = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 출퇴근 기록 자동 계산 트리거
DROP TRIGGER IF EXISTS trigger_calculate_daily_work_time ON attendance_records;
CREATE TRIGGER trigger_calculate_daily_work_time
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_daily_work_time();

-- 월별 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_monthly_work_stats()
RETURNS TRIGGER AS $$
DECLARE
  work_month_date DATE;
  total_days INTEGER;
  total_basic DECIMAL(6,1);
  total_overtime DECIMAL(6,1);
  avg_daily DECIMAL(4,1);
  dinner_cnt INTEGER;
BEGIN
  work_month_date := DATE_TRUNC('month', NEW.work_date)::DATE;
  
  -- 해당 월의 통계 계산
  SELECT 
    COUNT(*)::INTEGER,
    COALESCE(SUM(basic_hours), 0)::DECIMAL(6,1),
    COALESCE(SUM(overtime_hours), 0)::DECIMAL(6,1),
    COALESCE(AVG(basic_hours + overtime_hours), 0)::DECIMAL(4,1),
    COUNT(CASE WHEN had_dinner THEN 1 END)::INTEGER
  INTO total_days, total_basic, total_overtime, avg_daily, dinner_cnt
  FROM daily_work_summary
  WHERE user_id = NEW.user_id
  AND work_date >= work_month_date
  AND work_date < work_month_date + INTERVAL '1 month';

  -- monthly_work_stats 테이블에 삽입 또는 업데이트
  INSERT INTO monthly_work_stats (
    user_id, work_month, total_work_days,
    total_basic_hours, total_overtime_hours,
    average_daily_hours, dinner_count
  ) VALUES (
    NEW.user_id, work_month_date, total_days,
    total_basic, total_overtime, avg_daily, dinner_cnt
  )
  ON CONFLICT (user_id, work_month)
  DO UPDATE SET
    total_work_days = EXCLUDED.total_work_days,
    total_basic_hours = EXCLUDED.total_basic_hours,
    total_overtime_hours = EXCLUDED.total_overtime_hours,
    average_daily_hours = EXCLUDED.average_daily_hours,
    dinner_count = EXCLUDED.dinner_count,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 월별 통계 업데이트 트리거
DROP TRIGGER IF EXISTS trigger_update_monthly_stats ON daily_work_summary;
CREATE TRIGGER trigger_update_monthly_stats
  AFTER INSERT OR UPDATE ON daily_work_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_work_stats();

-- 8. 기본 데이터 삽입

-- 2024년 공휴일 삽입 (예시)
INSERT INTO work_calendar (calendar_date, calendar_type, description) VALUES
  ('2024-01-01', '공휴일', '신정'),
  ('2024-02-09', '공휴일', '설날 연휴'),
  ('2024-02-10', '공휴일', '설날'),
  ('2024-02-11', '공휴일', '설날 연휴'),
  ('2024-02-12', '공휴일', '대체공휴일'),
  ('2024-03-01', '공휴일', '삼일절'),
  ('2024-04-10', '공휴일', '국회의원선거일'),
  ('2024-05-05', '공휴일', '어린이날'),
  ('2024-05-06', '공휴일', '대체공휴일'),
  ('2024-05-15', '공휴일', '부처님오신날'),
  ('2024-06-06', '공휴일', '현충일'),
  ('2024-08-15', '공휴일', '광복절'),
  ('2024-09-16', '공휴일', '추석 연휴'),
  ('2024-09-17', '공휴일', '추석'),
  ('2024-09-18', '공휴일', '추석 연휴'),
  ('2024-10-03', '공휴일', '개천절'),
  ('2024-10-09', '공휴일', '한글날'),
  ('2024-12-25', '공휴일', '크리스마스')
ON CONFLICT (calendar_date) DO NOTHING;

-- 2025년 공휴일 삽입
INSERT INTO work_calendar (calendar_date, calendar_type, description) VALUES
  ('2025-01-01', '공휴일', '신정'),
  ('2025-01-28', '공휴일', '설날 연휴'),
  ('2025-01-29', '공휴일', '설날'),
  ('2025-01-30', '공휴일', '설날 연휴'),
  ('2025-03-01', '공휴일', '삼일절'),
  ('2025-05-05', '공휴일', '어린이날'),
  ('2025-05-12', '공휴일', '부처님오신날'),
  ('2025-06-06', '공휴일', '현충일'),
  ('2025-08-15', '공휴일', '광복절'),
  ('2025-10-03', '공휴일', '개천절'),
  ('2025-10-06', '공휴일', '추석 연휴'),
  ('2025-10-07', '공휴일', '추석'),
  ('2025-10-08', '공휴일', '추석 연휴'),
  ('2025-10-09', '공휴일', '한글날'),
  ('2025-12-25', '공휴일', '크리스마스')
ON CONFLICT (calendar_date) DO NOTHING;

-- 9. 뷰 생성 (조회 최적화)

-- 최근 출퇴근 기록 뷰
CREATE OR REPLACE VIEW recent_attendance_view AS
SELECT 
  ar.id,
  ar.user_id,
  u.name as user_name,
  u.department,
  ar.record_date,
  ar.record_time,
  ar.record_type,
  ar.reason,
  ar.source,
  ar.had_dinner,
  ar.created_at
FROM attendance_records ar
JOIN users u ON ar.user_id = u.id
WHERE ar.record_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY ar.record_timestamp DESC;

-- 일별 근무 현황 뷰
CREATE OR REPLACE VIEW daily_work_status_view AS
SELECT 
  dws.id,
  dws.user_id,
  u.name as user_name,
  u.department,
  dws.work_date,
  dws.check_in_time,
  dws.check_out_time,
  dws.basic_hours,
  dws.overtime_hours,
  dws.work_status,
  dws.had_dinner,
  dws.is_holiday,
  CASE 
    WHEN dws.check_in_time IS NULL THEN '출근기록없음'
    WHEN dws.check_out_time IS NULL THEN '퇴근기록없음'
    WHEN EXTRACT(hour FROM dws.check_in_time) > 9 THEN '지각'
    ELSE '정상'
  END as attendance_status
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
ORDER BY dws.work_date DESC, u.name;

-- 10. 테스트 및 검증 쿼리

-- 테이블 생성 확인
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'attendance_records', 'daily_work_summary', 
    'monthly_work_stats', 'work_calendar', 'flex_work_settings'
  )
ORDER BY table_name;

-- 트리거 생성 확인
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE event_object_table IN (
  'attendance_records', 'daily_work_summary'
)
ORDER BY event_object_table, trigger_name;

-- 인덱스 생성 확인
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN (
  'attendance_records', 'daily_work_summary', 
  'monthly_work_stats', 'work_calendar'
)
ORDER BY tablename, indexname;

-- 성공 메시지
SELECT '✅ 출퇴근 기록 시스템 데이터베이스 스키마가 성공적으로 생성되었습니다.' as result;

/*
사용법 및 주요 기능:

1. 출퇴근 기록
   - attendance_records 테이블에 실시간 출퇴근 기록 저장
   - 위치 정보, 사유, 저녁식사 여부 등 상세 정보 포함

2. 자동 근무시간 계산
   - 출퇴근 기록 시 자동으로 일별 근무시간 계산
   - 연장근무, 야간근무, 휴게시간 자동 처리

3. 월별 통계
   - 일별 데이터를 기반으로 월별 통계 자동 생성
   - 총 근무시간, 평균 근무시간, 초과근무 현황 등

4. 공휴일 관리
   - work_calendar 테이블로 공휴일 및 특별근무일 관리
   - 휴일 근무 시 특별 계산 로직 적용

5. 탄력근로제 지원
   - flex_work_settings 테이블로 유연한 근무제도 설정
   - 기간별로 다른 근무시간 기준 적용

주의사항:
- 야간근무시간 계산 로직은 복잡하므로 추가 구현 필요
- 실제 운영 시 데이터 검증 및 보정 기능 추가 권장
- 대용량 데이터 처리를 위한 파티셔닝 고려 필요
*/