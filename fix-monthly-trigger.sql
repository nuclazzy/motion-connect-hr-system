-- monthly_work_stats 업데이트 트리거 함수 수정
-- work_month 필드 충돌 해결

CREATE OR REPLACE FUNCTION update_monthly_work_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_work_month DATE;
    stats_record RECORD;
BEGIN
    -- 월 계산 (해당 월의 첫째 날)
    target_work_month := DATE_TRUNC('month', NEW.work_date)::DATE;
    
    -- 해당 사용자의 해당 월 통계 계산
    SELECT 
        COUNT(*) FILTER (WHERE dws.basic_hours > 0 OR dws.overtime_hours > 0) as work_days,
        COALESCE(SUM(dws.basic_hours), 0) as total_basic,
        COALESCE(SUM(dws.overtime_hours), 0) as total_overtime,
        COALESCE(SUM(dws.night_hours), 0) as total_night,
        -- 🆕 유급휴가 시간 계산 (연차, 반차, 시간차)
        COALESCE(SUM(
            CASE 
                WHEN dws.work_status LIKE '%유급%' THEN dws.basic_hours 
                ELSE 0 
            END
        ), 0) as total_recognized,
        COALESCE(AVG(
            CASE 
                WHEN dws.basic_hours > 0 OR dws.overtime_hours > 0 
                THEN dws.basic_hours + dws.overtime_hours 
                ELSE NULL 
            END
        ), 0) as avg_daily,
        COUNT(*) FILTER (WHERE dws.had_dinner = true) as dinner_count,
        COUNT(*) FILTER (WHERE 
            dws.check_in_time IS NOT NULL AND 
            EXTRACT(HOUR FROM dws.check_in_time) > 9
        ) as late_count,
        COUNT(*) FILTER (WHERE 
            dws.check_out_time IS NOT NULL AND 
            EXTRACT(HOUR FROM dws.check_out_time) < 18
        ) as early_leave_count,
        COUNT(*) FILTER (WHERE dws.work_status = '결근') as absent_count
    INTO stats_record
    FROM daily_work_summary dws
    WHERE dws.user_id = NEW.user_id 
    AND DATE_TRUNC('month', dws.work_date) = target_work_month;
    
    -- monthly_work_stats 테이블 업데이트
    INSERT INTO monthly_work_stats (
        user_id, work_month, 
        total_work_days, total_basic_hours, total_overtime_hours, total_night_hours,
        recognized_hours, -- 🆕 유급휴가 시간 추가
        average_daily_hours, dinner_count, 
        late_count, early_leave_count, absent_count,
        updated_at
    ) VALUES (
        NEW.user_id, target_work_month,
        stats_record.work_days, stats_record.total_basic, stats_record.total_overtime, stats_record.total_night,
        stats_record.total_recognized, -- 🆕 유급휴가 시간
        ROUND(stats_record.avg_daily::NUMERIC, 1), stats_record.dinner_count,
        stats_record.late_count, stats_record.early_leave_count, stats_record.absent_count,
        NOW()
    )
    ON CONFLICT (user_id, work_month)
    DO UPDATE SET
        total_work_days = EXCLUDED.total_work_days,
        total_basic_hours = EXCLUDED.total_basic_hours,
        total_overtime_hours = EXCLUDED.total_overtime_hours,
        total_night_hours = EXCLUDED.total_night_hours,
        recognized_hours = EXCLUDED.recognized_hours, -- 🆕 유급휴가 시간 업데이트
        average_daily_hours = EXCLUDED.average_daily_hours,
        dinner_count = EXCLUDED.dinner_count,
        late_count = EXCLUDED.late_count,
        early_leave_count = EXCLUDED.early_leave_count,
        absent_count = EXCLUDED.absent_count,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성
DROP TRIGGER IF EXISTS trigger_update_monthly_work_stats ON daily_work_summary;
CREATE TRIGGER trigger_update_monthly_work_stats
    AFTER INSERT OR UPDATE ON daily_work_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_monthly_work_stats();

SELECT 'monthly_work_stats 트리거 수정 완료' as status;