-- 휴가 신청을 안전하게 처리하는 함수 (레이스 컨디션 방지)
CREATE OR REPLACE FUNCTION submit_leave_request_safe(
  p_user_id UUID,
  p_form_type TEXT,
  p_request_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_leave_data RECORD;
  v_days_to_deduct NUMERIC;
  v_hours_to_deduct NUMERIC;
  v_leave_type TEXT;
  v_available_hours NUMERIC;
  v_new_request_id UUID;
  v_is_half_day BOOLEAN;
BEGIN
  -- 휴가 신청서가 아닌 경우 바로 저장
  IF p_form_type != '휴가 신청서' THEN
    INSERT INTO form_requests (user_id, form_type, status, request_data, submitted_at)
    VALUES (p_user_id, p_form_type, 'pending', p_request_data, NOW())
    RETURNING id INTO v_new_request_id;
    
    RETURN jsonb_build_object('success', true, 'request_id', v_new_request_id);
  END IF;

  -- 휴가 형태 추출
  v_leave_type := p_request_data->>'휴가형태';
  v_is_half_day := (v_leave_type LIKE '%반차%');
  
  -- 휴가 일수 계산
  IF v_is_half_day THEN
    v_days_to_deduct := 0.5;
  ELSIF (p_request_data->>'시작일') = (p_request_data->>'종료일') THEN
    v_days_to_deduct := 1;
  ELSE
    v_days_to_deduct := DATE_PART('day', (p_request_data->>'종료일')::DATE - (p_request_data->>'시작일')::DATE) + 1;
  END IF;

  -- 사용자의 휴가 데이터를 잠금과 함께 조회
  SELECT * INTO v_leave_data
  FROM leave_days
  WHERE user_id = p_user_id
  FOR UPDATE; -- 행 수준 잠금으로 동시성 제어

  IF NOT FOUND THEN
    RAISE EXCEPTION '휴가 정보를 찾을 수 없습니다.';
  END IF;

  -- 시간 단위 휴가 처리 (대체휴가, 보상휴가)
  IF v_leave_type IN ('대체휴가', '보상휴가') THEN
    v_hours_to_deduct := v_days_to_deduct * 8;
    
    IF v_leave_type = '대체휴가' THEN
      v_available_hours := COALESCE((v_leave_data.leave_types->>'substitute_leave_hours')::NUMERIC, 0);
    ELSE
      v_available_hours := COALESCE((v_leave_data.leave_types->>'compensatory_leave_hours')::NUMERIC, 0);
    END IF;
    
    IF v_available_hours < v_hours_to_deduct THEN
      RAISE EXCEPTION '잔여 %가 부족합니다. (잔여: %시간, 필요: %시간)', 
        v_leave_type, v_available_hours, v_hours_to_deduct;
    END IF;
  
  -- 일반 휴가 처리 (연차, 병가)
  ELSE
    DECLARE
      v_total_days NUMERIC;
      v_used_days NUMERIC;
      v_remaining_days NUMERIC;
    BEGIN
      IF v_leave_type = '병가' THEN
        v_total_days := COALESCE((v_leave_data.leave_types->>'sick_days')::NUMERIC, 0);
        v_used_days := COALESCE((v_leave_data.leave_types->>'used_sick_days')::NUMERIC, 0);
      ELSE
        v_total_days := COALESCE((v_leave_data.leave_types->>'annual_days')::NUMERIC, 0);
        v_used_days := COALESCE((v_leave_data.leave_types->>'used_annual_days')::NUMERIC, 0);
      END IF;
      
      v_remaining_days := v_total_days - v_used_days;
      
      IF v_remaining_days < v_days_to_deduct THEN
        RAISE EXCEPTION '잔여 %가 부족합니다. (잔여: %일, 신청: %일)', 
          v_leave_type, v_remaining_days, v_days_to_deduct;
      END IF;
    END;
  END IF;

  -- 검증 통과 시 휴가 신청 저장
  INSERT INTO form_requests (user_id, form_type, status, request_data, submitted_at)
  VALUES (p_user_id, p_form_type, 'pending', p_request_data, NOW())
  RETURNING id INTO v_new_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_new_request_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 휴가 승인을 안전하게 처리하는 함수
CREATE OR REPLACE FUNCTION approve_leave_request_safe(
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
  v_leave_data RECORD;
  v_days_to_deduct NUMERIC;
  v_hours_to_deduct NUMERIC;
  v_leave_type TEXT;
  v_updated_leave_types JSONB;
  v_is_half_day BOOLEAN;
BEGIN
  -- 요청 정보 조회
  SELECT * INTO v_request
  FROM form_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '서식 요청을 찾을 수 없습니다.';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION '이미 처리된 요청입니다.';
  END IF;

  -- 휴가 신청서인 경우만 휴가 차감 처리
  IF v_request.form_type = '휴가 신청서' THEN
    v_leave_type := v_request.request_data->>'휴가형태';
    v_is_half_day := (v_leave_type LIKE '%반차%');
    
    -- 휴가 일수 계산
    IF v_is_half_day THEN
      v_days_to_deduct := 0.5;
    ELSIF (v_request.request_data->>'시작일') = (v_request.request_data->>'종료일') THEN
      v_days_to_deduct := 1;
    ELSE
      -- 주말 제외한 실제 근무일 계산 (간단한 버전)
      v_days_to_deduct := DATE_PART('day', 
        (v_request.request_data->>'종료일')::DATE - 
        (v_request.request_data->>'시작일')::DATE
      ) + 1;
    END IF;

    -- 휴가 데이터 잠금과 함께 조회
    SELECT * INTO v_leave_data
    FROM leave_days
    WHERE user_id = v_request.user_id
    FOR UPDATE;

    v_updated_leave_types := v_leave_data.leave_types;

    -- 시간 단위 휴가 차감
    IF v_leave_type IN ('대체휴가', '보상휴가') THEN
      v_hours_to_deduct := v_days_to_deduct * 8;
      
      IF v_leave_type = '대체휴가' THEN
        v_updated_leave_types := jsonb_set(
          v_updated_leave_types,
          '{substitute_leave_hours}',
          to_jsonb(GREATEST(0, COALESCE((v_updated_leave_types->>'substitute_leave_hours')::NUMERIC, 0) - v_hours_to_deduct))
        );
      ELSE
        v_updated_leave_types := jsonb_set(
          v_updated_leave_types,
          '{compensatory_leave_hours}',
          to_jsonb(GREATEST(0, COALESCE((v_updated_leave_types->>'compensatory_leave_hours')::NUMERIC, 0) - v_hours_to_deduct))
        );
      END IF;
    
    -- 일반 휴가 차감
    ELSE
      IF v_leave_type = '병가' THEN
        v_updated_leave_types := jsonb_set(
          v_updated_leave_types,
          '{used_sick_days}',
          to_jsonb(COALESCE((v_updated_leave_types->>'used_sick_days')::NUMERIC, 0) + v_days_to_deduct)
        );
      ELSIF v_leave_type IN ('연차', '오전 반차', '오후 반차') THEN
        v_updated_leave_types := jsonb_set(
          v_updated_leave_types,
          '{used_annual_days}',
          to_jsonb(COALESCE((v_updated_leave_types->>'used_annual_days')::NUMERIC, 0) + v_days_to_deduct)
        );
      END IF;
    END IF;

    -- 휴가 데이터 업데이트
    UPDATE leave_days
    SET leave_types = v_updated_leave_types,
        updated_at = NOW()
    WHERE user_id = v_request.user_id;
  END IF;

  -- 요청 승인 처리
  UPDATE form_requests
  SET status = 'approved',
      processed_at = NOW(),
      processed_by = p_admin_user_id,
      admin_notes = p_admin_note
  WHERE id = p_request_id;

  -- 알림 생성
  INSERT INTO notifications (user_id, message, link, is_read)
  VALUES (
    v_request.user_id,
    v_request.form_type || ' 신청이 승인되었습니다.',
    '/user',
    false
  );

  RETURN jsonb_build_object('success', true, 'message', '승인 완료');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION submit_leave_request_safe TO authenticated;
GRANT EXECUTE ON FUNCTION approve_leave_request_safe TO authenticated;