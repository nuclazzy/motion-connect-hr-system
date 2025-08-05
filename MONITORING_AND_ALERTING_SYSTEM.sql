-- 🔍 Motion Connect HR 시스템 모니터링 및 알림 시스템
-- Supabase 환경에서 장기적 안정성 보장을 위한 종합 모니터링 시스템

-- ====================================================================
-- 1. 시스템 건강도 모니터링 테이블
-- ====================================================================

-- 시스템 건강도 체크 로그 테이블
CREATE TABLE IF NOT EXISTS system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type VARCHAR(50) NOT NULL, -- 'database', 'attendance', 'calendar', 'performance'
  check_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'error')),
  metric_value DECIMAL(12,4),
  threshold_value DECIMAL(12,4),
  details JSONB,
  error_message TEXT,
  check_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 알림 설정 테이블
CREATE TABLE IF NOT EXISTS alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_name VARCHAR(100) NOT NULL UNIQUE,
  check_type VARCHAR(50) NOT NULL,
  threshold_warning DECIMAL(12,4),
  threshold_critical DECIMAL(12,4),
  is_enabled BOOLEAN DEFAULT true,
  notification_channels JSONB DEFAULT '[]'::JSONB, -- ['email', 'slack', 'webhook']
  check_interval_minutes INTEGER DEFAULT 60,
  escalation_rules JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 알림 히스토리 테이블
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_name VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('warning', 'critical', 'resolved')),
  message TEXT NOT NULL,
  details JSONB,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by VARCHAR(100),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_system_health_logs_type_created 
ON system_health_logs(check_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_logs_status_created 
ON system_health_logs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_severity_created 
ON alert_history(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_acknowledged 
ON alert_history(is_acknowledged, created_at DESC);

-- ====================================================================
-- 2. 종합 시스템 건강도 체크 함수
-- ====================================================================

CREATE OR REPLACE FUNCTION comprehensive_system_health_check()
RETURNS TABLE(
  overall_status VARCHAR(20),
  check_count INTEGER,
  healthy_count INTEGER,
  warning_count INTEGER,
  critical_count INTEGER,
  error_count INTEGER,
  check_details JSONB
) AS $$
DECLARE
  v_overall_status VARCHAR(20) := 'healthy';
  v_check_count INTEGER := 0;
  v_healthy INTEGER := 0;
  v_warning INTEGER := 0;
  v_critical INTEGER := 0;
  v_error INTEGER := 0;
  v_check_details JSONB := '[]'::JSONB;
  v_check_result RECORD;
  v_start_time TIMESTAMP;
  v_duration INTEGER;
BEGIN
  v_start_time := clock_timestamp();

  -- 1. 데이터베이스 연결 및 기본 상태 체크
  BEGIN
    PERFORM 1;
    v_check_count := v_check_count + 1;
    v_healthy := v_healthy + 1;
    
    v_check_details := v_check_details || jsonb_build_object(
      'check_name', 'database_connection',
      'status', 'healthy',
      'message', '데이터베이스 연결 정상'
    );
    
    INSERT INTO system_health_logs (check_type, check_name, status, details, check_duration_ms)
    VALUES ('database', 'connection', 'healthy', '{"message": "데이터베이스 연결 정상"}'::JSONB, 
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER);
  EXCEPTION
    WHEN OTHERS THEN
      v_check_count := v_check_count + 1;
      v_error := v_error + 1;
      v_overall_status := 'error';
  END;

  -- 2. 출퇴근 데이터 정합성 체크
  BEGIN
    WITH attendance_check AS (
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN record_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_records,
        COUNT(CASE WHEN source = 'CAPS' AND record_date >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as caps_records
      FROM attendance_records
    )
    SELECT * INTO v_check_result FROM attendance_check;
    
    v_check_count := v_check_count + 1;
    
    IF v_check_result.recent_records = 0 THEN
      v_critical := v_critical + 1;
      v_overall_status := 'critical';
      v_check_details := v_check_details || jsonb_build_object(
        'check_name', 'attendance_data_freshness',
        'status', 'critical',
        'message', '최근 7일간 출퇴근 기록 없음'
      );
      
      INSERT INTO system_health_logs (check_type, check_name, status, details, check_duration_ms)
      VALUES ('attendance', 'data_freshness', 'critical', 
              jsonb_build_object('recent_records', v_check_result.recent_records),
              EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER);
    ELSE
      v_healthy := v_healthy + 1;
      v_check_details := v_check_details || jsonb_build_object(
        'check_name', 'attendance_data_freshness',
        'status', 'healthy',
        'message', '출퇴근 데이터 정상',
        'recent_records', v_check_result.recent_records
      );
      
      INSERT INTO system_health_logs (check_type, check_name, status, metric_value, details, check_duration_ms)
      VALUES ('attendance', 'data_freshness', 'healthy', v_check_result.recent_records,
              jsonb_build_object('recent_records', v_check_result.recent_records),
              EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_check_count := v_check_count + 1;
      v_error := v_error + 1;
      v_overall_status := 'error';
  END;

  -- 3. 중복 출퇴근 기록 체크
  BEGIN
    WITH duplicate_check AS (
      SELECT COUNT(*) as duplicate_count
      FROM (
        SELECT user_id, record_timestamp, record_type, COUNT(*) as cnt
        FROM attendance_records
        WHERE record_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY user_id, record_timestamp, record_type
        HAVING COUNT(*) > 1
      ) duplicates
    )
    SELECT duplicate_count INTO v_check_result FROM duplicate_check;
    
    v_check_count := v_check_count + 1;
    
    IF v_check_result.duplicate_count > 0 THEN
      v_warning := v_warning + 1;
      IF v_overall_status = 'healthy' THEN v_overall_status := 'warning'; END IF;
      
      v_check_details := v_check_details || jsonb_build_object(
        'check_name', 'attendance_duplicates',
        'status', 'warning',
        'message', '중복 출퇴근 기록 발견: ' || v_check_result.duplicate_count || '건'
      );
      
      INSERT INTO system_health_logs (check_type, check_name, status, metric_value, details, check_duration_ms)
      VALUES ('attendance', 'duplicates', 'warning', v_check_result.duplicate_count,
              jsonb_build_object('duplicate_count', v_check_result.duplicate_count),
              EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER);
    ELSE
      v_healthy := v_healthy + 1;
      v_check_details := v_check_details || jsonb_build_object(
        'check_name', 'attendance_duplicates',
        'status', 'healthy',
        'message', '중복 기록 없음'
      );
      
      INSERT INTO system_health_logs (check_type, check_name, status, metric_value, details, check_duration_ms)
      VALUES ('attendance', 'duplicates', 'healthy', 0,
              jsonb_build_object('duplicate_count', 0),
              EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_check_count := v_check_count + 1;
      v_error := v_error + 1;
      v_overall_status := 'error';
  END;

  -- 4. 캘린더 동기화 상태 체크
  BEGIN
    WITH calendar_sync_check AS (
      SELECT 
        COUNT(*) as total_calendars,
        COUNT(CASE WHEN last_sync_at IS NULL THEN 1 END) as never_synced,
        COUNT(CASE WHEN last_sync_at < NOW() - INTERVAL '2 days' THEN 1 END) as stale_sync,
        COUNT(CASE WHEN sync_error_count > 5 THEN 1 END) as error_calendars
      FROM calendar_configs
      WHERE config_type = 'function' AND is_active = true
    )
    SELECT * INTO v_check_result FROM calendar_sync_check;
    
    v_check_count := v_check_count + 1;
    
    IF v_check_result.error_calendars > 0 OR v_check_result.never_synced > 0 THEN
      v_critical := v_critical + 1;
      v_overall_status := 'critical';
      
      v_check_details := v_check_details || jsonb_build_object(
        'check_name', 'calendar_sync_status',
        'status', 'critical',
        'message', '캘린더 동기화 오류: ' || v_check_result.error_calendars || '개, 미동기화: ' || v_check_result.never_synced || '개'
      );
      
      INSERT INTO system_health_logs (check_type, check_name, status, details, check_duration_ms)
      VALUES ('calendar', 'sync_status', 'critical',
              jsonb_build_object('error_calendars', v_check_result.error_calendars, 'never_synced', v_check_result.never_synced),
              EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER);
    ELSIF v_check_result.stale_sync > 0 THEN
      v_warning := v_warning + 1;
      IF v_overall_status = 'healthy' THEN v_overall_status := 'warning'; END IF;
      
      v_check_details := v_check_details || jsonb_build_object(
        'check_name', 'calendar_sync_status',
        'status', 'warning',
        'message', '오래된 동기화: ' || v_check_result.stale_sync || '개'
      );
      
      INSERT INTO system_health_logs (check_type, check_name, status, details, check_duration_ms)
      VALUES ('calendar', 'sync_status', 'warning',
              jsonb_build_object('stale_sync', v_check_result.stale_sync),
              EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER);
    ELSE
      v_healthy := v_healthy + 1;
      v_check_details := v_check_details || jsonb_build_object(
        'check_name', 'calendar_sync_status',
        'status', 'healthy',
        'message', '캘린더 동기화 정상'
      );
      
      INSERT INTO system_health_logs (check_type, check_name, status, details, check_duration_ms)
      VALUES ('calendar', 'sync_status', 'healthy',
              jsonb_build_object('total_calendars', v_check_result.total_calendars),
              EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_check_count := v_check_count + 1;
      v_error := v_error + 1;
      v_overall_status := 'error';
  END;

  -- 5. 데이터베이스 성능 체크
  BEGIN
    WITH performance_check AS (
      SELECT 
        (SELECT COUNT(*) FROM attendance_records WHERE created_at >= NOW() - INTERVAL '1 hour') as recent_inserts,
        (SELECT pg_database_size(current_database())) as db_size_bytes,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
    )
    SELECT * INTO v_check_result FROM performance_check;
    
    v_check_count := v_check_count + 1;
    
    -- 데이터베이스 크기가 1GB 이상이면 경고
    IF v_check_result.db_size_bytes > 1073741824 THEN -- 1GB
      v_warning := v_warning + 1;
      IF v_overall_status = 'healthy' THEN v_overall_status := 'warning'; END IF;
      
      v_check_details := v_check_details || jsonb_build_object(
        'check_name', 'database_performance',
        'status', 'warning',
        'message', '데이터베이스 크기 주의: ' || ROUND(v_check_result.db_size_bytes::DECIMAL / 1048576, 2) || 'MB'
      );
    ELSE
      v_healthy := v_healthy + 1;
      v_check_details := v_check_details || jsonb_build_object(
        'check_name', 'database_performance',
        'status', 'healthy',
        'message', '데이터베이스 성능 정상'
      );
    END IF;
    
    INSERT INTO system_health_logs (check_type, check_name, status, metric_value, details, check_duration_ms)
    VALUES ('performance', 'database_size', 
            CASE WHEN v_check_result.db_size_bytes > 1073741824 THEN 'warning' ELSE 'healthy' END,
            v_check_result.db_size_bytes::DECIMAL / 1048576, -- MB 단위
            jsonb_build_object('db_size_mb', ROUND(v_check_result.db_size_bytes::DECIMAL / 1048576, 2)),
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER);
  EXCEPTION
    WHEN OTHERS THEN
      v_check_count := v_check_count + 1;
      v_error := v_error + 1;
      v_overall_status := 'error';
  END;

  -- 전체 체크 시간 계산
  v_duration := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER;

  -- 결과 반환
  overall_status := v_overall_status;
  check_count := v_check_count;
  healthy_count := v_healthy;
  warning_count := v_warning;
  critical_count := v_critical;
  error_count := v_error;
  check_details := v_check_details;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 3. 알림 생성 및 관리 함수
-- ====================================================================

CREATE OR REPLACE FUNCTION generate_alerts_from_health_check()
RETURNS TABLE(
  alerts_generated INTEGER,
  alerts_resolved INTEGER,
  alert_details JSONB
) AS $$
DECLARE
  v_alerts_generated INTEGER := 0;
  v_alerts_resolved INTEGER := 0;
  v_alert_details JSONB := '[]'::JSONB;
  v_health_result RECORD;
  v_alert_config RECORD;
  v_existing_alert RECORD;
BEGIN
  -- 최신 건강도 체크 실행
  SELECT * INTO v_health_result FROM comprehensive_system_health_check();
  
  -- 각 알림 설정에 대해 체크
  FOR v_alert_config IN 
    SELECT * FROM alert_configurations WHERE is_enabled = true
  LOOP
    -- 해당 알림에 대한 최근 미해결 알림 확인
    SELECT * INTO v_existing_alert 
    FROM alert_history 
    WHERE alert_name = v_alert_config.alert_name 
    AND severity IN ('warning', 'critical')
    AND resolved_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- 건강도 체크 결과에 따른 알림 생성/해결
    IF v_health_result.critical_count > 0 OR v_health_result.error_count > 0 THEN
      -- 심각한 문제 발생
      IF v_existing_alert.id IS NULL OR v_existing_alert.severity != 'critical' THEN
        INSERT INTO alert_history (alert_name, severity, message, details)
        VALUES (
          v_alert_config.alert_name,
          'critical',
          '시스템 심각한 문제 발생: ' || v_health_result.critical_count || '개 critical, ' || v_health_result.error_count || '개 error',
          jsonb_build_object(
            'overall_status', v_health_result.overall_status,
            'check_summary', jsonb_build_object(
              'total', v_health_result.check_count,
              'healthy', v_health_result.healthy_count,
              'warning', v_health_result.warning_count,
              'critical', v_health_result.critical_count,
              'error', v_health_result.error_count
            )
          )
        );
        v_alerts_generated := v_alerts_generated + 1;
      END IF;
    ELSIF v_health_result.warning_count > 0 THEN
      -- 경고 상황
      IF v_existing_alert.id IS NULL THEN
        INSERT INTO alert_history (alert_name, severity, message, details)
        VALUES (
          v_alert_config.alert_name,
          'warning',
          '시스템 경고: ' || v_health_result.warning_count || '개 warning',
          jsonb_build_object(
            'overall_status', v_health_result.overall_status,
            'warning_count', v_health_result.warning_count
          )
        );
        v_alerts_generated := v_alerts_generated + 1;
      END IF;
    ELSE
      -- 정상 상황 - 기존 알림 해결
      IF v_existing_alert.id IS NOT NULL THEN
        UPDATE alert_history 
        SET 
          severity = 'resolved',
          resolved_at = NOW(),
          details = details || jsonb_build_object('resolved_reason', '건강도 체크 정상화')
        WHERE id = v_existing_alert.id;
        v_alerts_resolved := v_alerts_resolved + 1;
      END IF;
    END IF;
  END LOOP;
  
  v_alert_details := jsonb_build_object(
    'health_check_result', jsonb_build_object(
      'overall_status', v_health_result.overall_status,
      'check_count', v_health_result.check_count,
      'healthy_count', v_health_result.healthy_count,
      'warning_count', v_health_result.warning_count,
      'critical_count', v_health_result.critical_count,
      'error_count', v_health_result.error_count
    )
  );
  
  alerts_generated := v_alerts_generated;
  alerts_resolved := v_alerts_resolved;
  alert_details := v_alert_details;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 4. 시스템 건강도 대시보드 뷰
-- ====================================================================

CREATE OR REPLACE VIEW system_health_dashboard AS
WITH recent_checks AS (
  SELECT DISTINCT ON (check_type, check_name)
    check_type,
    check_name,
    status,
    metric_value,
    details,
    created_at
  FROM system_health_logs
  ORDER BY check_type, check_name, created_at DESC
),
alert_summary AS (
  SELECT 
    COUNT(CASE WHEN severity = 'critical' AND resolved_at IS NULL THEN 1 END) as active_critical,
    COUNT(CASE WHEN severity = 'warning' AND resolved_at IS NULL THEN 1 END) as active_warnings,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as alerts_24h
  FROM alert_history
),
health_summary AS (
  SELECT 
    COUNT(*) as total_checks,
    COUNT(CASE WHEN status = 'healthy' THEN 1 END) as healthy_checks,
    COUNT(CASE WHEN status = 'warning' THEN 1 END) as warning_checks,
    COUNT(CASE WHEN status = 'critical' THEN 1 END) as critical_checks,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_checks
  FROM recent_checks
)
SELECT 
  -- 전체 상태
  CASE 
    WHEN hs.critical_checks > 0 OR hs.error_checks > 0 THEN 'critical'
    WHEN hs.warning_checks > 0 THEN 'warning'
    ELSE 'healthy'
  END as overall_status,
  
  -- 건강도 요약
  hs.total_checks,
  hs.healthy_checks,
  hs.warning_checks,
  hs.critical_checks,
  hs.error_checks,
  
  -- 알림 요약
  als.active_critical,
  als.active_warnings,
  als.alerts_24h,
  
  -- 건강도 점수 (0-100)
  CASE 
    WHEN hs.total_checks = 0 THEN 0
    ELSE ROUND((hs.healthy_checks::DECIMAL / hs.total_checks * 100), 1)
  END as health_score,
  
  -- 최종 체크 시간
  (SELECT MAX(created_at) FROM system_health_logs) as last_check_at,
  
  -- 상세 체크 결과
  jsonb_agg(
    jsonb_build_object(
      'check_type', rc.check_type,
      'check_name', rc.check_name,
      'status', rc.status,
      'metric_value', rc.metric_value,
      'details', rc.details,
      'checked_at', rc.created_at
    )
  ) as check_details

FROM health_summary hs
CROSS JOIN alert_summary als
CROSS JOIN recent_checks rc
GROUP BY hs.total_checks, hs.healthy_checks, hs.warning_checks, hs.critical_checks, hs.error_checks,
         als.active_critical, als.active_warnings, als.alerts_24h;

-- ====================================================================
-- 5. 기본 알림 설정 및 초기 데이터
-- ====================================================================

-- 기본 알림 설정 추가
INSERT INTO alert_configurations (
  alert_name, check_type, threshold_warning, threshold_critical, 
  is_enabled, notification_channels, check_interval_minutes
) VALUES 
  ('출퇴근_데이터_신선도', 'attendance', 24, 72, true, '["email"]'::JSONB, 60),
  ('캘린더_동기화_상태', 'calendar', 48, 120, true, '["email"]'::JSONB, 120),
  ('데이터베이스_성능', 'performance', 500, 1000, true, '["email"]'::JSONB, 240),
  ('시스템_전반_건강도', 'database', 1, 3, true, '["email", "webhook"]'::JSONB, 30)
ON CONFLICT (alert_name) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  check_interval_minutes = EXCLUDED.check_interval_minutes,
  updated_at = NOW();

-- ====================================================================
-- 6. 자동 정리 함수 (로그 크기 관리)
-- ====================================================================

CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data()
RETURNS TABLE(
  cleaned_health_logs INTEGER,
  cleaned_alert_history INTEGER,
  cleanup_details JSONB
) AS $$
DECLARE
  v_cleaned_health INTEGER;
  v_cleaned_alerts INTEGER;
BEGIN
  -- 30일 이상 된 건강도 로그 정리
  DELETE FROM system_health_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_cleaned_health = ROW_COUNT;

  -- 90일 이상 된 해결된 알림 정리
  DELETE FROM alert_history 
  WHERE resolved_at IS NOT NULL 
  AND resolved_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_cleaned_alerts = ROW_COUNT;

  cleaned_health_logs := v_cleaned_health;
  cleaned_alert_history := v_cleaned_alerts;
  cleanup_details := jsonb_build_object(
    'cleaned_at', NOW(),
    'health_logs_cleaned', v_cleaned_health,
    'alert_history_cleaned', v_cleaned_alerts
  );
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 7. 완료 확인 및 테스트
-- ====================================================================

-- 모니터링 시스템 즉시 테스트
SELECT 
  '🎯 모니터링 시스템 구축 완료!' as status,
  '✅ 건강도 체크 함수 생성' as health_check,
  '✅ 알림 시스템 구축' as alerting,
  '✅ 대시보드 뷰 생성' as dashboard,
  '✅ 자동 정리 시스템 구현' as cleanup;

-- 즉시 건강도 체크 실행
SELECT * FROM comprehensive_system_health_check();

-- 대시보드 상태 확인
SELECT * FROM system_health_dashboard;

-- 알림 생성 테스트
SELECT * FROM generate_alerts_from_health_check();

/*
🎯 **사용 방법:**

1. **수동 건강도 체크**:
   SELECT * FROM comprehensive_system_health_check();

2. **대시보드 확인**:
   SELECT * FROM system_health_dashboard;

3. **알림 생성**:
   SELECT * FROM generate_alerts_from_health_check();

4. **정리 작업**:
   SELECT * FROM cleanup_old_monitoring_data();

🔄 **자동화 권장사항:**

1. **Supabase Edge Functions**로 정기 실행:
   - 건강도 체크: 매 30분
   - 알림 생성: 매 1시간  
   - 정리 작업: 매일 새벽 2시

2. **웹훅 연동**:
   - Slack, Discord, 이메일 알림
   - 대시보드 실시간 업데이트

3. **프론트엔드 대시보드**:
   - system_health_dashboard 뷰 활용
   - 실시간 차트 및 알림 표시
*/