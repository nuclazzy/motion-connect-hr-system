-- 탄력근무제 수당 계산 함수들
-- 2단계: 실시간 집계 및 비교 로직

-- 1. 일별 계획 vs 실제 근무시간 비교 함수
CREATE OR REPLACE FUNCTION compare_daily_planned_vs_actual(
    p_user_id UUID,
    p_work_date DATE
) RETURNS TABLE (
    planned_hours DECIMAL(4,1),
    actual_hours DECIMAL(4,1),
    planned_overtime DECIMAL(4,1),
    unplanned_overtime DECIMAL(4,1),
    night_hours DECIMAL(4,1)
) AS $$
DECLARE
    v_planned_hours DECIMAL(4,1) := 0;
    v_actual_basic DECIMAL(4,1) := 0;
    v_actual_overtime DECIMAL(4,1) := 0;
    v_night_hours DECIMAL(4,1) := 0;
    v_planned_overtime DECIMAL(4,1) := 0;
    v_unplanned_overtime DECIMAL(4,1) := 0;
BEGIN
    -- 계획된 근무시간 조회
    SELECT COALESCE(dsh.planned_work_hours, 8.0)
    INTO v_planned_hours
    FROM daily_scheduled_hours dsh
    WHERE dsh.user_id = p_user_id 
    AND dsh.work_date = p_work_date;
    
    -- 실제 근무시간 조회
    SELECT 
        COALESCE(dws.basic_hours, 0),
        COALESCE(dws.overtime_hours, 0),
        COALESCE(dws.night_hours, 0)
    INTO v_actual_basic, v_actual_overtime, v_night_hours
    FROM daily_work_summary dws
    WHERE dws.user_id = p_user_id 
    AND dws.work_date = p_work_date;
    
    -- 계획된 초과근무 vs 계획외 초과근무 계산
    IF v_planned_hours > 8 THEN
        v_planned_overtime := v_planned_hours - 8;
    END IF;
    
    -- 실제 총 근무시간이 계획을 초과한 경우
    IF (v_actual_basic + v_actual_overtime) > v_planned_hours THEN
        v_unplanned_overtime := (v_actual_basic + v_actual_overtime) - v_planned_hours;
    END IF;
    
    RETURN QUERY SELECT 
        v_planned_hours,
        v_actual_basic + v_actual_overtime,
        v_planned_overtime,
        v_unplanned_overtime,
        v_night_hours;
END;
$$ LANGUAGE plpgsql;

-- 2. 주간 근무시간 집계 및 업데이트 함수
CREATE OR REPLACE FUNCTION update_weekly_summary(
    p_user_id UUID,
    p_work_date DATE
) RETURNS VOID AS $$
DECLARE
    v_week_start DATE;
    v_schedule_id UUID;
    v_planned_total DECIMAL(5,1) := 0;
    v_actual_total DECIMAL(5,1) := 0;
    v_work_days INTEGER := 0;
BEGIN
    -- 해당 주의 시작일 계산 (월요일)
    v_week_start := p_work_date - (EXTRACT(DOW FROM p_work_date) - 1)::INTEGER;
    
    -- 활성화된 탄력근무제 스케줄 조회
    SELECT fs.id INTO v_schedule_id
    FROM flexible_work_schedules fs
    WHERE fs.status = 'active'
    AND p_work_date BETWEEN fs.start_date AND fs.end_date
    LIMIT 1;
    
    IF v_schedule_id IS NULL THEN
        RETURN; -- 탄력근무제 기간이 아니면 종료
    END IF;
    
    -- 해당 주의 계획된 총 근무시간 계산
    SELECT 
        COALESCE(SUM(dsh.planned_work_hours), 0),
        COUNT(*)
    INTO v_planned_total, v_work_days
    FROM daily_scheduled_hours dsh
    WHERE dsh.user_id = p_user_id
    AND dsh.schedule_id = v_schedule_id
    AND dsh.work_date BETWEEN v_week_start AND v_week_start + INTERVAL '6 days';
    
    -- 해당 주의 실제 총 근무시간 계산
    SELECT COALESCE(SUM(dws.basic_hours + dws.overtime_hours), 0)
    INTO v_actual_total
    FROM daily_work_summary dws
    WHERE dws.user_id = p_user_id
    AND dws.work_date BETWEEN v_week_start AND v_week_start + INTERVAL '6 days';
    
    -- 주간 요약 업데이트 또는 삽입
    INSERT INTO weekly_schedule_summary (
        schedule_id, user_id, week_start_date, 
        week_number, year,
        planned_total_hours, planned_work_days,
        actual_total_hours, actual_work_days,
        hour_variance
    ) VALUES (
        v_schedule_id, p_user_id, v_week_start,
        EXTRACT(WEEK FROM v_week_start),
        EXTRACT(YEAR FROM v_week_start),
        v_planned_total, v_work_days,
        v_actual_total, v_work_days, -- 실제 근무일수는 동일하다고 가정
        v_actual_total - v_planned_total
    )
    ON CONFLICT (schedule_id, user_id, week_start_date)
    DO UPDATE SET
        actual_total_hours = v_actual_total,
        hour_variance = v_actual_total - v_planned_total,
        updated_at = NOW();
        
END;
$$ LANGUAGE plpgsql;

-- 3. 3개월 단위기간 정산 계산 함수
CREATE OR REPLACE FUNCTION calculate_settlement_period(
    p_user_id UUID,
    p_schedule_id UUID
) RETURNS TABLE (
    settlement_start DATE,
    settlement_end DATE,
    planned_weekly_avg DECIMAL(5,1),
    actual_weekly_avg DECIMAL(5,1),
    overtime_allowance_hours DECIMAL(6,1),
    night_allowance_hours DECIMAL(6,1)
) AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_total_weeks INTEGER;
    v_planned_total DECIMAL(7,1) := 0;
    v_actual_total DECIMAL(7,1) := 0;
    v_night_total DECIMAL(6,1) := 0;
    v_planned_avg DECIMAL(5,1) := 0;
    v_actual_avg DECIMAL(5,1) := 0;
    v_overtime_allowance DECIMAL(6,1) := 0;
BEGIN
    -- 스케줄 기간 정보 조회
    SELECT fs.start_date, fs.end_date, fs.settlement_weeks
    INTO v_start_date, v_end_date, v_total_weeks
    FROM flexible_work_schedules fs
    WHERE fs.id = p_schedule_id;
    
    -- 전체 기간의 계획된 총 근무시간
    SELECT COALESCE(SUM(wss.planned_total_hours), 0)
    INTO v_planned_total
    FROM weekly_schedule_summary wss
    WHERE wss.schedule_id = p_schedule_id
    AND wss.user_id = p_user_id;
    
    -- 전체 기간의 실제 총 근무시간
    SELECT COALESCE(SUM(wss.actual_total_hours), 0)
    INTO v_actual_total
    FROM weekly_schedule_summary wss
    WHERE wss.schedule_id = p_schedule_id
    AND wss.user_id = p_user_id;
    
    -- 전체 기간의 야간근무 시간 (항상 수당 지급 대상)
    SELECT COALESCE(SUM(dws.night_hours), 0)
    INTO v_night_total
    FROM daily_work_summary dws
    WHERE dws.user_id = p_user_id
    AND dws.work_date BETWEEN v_start_date AND v_end_date;
    
    -- 주당 평균 계산
    IF v_total_weeks > 0 THEN
        v_planned_avg := v_planned_total / v_total_weeks;
        v_actual_avg := v_actual_total / v_total_weeks;
    END IF;
    
    -- 초과근무 수당 대상 시간 계산
    -- 1) 계획외 초과근무 시간
    -- 2) 3개월 평균이 주 40시간을 초과하는 경우의 초과분
    IF v_actual_avg > 40.0 THEN
        v_overtime_allowance := (v_actual_avg - 40.0) * v_total_weeks;
    END IF;
    
    -- 계획외 초과근무도 추가 (일별로 계획을 초과한 시간들)
    SELECT COALESCE(SUM(
        CASE 
            WHEN (dws.basic_hours + dws.overtime_hours) > dsh.planned_work_hours 
            THEN (dws.basic_hours + dws.overtime_hours) - dsh.planned_work_hours
            ELSE 0
        END
    ), 0) INTO v_overtime_allowance
    FROM daily_work_summary dws
    LEFT JOIN daily_scheduled_hours dsh ON dsh.user_id = dws.user_id 
        AND dsh.work_date = dws.work_date
    WHERE dws.user_id = p_user_id
    AND dws.work_date BETWEEN v_start_date AND v_end_date;
    
    RETURN QUERY SELECT 
        v_start_date,
        v_end_date,
        v_planned_avg,
        v_actual_avg,
        v_overtime_allowance,
        v_night_total;
END;
$$ LANGUAGE plpgsql;

-- 4. 출퇴근 기록 시 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION trigger_flexible_work_update()
RETURNS TRIGGER AS $$
BEGIN
    -- 기존 일별 요약 계산 실행
    PERFORM calculate_daily_work_time();
    
    -- 주간 요약 업데이트
    PERFORM update_weekly_summary(NEW.user_id, NEW.record_date);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거에 탄력근무제 업데이트 추가
CREATE OR REPLACE TRIGGER attendance_flexible_work_trigger
    AFTER INSERT OR UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION trigger_flexible_work_update();

SELECT '탄력근무제 계산 함수 생성 완료' as status;