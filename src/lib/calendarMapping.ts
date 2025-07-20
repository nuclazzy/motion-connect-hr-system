// 캘린더 ID 맵핑 설정
export const CALENDAR_IDS = {
  // 휴가관리
  LEAVE_MANAGEMENT: 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com',
  
  // 전체 팀 일정 관리 (관리자)
  EVENT_PLANNING: 'motionsense.co.kr_v114c8qko1blc6966cice8hcv4@group.calendar.google.com',
  BROADCAST_SYSTEM: 'c_a3439675645443007e8ff58575fcfa4bbb7fbfadece96235962422566cf987e3@group.calendar.google.com',
  FILMING_TEAM: 'dingastory.com_i0i3lutf4rkeijhen3cqju08co@group.calendar.google.com',
  EDITING_TEAM: 'c_22693rqcgc7nrbdhl96f0g903k@group.calendar.google.com',
  
  // 관리자 주간 일정
  EXTERNAL_MEETING: 'motionsense.co.kr_vdbr1eu5ectsbsnod67gdohj00@group.calendar.google.com',
  INTERNAL_MEETING: 'dingastory.com_aatf30n7ad8e3mq7kfilhvu6rk@group.calendar.google.com',
} as const;

export const CALENDAR_NAMES = {
  [CALENDAR_IDS.LEAVE_MANAGEMENT]: '연차 및 경조사 현황',
  [CALENDAR_IDS.EVENT_PLANNING]: '이벤트 기획 본부',
  [CALENDAR_IDS.BROADCAST_SYSTEM]: '중계 및 시스템 운영',
  [CALENDAR_IDS.FILMING_TEAM]: '촬영팀',
  [CALENDAR_IDS.EDITING_TEAM]: '편집팀',
  [CALENDAR_IDS.EXTERNAL_MEETING]: '외부 미팅 및 답사',
  [CALENDAR_IDS.INTERNAL_MEETING]: '내부 회의 및 면담',
} as const;

// 부서별 캘린더 매핑
export const DEPARTMENT_CALENDAR_MAPPING = {
  '촬영팀': {
    own: [CALENDAR_IDS.FILMING_TEAM, CALENDAR_IDS.BROADCAST_SYSTEM],
    others: [CALENDAR_IDS.EVENT_PLANNING, CALENDAR_IDS.EDITING_TEAM]
  },
  '편집팀': {
    own: [CALENDAR_IDS.EDITING_TEAM],
    others: [CALENDAR_IDS.FILMING_TEAM, CALENDAR_IDS.BROADCAST_SYSTEM, CALENDAR_IDS.EVENT_PLANNING]
  },
  '행사기획팀': {
    own: [CALENDAR_IDS.EVENT_PLANNING],
    others: [CALENDAR_IDS.FILMING_TEAM, CALENDAR_IDS.EDITING_TEAM, CALENDAR_IDS.BROADCAST_SYSTEM]
  }
} as const;

// 관리자 대시보드용 전체 팀 캘린더
export const ADMIN_TEAM_CALENDARS = [
  { id: CALENDAR_IDS.EVENT_PLANNING, name: CALENDAR_NAMES[CALENDAR_IDS.EVENT_PLANNING] },
  { id: CALENDAR_IDS.BROADCAST_SYSTEM, name: CALENDAR_NAMES[CALENDAR_IDS.BROADCAST_SYSTEM] },
  { id: CALENDAR_IDS.FILMING_TEAM, name: CALENDAR_NAMES[CALENDAR_IDS.FILMING_TEAM] },
  { id: CALENDAR_IDS.EDITING_TEAM, name: CALENDAR_NAMES[CALENDAR_IDS.EDITING_TEAM] },
];

// 관리자 주간 일정용 캘린더
export const ADMIN_WEEKLY_CALENDARS = [
  { id: CALENDAR_IDS.EXTERNAL_MEETING, name: CALENDAR_NAMES[CALENDAR_IDS.EXTERNAL_MEETING], type: 'external' },
  { id: CALENDAR_IDS.INTERNAL_MEETING, name: CALENDAR_NAMES[CALENDAR_IDS.INTERNAL_MEETING], type: 'internal' },
];

// 미팅 캘린더 전용 설정 (UserWeeklySchedule용)
export const MEETING_CALENDARS = [
  CALENDAR_IDS.EXTERNAL_MEETING, // 외부 미팅 및 답사
  CALENDAR_IDS.INTERNAL_MEETING  // 내부 회의 및 면담
];

// 미팅 캘린더 가져오기 함수 (TeamSchedule의 getDepartmentCalendars와 동일한 패턴)
export const getMeetingCalendars = (): { own: string[]; others: string[] } => {
  return {
    own: [...MEETING_CALENDARS], // 미팅 캘린더는 모두 own으로 처리
    others: [] as string[]
  };
};

// 올해 날짜 범위 계산
export const getCurrentYearRange = () => {
  const currentYear = new Date().getFullYear();
  const startDate = new Date(currentYear, 0, 1); // 1월 1일
  const endDate = new Date(currentYear, 11, 31); // 12월 31일
  
  return {
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString()
  };
};

// 부서별 캘린더 가져오기
export const getDepartmentCalendars = (department: string): { own: string[]; others: string[] } => {
  const mapping = DEPARTMENT_CALENDAR_MAPPING[department as keyof typeof DEPARTMENT_CALENDAR_MAPPING];
  if (mapping) {
    return {
      own: [...mapping.own],
      others: [...mapping.others]
    };
  }
  return {
    own: [] as string[],
    others: [] as string[]
  };
};