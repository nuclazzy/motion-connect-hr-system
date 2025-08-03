-- Motion Connect HR System - 성능 모니터링 함수들
-- 관리자 대시보드에서 사용할 성능 통계 함수 구현

-- 1. 슬로우 쿼리 조회 함수
CREATE OR REPLACE FUNCTION get_slow_queries(min_mean_time numeric DEFAULT 100)
RETURNS TABLE(
  query text,
  calls bigint,
  total_time numeric,
  mean_time numeric,
  max_time numeric,
  stddev_time numeric
) AS $$
BEGIN
  -- pg_stat_statements 확장이 있는 경우에만 실행
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
    RETURN QUERY
    SELECT 
      pss.query,
      pss.calls,
      pss.total_exec_time as total_time,
      pss.mean_exec_time as mean_time,
      pss.max_exec_time as max_time,
      pss.stddev_exec_time as stddev_time
    FROM pg_stat_statements pss
    WHERE pss.mean_exec_time > min_mean_time
    ORDER BY pss.mean_exec_time DESC
    LIMIT 50;
  ELSE
    -- 확장이 없는 경우 빈 결과 반환
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 테이블 통계 조회 함수
CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS TABLE(
  tablename name,
  n_tup_ins bigint,
  n_tup_upd bigint,
  n_tup_del bigint,
  n_live_tup bigint,
  n_dead_tup bigint,
  last_vacuum timestamp with time zone,
  last_autovacuum timestamp with time zone,
  last_analyze timestamp with time zone,
  last_autoanalyze timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pst.relname::name as tablename,
    pst.n_tup_ins,
    pst.n_tup_upd,
    pst.n_tup_del,
    pst.n_live_tup,
    pst.n_dead_tup,
    pst.last_vacuum,
    pst.last_autovacuum,
    pst.last_analyze,
    pst.last_autoanalyze
  FROM pg_stat_user_tables pst
  WHERE pst.schemaname = 'public'
  ORDER BY pst.n_live_tup DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 인덱스 효율성 분석 함수
CREATE OR REPLACE FUNCTION analyze_index_efficiency()
RETURNS TABLE(
  schemaname name,
  tablename name,
  indexname name,
  idx_scan bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint,
  efficiency_ratio numeric,
  usage_recommendation text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psui.schemaname::name,
    psui.relname::name as tablename,
    psui.indexrelname::name as indexname,
    psui.idx_scan,
    psui.idx_tup_read,
    psui.idx_tup_fetch,
    CASE 
      WHEN psui.idx_scan = 0 THEN 0
      ELSE round((psui.idx_tup_read::numeric / psui.idx_scan::numeric), 2)
    END as efficiency_ratio,
    CASE 
      WHEN psui.idx_scan = 0 THEN '사용되지 않는 인덱스 - 삭제 고려'
      WHEN psui.idx_scan > 0 AND (psui.idx_tup_read::numeric / psui.idx_scan::numeric) > 10 THEN '비효율적 인덱스 - 재구성 필요'
      WHEN psui.idx_scan > 1000 AND (psui.idx_tup_read::numeric / psui.idx_scan::numeric) < 2 THEN '효율적 인덱스'
      ELSE '보통'
    END as usage_recommendation
  FROM pg_stat_user_indexes psui
  WHERE psui.schemaname = 'public'
  ORDER BY psui.idx_scan DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 데이터베이스 전체 통계 함수
CREATE OR REPLACE FUNCTION get_database_overview()
RETURNS TABLE(
  metric_name text,
  metric_value text,
  metric_type text,
  status text
) AS $$
DECLARE
  db_size bigint;
  table_count int;
  index_count int;
  active_connections int;
  total_connections int;
  cache_hit_ratio numeric;
  checkpoint_segments int;
BEGIN
  -- 데이터베이스 크기
  SELECT pg_database_size(current_database()) INTO db_size;
  
  -- 테이블 수
  SELECT count(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  
  -- 인덱스 수
  SELECT count(*) INTO index_count 
  FROM pg_indexes 
  WHERE schemaname = 'public';
  
  -- 활성 연결 수
  SELECT count(*) INTO active_connections 
  FROM pg_stat_activity 
  WHERE state = 'active';
  
  -- 최대 연결 수
  SELECT setting::int INTO total_connections 
  FROM pg_settings 
  WHERE name = 'max_connections';
  
  -- 캐시 적중률
  SELECT round(
    (sum(heap_blks_hit)::numeric / 
     (sum(heap_blks_hit) + sum(heap_blks_read) + 1)::numeric) * 100, 2
  ) INTO cache_hit_ratio
  FROM pg_statio_user_tables;

  -- 결과 반환
  RETURN QUERY VALUES
    ('데이터베이스 크기', pg_size_pretty(db_size), 'storage', 'info'),
    ('테이블 수', table_count::text, 'count', 'info'),
    ('인덱스 수', index_count::text, 'count', 'info'),
    ('활성 연결', active_connections::text || '/' || total_connections::text, 'connection', 
     CASE WHEN active_connections::numeric/total_connections::numeric > 0.8 THEN 'warning' ELSE 'good' END),
    ('캐시 적중률', cache_hit_ratio::text || '%', 'performance', 
     CASE WHEN cache_hit_ratio < 90 THEN 'warning' WHEN cache_hit_ratio < 95 THEN 'caution' ELSE 'good' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 실시간 활동 모니터링 함수
CREATE OR REPLACE FUNCTION get_current_activity()
RETURNS TABLE(
  pid int,
  usename name,
  application_name text,
  client_addr inet,
  state text,
  query_start timestamp with time zone,
  state_change timestamp with time zone,
  query text,
  duration interval
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psa.pid,
    psa.usename,
    psa.application_name,
    psa.client_addr,
    psa.state,
    psa.query_start,
    psa.state_change,
    CASE 
      WHEN length(psa.query) > 100 THEN left(psa.query, 97) || '...'
      ELSE psa.query
    END as query,
    CASE 
      WHEN psa.state = 'active' THEN now() - psa.query_start
      ELSE psa.state_change - psa.query_start
    END as duration
  FROM pg_stat_activity psa
  WHERE psa.datname = current_database()
    AND psa.pid != pg_backend_pid()
    AND psa.usename IS NOT NULL
  ORDER BY psa.query_start DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 테이블 크기 및 성장률 분석 함수
CREATE OR REPLACE FUNCTION analyze_table_growth()
RETURNS TABLE(
  tablename name,
  table_size text,
  index_size text,
  total_size text,
  row_count bigint,
  avg_row_size numeric,
  bloat_estimate text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::name as tablename,
    pg_size_pretty(pg_total_relation_size(c.oid) - pg_indexes_size(c.oid)) as table_size,
    pg_size_pretty(pg_indexes_size(c.oid)) as index_size,
    pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
    s.n_live_tup as row_count,
    CASE 
      WHEN s.n_live_tup > 0 THEN 
        round((pg_total_relation_size(c.oid) - pg_indexes_size(c.oid))::numeric / s.n_live_tup::numeric, 2)
      ELSE 0
    END as avg_row_size,
    CASE 
      WHEN s.n_dead_tup > s.n_live_tup * 0.1 THEN 'VACUUM 필요'
      WHEN s.n_dead_tup > s.n_live_tup * 0.05 THEN 'VACUUM 권장'
      ELSE '양호'
    END as bloat_estimate
  FROM information_schema.tables t
  JOIN pg_class c ON c.relname = t.table_name
  LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
  WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND c.relkind = 'r'
  ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 성능 알림 체크 함수
CREATE OR REPLACE FUNCTION check_performance_alerts()
RETURNS TABLE(
  alert_type text,
  alert_message text,
  severity text,
  recommendation text
) AS $$
DECLARE
  cache_hit_ratio numeric;
  long_running_queries int;
  blocking_queries int;
  dead_tuple_ratio numeric;
BEGIN
  -- 캐시 적중률 체크
  SELECT round(
    (sum(heap_blks_hit)::numeric / 
     (sum(heap_blks_hit) + sum(heap_blks_read) + 1)::numeric) * 100, 2
  ) INTO cache_hit_ratio
  FROM pg_statio_user_tables;
  
  IF cache_hit_ratio < 90 THEN
    RETURN QUERY VALUES
      ('CACHE_HIT_RATIO', 
       '캐시 적중률이 낮습니다: ' || cache_hit_ratio::text || '%',
       'WARNING',
       'shared_buffers 설정을 늘리거나 쿼리를 최적화하세요.');
  END IF;
  
  -- 장시간 실행 쿼리 체크
  SELECT count(*) INTO long_running_queries
  FROM pg_stat_activity 
  WHERE state = 'active' 
    AND query_start < now() - interval '5 minutes'
    AND query NOT LIKE '%pg_stat_activity%';
    
  IF long_running_queries > 0 THEN
    RETURN QUERY VALUES
      ('LONG_RUNNING_QUERIES',
       '5분 이상 실행 중인 쿼리가 ' || long_running_queries::text || '개 있습니다.',
       'WARNING',
       '장시간 실행 쿼리를 확인하고 최적화하세요.');
  END IF;
  
  -- 블로킹 쿼리 체크
  SELECT count(*) INTO blocking_queries
  FROM pg_stat_activity 
  WHERE waiting = true;
    
  IF blocking_queries > 0 THEN
    RETURN QUERY VALUES
      ('BLOCKING_QUERIES',
       '대기 중인 쿼리가 ' || blocking_queries::text || '개 있습니다.',
       'CRITICAL',
       '락 충돌을 확인하고 해결하세요.');
  END IF;
  
  -- 죽은 튜플 비율 체크
  SELECT max(
    CASE 
      WHEN n_live_tup > 0 THEN n_dead_tup::numeric / n_live_tup::numeric
      ELSE 0
    END
  ) INTO dead_tuple_ratio
  FROM pg_stat_user_tables;
  
  IF dead_tuple_ratio > 0.2 THEN
    RETURN QUERY VALUES
      ('HIGH_DEAD_TUPLES',
       '죽은 튜플 비율이 높습니다: ' || round(dead_tuple_ratio * 100, 1)::text || '%',
       'WARNING',
       'VACUUM 또는 REINDEX 작업을 실행하세요.');
  END IF;
  
  -- 문제가 없는 경우
  IF NOT FOUND THEN
    RETURN QUERY VALUES
      ('SYSTEM_HEALTH',
       '시스템이 정상적으로 작동 중입니다.',
       'INFO',
       '현재 성능 상태를 유지하세요.');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. SQL 실행 함수 (제한적, 안전한 조회만)
CREATE OR REPLACE FUNCTION execute_sql(sql_query text)
RETURNS TABLE(result jsonb) AS $$
DECLARE
  safe_prefixes text[] := ARRAY['SELECT', 'WITH', 'EXPLAIN'];
  query_prefix text;
BEGIN
  -- SQL 쿼리 안전성 검증
  query_prefix := upper(trim(split_part(sql_query, ' ', 1)));
  
  IF NOT (query_prefix = ANY(safe_prefixes)) THEN
    RAISE EXCEPTION '안전하지 않은 SQL 쿼리입니다: %', query_prefix;
  END IF;
  
  -- 동적 쿼리 실행은 보안상 제한
  -- 대신 미리 정의된 통계 함수들을 사용하도록 안내
  RAISE EXCEPTION '동적 SQL 실행은 보안상 제한됩니다. 미리 정의된 통계 함수를 사용하세요.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 성능 모니터링 종합 뷰 업데이트
DROP VIEW IF EXISTS performance_monitoring;
CREATE OR REPLACE VIEW performance_monitoring AS
SELECT 
  'table_stats' as category,
  t.tablename as object_name,
  jsonb_build_object(
    'live_tuples', t.n_live_tup,
    'dead_tuples', t.n_dead_tup,
    'insertions', t.n_tup_ins,
    'updates', t.n_tup_upd,
    'deletions', t.n_tup_del,
    'last_vacuum', t.last_vacuum,
    'last_analyze', t.last_analyze
  ) as metrics
FROM pg_stat_user_tables t
WHERE t.schemaname = 'public'

UNION ALL

SELECT 
  'index_stats' as category,
  i.indexrelname as object_name,
  jsonb_build_object(
    'scans', i.idx_scan,
    'tuples_read', i.idx_tup_read,
    'tuples_fetched', i.idx_tup_fetch,
    'efficiency', 
    CASE 
      WHEN i.idx_scan = 0 THEN 0
      ELSE round(i.idx_tup_read::numeric / i.idx_scan::numeric, 2)
    END
  ) as metrics
FROM pg_stat_user_indexes i
WHERE i.schemaname = 'public'

ORDER BY category, object_name;

-- 함수들에 대한 보안 정책
GRANT EXECUTE ON FUNCTION get_slow_queries(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_index_efficiency() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_table_growth() TO authenticated;
GRANT EXECUTE ON FUNCTION check_performance_alerts() TO authenticated;