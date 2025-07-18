-- Supabase calendar_configs 테이블 설정 데이터 추가
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 기존 데이터 삭제 (필요한 경우)
DELETE FROM calendar_configs;

-- 휴가 관리 캘린더
INSERT INTO calendar_configs (
    config_type, 
    target_name, 
    calendar_id, 
    calendar_alias, 
    description, 
    color, 
    is_active
) VALUES 
(
    'function', 
    'leave-management', 
    'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com',
    '연차 및 경조사 현황',
    '직원 휴가 및 경조사 일정 관리',
    '#E74C3C',
    true
);

-- 팀 캘린더들
INSERT INTO calendar_configs (
    config_type, 
    target_name, 
    calendar_id, 
    calendar_alias, 
    description, 
    color, 
    is_active
) VALUES 
(
    'team', 
    'event-planning', 
    'motionsense.co.kr_v114c8qko1blc6966cice8hcv4@group.calendar.google.com',
    '이벤트 기획 본부',
    '행사 및 이벤트 기획 관련 일정',
    '#FF6B6B',
    true
),
(
    'team', 
    'broadcast-system', 
    'c_a3439675645443007e8ff58575fcfa4bbb7fbfadece96235962422566cf987e3@group.calendar.google.com',
    '중계 및 시스템 운영',
    '방송 중계 및 시스템 운영 관련 일정',
    '#4ECDC4',
    true
),
(
    'team', 
    'filming', 
    'dingastory.com_i0i3lutf4rkeijhen3cqju08co@group.calendar.google.com',
    '촬영팀',
    '촬영 관련 일정',
    '#45B7D1',
    true
),
(
    'team', 
    'editing', 
    'c_22693rqcgc7nrbdhl96f0g903k@group.calendar.google.com',
    '편집팀',
    '편집 관련 일정',
    '#96CEB4',
    true
);

-- 기능별 캘린더들
INSERT INTO calendar_configs (
    config_type, 
    target_name, 
    calendar_id, 
    calendar_alias, 
    description, 
    color, 
    is_active
) VALUES 
(
    'function', 
    'external-meeting', 
    'motionsense.co.kr_vdbr1eu5ectsbsnod67gdohj00@group.calendar.google.com',
    '외부 미팅 및 답사',
    '외부 미팅 및 현장 답사 일정',
    '#FFEAA7',
    true
),
(
    'function', 
    'internal-meeting', 
    'dingastory.com_aatf30n7ad8e3mq7kfilhvu6rk@group.calendar.google.com',
    '내부 회의 및 면담',
    '내부 회의 및 면담 일정',
    '#DDA0DD',
    true
);

-- 설정 확인 쿼리
SELECT * FROM calendar_configs ORDER BY config_type, target_name;