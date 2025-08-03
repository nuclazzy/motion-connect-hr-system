-- Motion Connect HR System - 감사 로그 시스템 구현
-- 모든 중요한 시스템 작업을 추적하여 보안 및 컴플라이언스 요구사항 충족

-- 1. audit_logs 테이블 생성
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 기본 정보
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action_type varchar(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT'
  table_name varchar(50), -- 영향받은 테이블명
  record_id uuid, -- 영향받은 레코드 ID
  
  -- 상세 정보
  old_values jsonb, -- 변경 전 데이터
  new_values jsonb, -- 변경 후 데이터
  changes jsonb, -- 변경사항 요약 (old_values와 new_values의 diff)
  
  -- 컨텍스트 정보
  ip_address inet,
  user_agent text,
  request_path text,
  session_id text,
  
  -- 메타데이터
  description text, -- 사람이 읽을 수 있는 설명
  severity varchar(20) DEFAULT 'INFO', -- 'LOW', 'INFO', 'WARN', 'HIGH', 'CRITICAL'
  category varchar(30), -- 'AUTHENTICATION', 'DATA_CHANGE', 'PERMISSION', 'SYSTEM'
  
  -- 시간 정보
  created_at timestamp with time zone DEFAULT now(),
  
  -- 추가 데이터
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);

-- 복합 인덱스 (자주 함께 조회되는 필드들)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_date ON audit_logs(user_id, action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);

-- 3. 감사 로그 자동 생성 함수들
CREATE OR REPLACE FUNCTION log_user_action(
  p_user_id uuid,
  p_action_type text,
  p_table_name text DEFAULT NULL,
  p_record_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_severity text DEFAULT 'INFO',
  p_category text DEFAULT 'DATA_CHANGE',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  log_id uuid;
  changes_data jsonb;
BEGIN
  -- 변경사항 계산 (old_values와 new_values가 모두 있는 경우)
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT jsonb_object_agg(
      key,
      jsonb_build_object(
        'old', p_old_values->key,
        'new', p_new_values->key
      )
    ) INTO changes_data
    FROM jsonb_each(p_new_values)
    WHERE p_old_values->key IS DISTINCT FROM p_new_values->key;
  END IF;

  INSERT INTO audit_logs (
    user_id,
    action_type,
    table_name,
    record_id,
    old_values,
    new_values,
    changes,
    description,
    severity,
    category,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    p_action_type,
    p_table_name,
    p_record_id,
    p_old_values,
    p_new_values,
    changes_data,
    p_description,
    p_severity,
    p_category,
    p_metadata,
    now()
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 트리거 함수들 (자동 감사 로그 생성)

-- 사용자 관련 변경사항 로깅
CREATE OR REPLACE FUNCTION audit_users_changes() RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- 현재 사용자 ID 가져오기
  current_user_id := auth.uid();
  
  IF TG_OP = 'DELETE' THEN
    PERFORM log_user_action(
      current_user_id,
      'DELETE',
      'users',
      OLD.id,
      to_jsonb(OLD),
      NULL,
      format('사용자 삭제: %s (%s)', OLD.name, OLD.email),
      'HIGH',
      'DATA_CHANGE'
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_user_action(
      current_user_id,
      'UPDATE',
      'users',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      format('사용자 정보 수정: %s', NEW.name),
      'INFO',
      'DATA_CHANGE'
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM log_user_action(
      current_user_id,
      'CREATE',
      'users',
      NEW.id,
      NULL,
      to_jsonb(NEW),
      format('새 사용자 생성: %s (%s)', NEW.name, NEW.email),
      'INFO',
      'DATA_CHANGE'
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 폼 요청 관련 변경사항 로깅 (특히 승인/거절)
CREATE OR REPLACE FUNCTION audit_form_requests_changes() RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
  action_description text;
  log_severity text;
BEGIN
  current_user_id := auth.uid();
  
  IF TG_OP = 'DELETE' THEN
    PERFORM log_user_action(
      current_user_id,
      'DELETE',
      'form_requests',
      OLD.id,
      to_jsonb(OLD),
      NULL,
      format('폼 요청 삭제: %s (사용자: %s)', OLD.form_type, OLD.user_id),
      'WARN',
      'DATA_CHANGE'
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- 상태 변경 감지 (승인/거절)
    IF OLD.status != NEW.status THEN
      IF NEW.status = 'approved' THEN
        action_description := format('폼 요청 승인: %s', NEW.form_type);
        log_severity := 'INFO';
      ELSIF NEW.status = 'rejected' THEN
        action_description := format('폼 요청 거절: %s', NEW.form_type);
        log_severity := 'WARN';
      ELSE
        action_description := format('폼 요청 상태 변경: %s → %s', OLD.status, NEW.status);
        log_severity := 'INFO';
      END IF;
      
      PERFORM log_user_action(
        current_user_id,
        'UPDATE',
        'form_requests',
        NEW.id,
        to_jsonb(OLD),
        to_jsonb(NEW),
        action_description,
        log_severity,
        'PERMISSION',
        jsonb_build_object(
          'request_type', NEW.form_type,
          'affected_user', NEW.user_id,
          'admin_note', NEW.admin_note
        )
      );
    ELSE
      -- 일반 업데이트
      PERFORM log_user_action(
        current_user_id,
        'UPDATE',
        'form_requests',
        NEW.id,
        to_jsonb(OLD),
        to_jsonb(NEW),
        format('폼 요청 수정: %s', NEW.form_type),
        'INFO',
        'DATA_CHANGE'
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM log_user_action(
      current_user_id,
      'CREATE',
      'form_requests',
      NEW.id,
      NULL,
      to_jsonb(NEW),
      format('새 폼 요청 생성: %s', NEW.form_type),
      'INFO',
      'DATA_CHANGE'
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 휴가 데이터 변경사항 로깅
CREATE OR REPLACE FUNCTION audit_leave_days_changes() RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF TG_OP = 'DELETE' THEN
    PERFORM log_user_action(
      current_user_id,
      'DELETE',
      'leave_days',
      OLD.user_id,
      to_jsonb(OLD),
      NULL,
      format('휴가 데이터 삭제 (사용자: %s)', OLD.user_id),
      'HIGH',
      'DATA_CHANGE'
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_user_action(
      current_user_id,
      'UPDATE',
      'leave_days',
      NEW.user_id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      format('휴가 데이터 수정 (사용자: %s)', NEW.user_id),
      'INFO',
      'DATA_CHANGE',
      jsonb_build_object(
        'affected_user', NEW.user_id,
        'leave_changes', 'true'
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM log_user_action(
      current_user_id,
      'CREATE',
      'leave_days',
      NEW.user_id,
      NULL,
      to_jsonb(NEW),
      format('새 휴가 데이터 생성 (사용자: %s)', NEW.user_id),
      'INFO',
      'DATA_CHANGE'
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 트리거 생성
DROP TRIGGER IF EXISTS audit_users_trigger ON users;
CREATE TRIGGER audit_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_users_changes();

DROP TRIGGER IF EXISTS audit_form_requests_trigger ON form_requests;
CREATE TRIGGER audit_form_requests_trigger
  AFTER INSERT OR UPDATE OR DELETE ON form_requests
  FOR EACH ROW EXECUTE FUNCTION audit_form_requests_changes();

DROP TRIGGER IF EXISTS audit_leave_days_trigger ON leave_days;
CREATE TRIGGER audit_leave_days_trigger
  AFTER INSERT OR UPDATE OR DELETE ON leave_days
  FOR EACH ROW EXECUTE FUNCTION audit_leave_days_changes();

-- 6. 감사 로그 조회 뷰 (관리자용)
CREATE OR REPLACE VIEW admin_audit_summary AS
SELECT 
  al.id,
  al.created_at,
  u.name as user_name,
  u.email as user_email,
  al.action_type,
  al.table_name,
  al.description,
  al.severity,
  al.category,
  CASE 
    WHEN al.table_name = 'form_requests' AND al.action_type = 'UPDATE' THEN
      (al.metadata->>'request_type')
    ELSE al.table_name
  END as affected_resource,
  al.ip_address,
  al.changes
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC;

-- 7. 데이터 보존 정책 (90일 후 자동 아카이브)
CREATE OR REPLACE FUNCTION archive_old_audit_logs() RETURNS void AS $$
BEGIN
  -- 90일 이전 로그를 별도 아카이브 테이블로 이동 (필요시 구현)
  -- 현재는 단순 삭제로 구현
  DELETE FROM audit_logs 
  WHERE created_at < (now() - interval '90 days')
    AND severity NOT IN ('HIGH', 'CRITICAL');
  
  -- 중요한 로그는 1년 보관
  DELETE FROM audit_logs 
  WHERE created_at < (now() - interval '1 year')
    AND severity IN ('HIGH', 'CRITICAL');
    
  RAISE NOTICE '오래된 감사 로그 정리 완료';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RLS 정책 (관리자만 감사 로그 조회 가능)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

-- 시스템 사용자는 로그 생성 가능 (트리거에서 사용)
CREATE POLICY "System can create audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- 9. 초기 시스템 로그 생성
INSERT INTO audit_logs (
  user_id,
  action_type,
  description,
  severity,
  category,
  metadata
) VALUES (
  NULL,
  'SYSTEM',
  '감사 로그 시스템 초기화 완료',
  'INFO',
  'SYSTEM',
  jsonb_build_object(
    'version', '1.0',
    'features', jsonb_build_array(
      'automatic_logging',
      'change_tracking',
      'admin_actions',
      'data_retention'
    )
  )
);

-- 관리자들에게 감사 로그 시스템 활성화 알림
INSERT INTO notifications (user_id, message, created_at)
SELECT 
  id,
  '🔒 감사 로그 시스템이 활성화되었습니다. 모든 중요한 시스템 작업이 기록됩니다.',
  NOW()
FROM users 
WHERE role = 'admin';