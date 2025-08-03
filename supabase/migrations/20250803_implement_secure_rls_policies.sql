-- Motion Connect HR System - 보안 RLS 정책 구현
-- 관리자는 모든 데이터 접근, 직원은 본인 데이터만 접근

-- 1. 기존 개발용 정책 제거
DROP POLICY IF EXISTS "Allow all access for development" ON users;
DROP POLICY IF EXISTS "Allow all access for development" ON leave_days;
DROP POLICY IF EXISTS "Allow all access for development" ON form_requests;
DROP POLICY IF EXISTS "Allow all access for development" ON documents;
DROP POLICY IF EXISTS "Allow all access for development" ON meetings;
DROP POLICY IF EXISTS "Allow all access for development" ON calendar_configs;
DROP POLICY IF EXISTS "Allow all access for development" ON leave_promotions;
DROP POLICY IF EXISTS "Allow all access for development" ON notifications;

-- 2. users 테이블 보안 정책
-- 관리자: 모든 사용자 데이터 접근 가능
-- 일반 직원: 본인 데이터만 접근 가능
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage all users" ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. leave_days 테이블 보안 정책
CREATE POLICY "Admins can view all leave data" ON leave_days
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

CREATE POLICY "Users can view own leave data" ON leave_days
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage leave data" ON leave_days
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

-- 4. form_requests 테이블 보안 정책
CREATE POLICY "Admins can view all form requests" ON form_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

CREATE POLICY "Users can view own form requests" ON form_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create form requests" ON form_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can approve/reject requests" ON form_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

-- 5. notifications 테이블 보안 정책
CREATE POLICY "Users can manage own notifications" ON notifications
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications for users" ON notifications
  FOR INSERT
  WITH CHECK (true); -- 시스템이 알림 생성 가능

-- 6. documents 테이블 보안 정책 (모든 사용자 읽기 가능, 관리자만 관리)
CREATE POLICY "All users can view documents" ON documents
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage documents" ON documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

-- 7. meetings 테이블 보안 정책
CREATE POLICY "Users can view meetings" ON meetings
  FOR SELECT
  USING (true); -- 모든 사용자가 회의 일정 조회 가능

CREATE POLICY "Users can create meetings" ON meetings
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own meetings" ON meetings
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own meetings" ON meetings
  FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all meetings" ON meetings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

-- 8. calendar_configs 테이블 보안 정책
CREATE POLICY "All users can view calendar configs" ON calendar_configs
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage calendar configs" ON calendar_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

-- 9. leave_promotions 테이블 보안 정책
CREATE POLICY "Users can view own leave promotions" ON leave_promotions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.employee_id = leave_promotions.employee_id
    )
  );

CREATE POLICY "Users can update own leave promotion responses" ON leave_promotions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.employee_id = leave_promotions.employee_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.employee_id = leave_promotions.employee_id
    )
  );

CREATE POLICY "Admins can manage all leave promotions" ON leave_promotions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

-- 10. form_templates 테이블 보안 정책 (읽기는 모든 사용자, 관리는 관리자만)
CREATE POLICY "All users can view active form templates" ON form_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Only admins can manage form templates" ON form_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  );

-- 보안 정책 적용 완료 로그
INSERT INTO notifications (user_id, message, created_at)
SELECT 
  id,
  '보안 정책이 업데이트되었습니다. 이제 데이터 접근이 역할에 따라 제한됩니다.',
  NOW()
FROM users 
WHERE role = 'admin';

-- 정책 적용 확인 쿼리
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;