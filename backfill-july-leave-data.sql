-- 7월 연차 데이터 소급 적용 스크립트
-- 승인된 연차에 대해 8시간 근무시간 자동 인정 (2025년 7월)

-- 1. 7월 승인된 연차 신청 조회 및 처리
DO $$
DECLARE
    request_record RECORD;
    leave_date DATE;
    work_hours DECIMAL(4,1);
    work_status VARCHAR(50);
    processed_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🚀 7월 연차 데이터 소급 적용 시작 (2025-07-01 ~ 2025-07-31)';
    
    -- 7월 승인된 연차 신청서 조회
    FOR request_record IN
        SELECT 
            id,
            user_id,
            form_data,
            start_date,
            end_date,
            processed_at
        FROM form_requests 
        WHERE status = 'approved'
        AND form_data->>'type' IN ('연차', '오전 반차', '오후 반차')
        AND start_date >= '2025-07-01'
        AND end_date <= '2025-07-31'
        ORDER BY start_date
    LOOP
        BEGIN
            RAISE NOTICE '📋 처리 중: 사용자 %, 기간 % ~ %, 유형 %', 
                request_record.user_id, 
                request_record.start_date, 
                request_record.end_date,
                request_record.form_data->>'type';
            
            -- 휴가 유형에 따른 근무시간 및 상태 설정
            IF request_record.form_data->>'type' LIKE '%반차%' THEN
                work_hours := 4.0;
                work_status := '반차(유급)';
            ELSE
                work_hours := 8.0;
                work_status := '연차(유급)';
            END IF;
            
            -- 휴가 기간 내 모든 날짜 처리
            leave_date := request_record.start_date;
            WHILE leave_date <= request_record.end_date LOOP
                -- daily_work_summary에 유급휴가 기록 생성/업데이트
                INSERT INTO daily_work_summary (
                    user_id,
                    work_date,
                    basic_hours,
                    overtime_hours,
                    night_hours,
                    work_status,
                    auto_calculated,
                    calculated_at,
                    updated_at
                ) VALUES (
                    request_record.user_id,
                    leave_date,
                    work_hours,
                    0,
                    0,
                    work_status,
                    true,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (user_id, work_date)
                DO UPDATE SET
                    basic_hours = EXCLUDED.basic_hours,
                    work_status = EXCLUDED.work_status,
                    auto_calculated = true,
                    calculated_at = NOW(),
                    updated_at = NOW()
                WHERE daily_work_summary.work_status IS NULL 
                   OR daily_work_summary.work_status NOT LIKE '%유급%';
                
                RAISE NOTICE '✅ % - %시간 인정 완료', leave_date, work_hours;
                processed_count := processed_count + 1;
                
                leave_date := leave_date + INTERVAL '1 day';
            END LOOP;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ 오류 발생: 사용자 %, 날짜 % - %', 
                request_record.user_id, leave_date, SQLERRM;
            error_count := error_count + 1;
        END;
    END LOOP;
    
    RAISE NOTICE '🎉 7월 연차 데이터 소급 적용 완료!';
    RAISE NOTICE '📊 처리된 날짜: %건, 오류: %건', processed_count, error_count;
    
END $$;