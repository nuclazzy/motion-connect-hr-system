-- STEP 5: 월별 통계 recognized_hours 필드 활용
-- daily_work_summary의 유급휴가 시간들을 월별 통계에 반영

-- 1. monthly_work_stats 테이블에 recognized_hours 컬럼이 없다면 추가
ALTER TABLE monthly_work_stats 
ADD COLUMN IF NOT EXISTS recognized_hours DECIMAL(6,1) DEFAULT 0;

-- 2. 기존 월별 통계 업데이트 트리거 함수 수정
CREATE OR REPLACE FUNCTION update_monthly_work_stats()
RETURNS TRIGGER AS $$
DECLARE
    work_month DATE;
    stats_record RECORD;
BEGIN
    -- 월 계산 (해당 월의 첫째 날)
    work_month := DATE_TRUNC('month', NEW.work_date)::DATE;
    
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
    AND DATE_TRUNC('month', dws.work_date) = work_month;
    
    -- monthly_work_stats 테이블 업데이트
    INSERT INTO monthly_work_stats (
        user_id, work_month, 
        total_work_days, total_basic_hours, total_overtime_hours, total_night_hours,
        recognized_hours, -- 🆕 유급휴가 시간 추가
        average_daily_hours, dinner_count, 
        late_count, early_leave_count, absent_count,
        updated_at
    ) VALUES (
        NEW.user_id, work_month,
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

-- 3. 기존 트리거 재생성
DROP TRIGGER IF EXISTS trigger_update_monthly_work_stats ON daily_work_summary;
CREATE TRIGGER trigger_update_monthly_work_stats
    AFTER INSERT OR UPDATE ON daily_work_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_monthly_work_stats();

-- 4. 기존 8월 월별 통계 재계산
DELETE FROM monthly_work_stats 
WHERE work_month >= '2025-08-01';

-- 8월 데이터가 있다면 트리거를 통해 자동 재계산
UPDATE daily_work_summary 
SET updated_at = NOW() 
WHERE work_date >= '2025-08-01';

-- 5. 결과 확인
SELECT 
    u.name as 직원명,
    mws.work_month as 월,
    mws.total_work_days as 근무일수,
    mws.total_basic_hours as 기본시간,
    mws.total_overtime_hours as 연장시간,
    mws.recognized_hours as 유급휴가시간, -- 🆕 추가된 필드
    mws.total_basic_hours + mws.total_overtime_hours + mws.recognized_hours as 총근무시간
FROM monthly_work_stats mws
JOIN users u ON mws.user_id = u.id
WHERE mws.work_month >= '2025-08-01'
ORDER BY u.name, mws.work_month;

-- 완료 메시지
SELECT 'recognized_hours 필드 활용 완료' as status;