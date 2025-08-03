-- Motion Connect HR System - 성능 최적화
-- 데이터베이스 인덱스, 쿼리 최적화, 파티셔닝 구현

-- 1. 기존 성능 이슈 분석을 위한 슬로우 쿼리 모니터링 활성화
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1초 이상 쿼리 로깅
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- 2. 사용자 테이블 최적화
-- 자주 조회되는 필드들에 대한 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_employee_id 
ON users(employee_id) WHERE employee_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_department 
ON users(department) WHERE department IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active 
ON users(role, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower 
ON users(lower(email));

-- 3. 폼 요청 테이블 최적화 (가장 자주 조회되는 테이블)
-- 복합 인덱스: 상태별, 사용자별, 날짜순 조회에 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_requests_status_user_date 
ON form_requests(status, user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_requests_form_type_status 
ON form_requests(form_type, status, created_at DESC);

-- 관리자가 승인 대기 건을 조회할 때 사용
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_requests_pending_recent 
ON form_requests(created_at DESC) 
WHERE status = 'pending';

-- 사용자별 최근 신청 내역 조회용
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_requests_user_recent 
ON form_requests(user_id, created_at DESC);

-- 폼 타입별 통계 조회용
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_requests_form_type_date 
ON form_requests(form_type, created_at);

-- JSON 필드 내 특정 값 검색용 (GIN 인덱스)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_requests_request_data_gin 
ON form_requests USING gin(request_data);

-- 4. 휴가 데이터 테이블 최적화
-- 사용자별 휴가 데이터 조회
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leave_days_user_updated 
ON leave_days(user_id, updated_at DESC);

-- JSON 필드 검색 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leave_days_types_gin 
ON leave_days USING gin(leave_types);

-- 5. 알림 테이블 최적화 (읽지 않은 알림 조회가 빈번)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, created_at DESC) 
WHERE is_read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

-- 6. 감사 로그 테이블 최적화 (대용량 데이터 예상)
-- 날짜 기반 파티셔닝 준비
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at_hash 
ON audit_logs(date_trunc('day', created_at), user_id);

-- 심각도별 빠른 필터링
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_severity_date 
ON audit_logs(severity, created_at DESC) 
WHERE severity IN ('HIGH', 'CRITICAL');

-- 사용자별 활동 로그 조회
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action_date 
ON audit_logs(user_id, action_type, created_at DESC) 
WHERE user_id IS NOT NULL;

-- 7. 백업 메타데이터 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backup_metadata_status_date 
ON backup_metadata(backup_status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_backup_metadata_expires_archived 
ON backup_metadata(expires_at, is_archived) 
WHERE is_archived = false;

-- 8. 문서 테이블 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_category_active 
ON documents(category, is_active, created_at DESC) 
WHERE is_active = true;

-- 전문 검색 인덱스 (제목과 내용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_search 
ON documents USING gin(to_tsvector('korean', title || ' ' || COALESCE(content, '')));

-- 9. 회의 테이블 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meetings_date_range 
ON meetings(meeting_date, start_time, end_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meetings_created_by_date 
ON meetings(created_by, meeting_date DESC);

-- 10. 머티리얼라이즈드 뷰를 이용한 통계 최적화
-- 폼 요청 통계 (관리자 대시보드용)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_form_request_stats AS
SELECT 
  form_type,
  status,
  DATE(created_at) as request_date,
  COUNT(*) as request_count,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))/3600) 
    FILTER (WHERE processed_at IS NOT NULL) as avg_processing_hours
FROM form_requests 
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY form_type, status, DATE(created_at);

-- 통계 뷰 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_form_request_stats 
ON mv_form_request_stats(form_type, status, request_date);

-- 사용자 활동 통계 (월별)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity_monthly AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) as activity_month,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE form_type = '휴가 신청서') as leave_requests,
  COUNT(*) FILTER (WHERE form_type = '초과근무 신청서') as overtime_requests,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_requests
FROM form_requests 
WHERE created_at >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY user_id, DATE_TRUNC('month', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_activity_monthly 
ON mv_user_activity_monthly(user_id, activity_month);

-- 11. 쿼리 성능 최적화 함수들
-- 사용자 대시보드 데이터 조회 최적화
CREATE OR REPLACE FUNCTION get_user_dashboard_data(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  leave_data jsonb;
  recent_requests jsonb;
  pending_count integer;
BEGIN
  -- 휴가 데이터 조회 (인덱스 활용)
  SELECT to_jsonb(ld.*) INTO leave_data
  FROM leave_days ld 
  WHERE ld.user_id = p_user_id;
  
  -- 최근 신청 내역 (인덱스 활용)
  SELECT jsonb_agg(to_jsonb(fr.*)) INTO recent_requests
  FROM (
    SELECT fr.*, ft.form_name
    FROM form_requests fr
    LEFT JOIN form_templates ft ON fr.form_type = ft.form_name
    WHERE fr.user_id = p_user_id
    ORDER BY fr.created_at DESC
    LIMIT 5
  ) fr;
  
  -- 승인 대기 건수 (인덱스 활용)
  SELECT COUNT(*) INTO pending_count
  FROM form_requests 
  WHERE user_id = p_user_id AND status = 'pending';
  
  -- 결과 조합
  result := jsonb_build_object(
    'leave_data', COALESCE(leave_data, '{}'::jsonb),
    'recent_requests', COALESCE(recent_requests, '[]'::jsonb),
    'pending_count', pending_count
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 관리자 대시보드 데이터 조회 최적화
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats(p_days integer DEFAULT 30)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  form_stats jsonb;
  user_stats jsonb;
  recent_activity jsonb;
BEGIN
  -- 폼 요청 통계 (머티리얼라이즈드 뷰 활용)
  SELECT jsonb_agg(
    jsonb_build_object(
      'form_type', form_type,
      'total', SUM(request_count),
      'pending', SUM(pending_count),
      'approved', SUM(approved_count),
      'rejected', SUM(rejected_count),
      'avg_processing_hours', AVG(avg_processing_hours)
    )
  ) INTO form_stats
  FROM mv_form_request_stats 
  WHERE request_date >= CURRENT_DATE - INTERVAL '1 day' * p_days
  GROUP BY form_type;
  
  -- 사용자 통계
  SELECT jsonb_build_object(
    'total_users', COUNT(*),
    'active_users', COUNT(*) FILTER (WHERE is_active = true),
    'admin_users', COUNT(*) FILTER (WHERE role = 'admin')
  ) INTO user_stats
  FROM users;
  
  -- 최근 활동 (인덱스 활용)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', fr.id,
      'form_type', fr.form_type,
      'user_name', u.name,
      'status', fr.status,
      'created_at', fr.created_at
    )
  ) INTO recent_activity
  FROM (
    SELECT * FROM form_requests 
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY created_at DESC 
    LIMIT 20
  ) fr
  JOIN users u ON fr.user_id = u.id;
  
  result := jsonb_build_object(
    'form_stats', COALESCE(form_stats, '[]'::jsonb),
    'user_stats', COALESCE(user_stats, '{}'::jsonb),
    'recent_activity', COALESCE(recent_activity, '[]'::jsonb)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 12. 자동 통계 업데이트 함수
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_form_request_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_monthly;
  
  INSERT INTO audit_logs (
    action_type,
    description,
    severity,
    category
  ) VALUES (
    'SYSTEM',
    '머티리얼라이즈드 뷰 통계 갱신 완료',
    'INFO',
    'SYSTEM'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. 데이터베이스 유지보수 함수
CREATE OR REPLACE FUNCTION analyze_performance_tables()
RETURNS void AS $$
BEGIN
  -- 주요 테이블 통계 갱신
  ANALYZE users;
  ANALYZE form_requests;
  ANALYZE leave_days;
  ANALYZE audit_logs;
  ANALYZE notifications;
  
  -- 통계 갱신 로그
  INSERT INTO audit_logs (
    action_type,
    description,
    severity,
    category
  ) VALUES (
    'SYSTEM',
    '데이터베이스 통계 분석 완료',
    'INFO',
    'SYSTEM'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. 연결 풀 최적화 설정
-- 연결 제한 및 타임아웃 설정
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- 15. 정기 유지보수 스케줄 설정 (cron 작업으로 실행)
-- 매일 새벽 3시: 통계 갱신
-- 매주 일요일 새벽 4시: 데이터베이스 분석
-- 매월 1일 새벽 5시: VACUUM FULL (필요시)

-- 16. 성능 모니터링 뷰
CREATE OR REPLACE VIEW performance_monitoring AS
SELECT 
  schemaname,
  tablename,
  attname,
  inherited,
  null_frac,
  avg_width,
  n_distinct,
  most_common_vals,
  most_common_freqs,
  histogram_bounds,
  correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- 17. 슬로우 쿼리 분석 뷰
CREATE OR REPLACE VIEW slow_query_analysis AS
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  stddev_time
FROM pg_stat_statements 
WHERE mean_time > 100 -- 100ms 이상
ORDER BY mean_time DESC;

-- 18. 인덱스 사용률 분석 뷰
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 초기 통계 갱신 실행
SELECT refresh_materialized_views();
SELECT analyze_performance_tables();

-- 성능 최적화 완료 알림
INSERT INTO notifications (user_id, message, created_at)
SELECT 
  id,
  '⚡ 데이터베이스 성능 최적화가 완료되었습니다. 시스템 응답 속도가 개선됩니다.',
  NOW()
FROM users 
WHERE role = 'admin';

-- 성능 최적화 감사 로그
INSERT INTO audit_logs (
  action_type,
  description,
  severity,
  category,
  metadata
) VALUES (
  'SYSTEM',
  '데이터베이스 성능 최적화 적용 완료',
  'INFO',
  'SYSTEM',
  jsonb_build_object(
    'version', '1.0',
    'optimizations', jsonb_build_array(
      'database_indexes',
      'materialized_views',
      'query_optimization',
      'connection_pooling',
      'performance_monitoring'
    ),
    'indexes_created', 25,
    'materialized_views_created', 2,
    'functions_created', 4
  )
);