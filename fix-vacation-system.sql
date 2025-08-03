-- 휴가 시스템 완전 수정 스크립트
-- 이 스크립트는 기존 복잡한 구조를 단순화하고 실제 작동하는 시스템을 구축합니다.

-- Step 1: 별도 컬럼 추가 (JSON 의존성 제거)
ALTER TABLE leave_days 
ADD COLUMN IF NOT EXISTS substitute_leave_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS compensatory_leave_hours NUMERIC DEFAULT 0;

-- Step 2: 기존 JSON 데이터를 별도 컬럼으로 마이그레이션
UPDATE leave_days 
SET 
  substitute_leave_hours = COALESCE((leave_types->>'substitute_leave_hours')::NUMERIC, 0),
  compensatory_leave_hours = COALESCE((leave_types->>'compensatory_leave_hours')::NUMERIC, 0)
WHERE substitute_leave_hours IS NULL OR compensatory_leave_hours IS NULL;

-- Step 3: JSON 필드도 동기화 (호환성 유지)
UPDATE leave_days 
SET leave_types = leave_types || jsonb_build_object(
  'substitute_leave_hours', COALESCE(substitute_leave_hours, 0),
  'compensatory_leave_hours', COALESCE(compensatory_leave_hours, 0)
);

-- Step 4: 단순화된 휴가 신청 함수 (기존 복잡한 함수 대체)
CREATE OR REPLACE FUNCTION submit_leave_simple(
  p_user_id UUID,
  p_form_type TEXT,
  p_request_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_leave_type TEXT;
  v_days_to_deduct NUMERIC;
  v_hours_to_deduct NUMERIC;
  v_available_hours NUMERIC;
  v_available_days NUMERIC;
  v_new_request_id UUID;
  v_leave_data RECORD;
BEGIN
  -- 휴가 신청서가 아닌 경우 바로 저장
  IF p_form_type != '휴가 신청서' THEN
    INSERT INTO form_requests (user_id, form_type, status, request_data, submitted_at)
    VALUES (p_user_id, p_form_type, 'pending', p_request_data, NOW())
    RETURNING id INTO v_new_request_id;
    
    RETURN jsonb_build_object('success', true, 'request_id', v_new_request_id, 'message', '신청이 완료되었습니다.');
  END IF;

  -- 휴가 형태 및 일수 계산
  v_leave_type := p_request_data->>'휴가형태';
  
  -- 반차 처리
  IF v_leave_type LIKE '%반차%' THEN
    v_days_to_deduct := 0.5;
  -- 같은 날짜
  ELSIF (p_request_data->>'시작일') = (p_request_data->>'종료일') THEN
    v_days_to_deduct := 1;
  -- 기간 계산
  ELSE
    v_days_to_deduct := (p_request_data->>'종료일')::DATE - (p_request_data->>'시작일')::DATE + 1;
  END IF;

  -- 휴가 데이터 조회 (잠금 적용)
  SELECT * INTO v_leave_data
  FROM leave_days
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '휴가 정보를 찾을 수 없습니다.');
  END IF;

  -- 휴가 타입별 잔여량 확인
  IF v_leave_type = '대체휴가' THEN
    v_hours_to_deduct := v_days_to_deduct * 8;
    v_available_hours := COALESCE(v_leave_data.substitute_leave_hours, 0);
    
    IF v_available_hours < v_hours_to_deduct THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('잔여 대체휴가가 부족합니다. (잔여: %s시간, 필요: %s시간)', v_available_hours, v_hours_to_deduct)
      );
    END IF;
    
  ELSIF v_leave_type = '보상휴가' THEN
    v_hours_to_deduct := v_days_to_deduct * 8;
    v_available_hours := COALESCE(v_leave_data.compensatory_leave_hours, 0);
    
    IF v_available_hours < v_hours_to_deduct THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('잔여 보상휴가가 부족합니다. (잔여: %s시간, 필요: %s시간)', v_available_hours, v_hours_to_deduct)
      );
    END IF;
    
  ELSIF v_leave_type = '연차' OR v_leave_type LIKE '%반차%' THEN
    v_available_days := COALESCE((v_leave_data.leave_types->>'annual_days')::NUMERIC, 0) - 
                       COALESCE((v_leave_data.leave_types->>'used_annual_days')::NUMERIC, 0);
    
    IF v_available_days < v_days_to_deduct THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('잔여 연차가 부족합니다. (잔여: %s일, 필요: %s일)', v_available_days, v_days_to_deduct)
      );
    END IF;
    
  ELSIF v_leave_type = '병가' THEN
    v_available_days := COALESCE((v_leave_data.leave_types->>'sick_days')::NUMERIC, 0) - 
                       COALESCE((v_leave_data.leave_types->>'used_sick_days')::NUMERIC, 0);
    
    IF v_available_days < v_days_to_deduct THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('잔여 병가가 부족합니다. (잔여: %s일, 필요: %s일)', v_available_days, v_days_to_deduct)
      );
    END IF;
  END IF;

  -- 검증 통과 시 신청서 저장
  INSERT INTO form_requests (user_id, form_type, status, request_data, submitted_at)
  VALUES (p_user_id, p_form_type, 'pending', p_request_data, NOW())
  RETURNING id INTO v_new_request_id;

  RETURN jsonb_build_object(
    'success', true, 
    'request_id', v_new_request_id,
    'message', format('%s 신청이 완료되었습니다. (%s일)', v_leave_type, v_days_to_deduct)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Step 5: 단순화된 휴가 승인 함수
CREATE OR REPLACE FUNCTION approve_leave_simple(
  p_request_id UUID,
  p_admin_user_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_leave_type TEXT;
  v_days_to_deduct NUMERIC;
  v_hours_to_deduct NUMERIC;
  v_leave_data RECORD;
  v_updated_leave_types JSONB;
BEGIN
  -- 요청 정보 조회
  SELECT fr.*, u.name as user_name, u.email as user_email 
  INTO v_request
  FROM form_requests fr
  JOIN users u ON fr.user_id = u.id
  WHERE fr.id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '요청을 찾을 수 없습니다.');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 처리된 요청입니다.');
  END IF;

  -- 휴가 신청서가 아닌 경우 바로 승인
  IF v_request.form_type != '휴가 신청서' THEN
    UPDATE form_requests 
    SET 
      status = 'approved',
      processed_at = NOW(),
      processed_by = p_admin_user_id,
      admin_notes = p_admin_note
    WHERE id = p_request_id;
    
    RETURN jsonb_build_object('success', true, 'message', '승인이 완료되었습니다.');
  END IF;

  -- 휴가 신청서 처리
  v_leave_type := v_request.request_data->>'휴가형태';
  
  -- 일수 계산
  IF v_leave_type LIKE '%반차%' THEN
    v_days_to_deduct := 0.5;
  ELSIF (v_request.request_data->>'시작일') = (v_request.request_data->>'종료일') THEN
    v_days_to_deduct := 1;
  ELSE
    v_days_to_deduct := (v_request.request_data->>'종료일')::DATE - (v_request.request_data->>'시작일')::DATE + 1;
  END IF;

  -- 휴가 데이터 조회 및 잠금
  SELECT * INTO v_leave_data
  FROM leave_days
  WHERE user_id = v_request.user_id
  FOR UPDATE;

  -- 휴가 차감 처리
  IF v_leave_type = '대체휴가' THEN
    v_hours_to_deduct := v_days_to_deduct * 8;
    
    UPDATE leave_days 
    SET 
      substitute_leave_hours = GREATEST(0, COALESCE(substitute_leave_hours, 0) - v_hours_to_deduct),
      leave_types = jsonb_set(
        leave_types,
        '{substitute_leave_hours}',
        to_jsonb(GREATEST(0, COALESCE(substitute_leave_hours, 0) - v_hours_to_deduct))
      ),
      updated_at = NOW()
    WHERE user_id = v_request.user_id;
    
  ELSIF v_leave_type = '보상휴가' THEN
    v_hours_to_deduct := v_days_to_deduct * 8;
    
    UPDATE leave_days 
    SET 
      compensatory_leave_hours = GREATEST(0, COALESCE(compensatory_leave_hours, 0) - v_hours_to_deduct),
      leave_types = jsonb_set(
        leave_types,
        '{compensatory_leave_hours}',
        to_jsonb(GREATEST(0, COALESCE(compensatory_leave_hours, 0) - v_hours_to_deduct))
      ),
      updated_at = NOW()
    WHERE user_id = v_request.user_id;
    
  ELSIF v_leave_type = '연차' OR v_leave_type LIKE '%반차%' THEN
    v_updated_leave_types := jsonb_set(
      v_leave_data.leave_types,
      '{used_annual_days}',
      to_jsonb(COALESCE((v_leave_data.leave_types->>'used_annual_days')::NUMERIC, 0) + v_days_to_deduct)
    );
    
    UPDATE leave_days 
    SET leave_types = v_updated_leave_types, updated_at = NOW()
    WHERE user_id = v_request.user_id;
    
  ELSIF v_leave_type = '병가' THEN
    v_updated_leave_types := jsonb_set(
      v_leave_data.leave_types,
      '{used_sick_days}',
      to_jsonb(COALESCE((v_leave_data.leave_types->>'used_sick_days')::NUMERIC, 0) + v_days_to_deduct)
    );
    
    UPDATE leave_days 
    SET leave_types = v_updated_leave_types, updated_at = NOW()
    WHERE user_id = v_request.user_id;
  END IF;

  -- 요청 승인 처리
  UPDATE form_requests 
  SET 
    status = 'approved',
    processed_at = NOW(),
    processed_by = p_admin_user_id,
    admin_notes = p_admin_note
  WHERE id = p_request_id;

  -- 알림 추가
  INSERT INTO notifications (user_id, message, link, is_read)
  VALUES (
    v_request.user_id,
    format('%s 신청이 승인되었습니다.', v_request.form_type),
    '/user',
    false
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', format('%s %s일 승인이 완료되었습니다.', v_leave_type, v_days_to_deduct)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Step 6: 권한 설정
GRANT EXECUTE ON FUNCTION submit_leave_simple TO authenticated;
GRANT EXECUTE ON FUNCTION approve_leave_simple TO authenticated;

-- Step 7: 데이터 일관성 확인
SELECT 
  u.name,
  ld.substitute_leave_hours as separate_substitute,
  ld.leave_types->>'substitute_leave_hours' as json_substitute,
  ld.compensatory_leave_hours as separate_compensatory,
  ld.leave_types->>'compensatory_leave_hours' as json_compensatory
FROM leave_days ld
JOIN users u ON ld.user_id = u.id
WHERE u.role = 'user'
ORDER BY u.name;

-- 스크립트 완료 메시지
SELECT 'Vacation system fix completed! Both separate columns and JSON fields are now synchronized.' as status;