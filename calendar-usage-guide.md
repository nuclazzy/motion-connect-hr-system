# 캘린더 시스템 사용 가이드

## 1. 캘린더 등록 후 사용법

### A. 캘린더 목록 조회
```javascript
// API 호출
const response = await fetch('/api/calendar/list')
const data = await response.json()

// 결과: 공유된 모든 캘린더 목록
console.log(data.calendars)
```

### B. 이벤트 조회
```javascript
// 특정 캘린더의 이벤트 조회
const response = await fetch('/api/calendar/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    calendarId: 'calendar-id-here',
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  })
})
```

### C. 이벤트 생성
```javascript
// 새 이벤트 생성
const response = await fetch('/api/calendar/create-event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    calendarId: 'calendar-id-here',
    eventData: {
      summary: '회의 제목',
      description: '회의 설명',
      start: {
        dateTime: '2024-01-15T10:00:00+09:00',
        timeZone: 'Asia/Seoul'
      },
      end: {
        dateTime: '2024-01-15T11:00:00+09:00',
        timeZone: 'Asia/Seoul'
      },
      location: '회의실 A'
    }
  })
})
```

## 2. 시스템에서 캘린더 활용 방안

### A. 팀별 캘린더 관리
```
- 개발팀 캘린더: dev-team@company.com
- 마케팅팀 캘린더: marketing-team@company.com  
- 경영진 캘린더: executive@company.com
```

### B. 기능별 캘린더 관리
```
- 회의실 예약: meeting-rooms@company.com
- 교육/세미나: training@company.com
- 회사 행사: company-events@company.com
```

### C. 프로젝트별 캘린더
```
- 프로젝트 A: project-a@company.com
- 프로젝트 B: project-b@company.com
```

## 3. 실제 사용 시나리오

### 시나리오 1: 회의 일정 자동 생성
```javascript
// 사용자가 회의를 잡으면 자동으로 해당 팀 캘린더에 추가
async function createMeeting(teamId, meetingData) {
  const teamCalendar = getTeamCalendar(teamId)
  
  const response = await fetch('/api/calendar/create-event', {
    method: 'POST',
    body: JSON.stringify({
      calendarId: teamCalendar.id,
      eventData: meetingData
    })
  })
  
  return response.json()
}
```

### 시나리오 2: 팀 일정 대시보드
```javascript
// 여러 팀의 이번 주 일정을 한번에 조회
async function getWeeklySchedule(teamIds) {
  const promises = teamIds.map(teamId => {
    const calendar = getTeamCalendar(teamId)
    return fetch('/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({
        calendarId: calendar.id,
        timeMin: getWeekStart(),
        timeMax: getWeekEnd()
      })
    })
  })
  
  const results = await Promise.all(promises)
  return results.map(r => r.json())
}
```

### 시나리오 3: 회의실 예약 시스템
```javascript
// 회의실별 캘린더로 예약 관리
async function bookMeetingRoom(roomId, bookingData) {
  const roomCalendar = getMeetingRoomCalendar(roomId)
  
  // 먼저 해당 시간대에 예약이 있는지 확인
  const conflicts = await checkConflicts(roomCalendar.id, bookingData.start, bookingData.end)
  
  if (conflicts.length === 0) {
    return createEvent(roomCalendar.id, bookingData)
  } else {
    throw new Error('해당 시간대에 이미 예약이 있습니다.')
  }
}
```

## 4. 데이터베이스 연동

### Supabase 테이블 구조 예시
```sql
-- 캘린더 설정 테이블
CREATE TABLE calendar_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type TEXT NOT NULL, -- 'team', 'function', 'project'
  target_name TEXT NOT NULL, -- 팀명, 기능명, 프로젝트명
  calendar_id TEXT NOT NULL, -- Google Calendar ID
  calendar_alias TEXT, -- 별칭
  description TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 예시 데이터
INSERT INTO calendar_configs (config_type, target_name, calendar_id, calendar_alias) VALUES
('team', '개발팀', 'dev-team@company.com', '개발팀 일정'),
('team', '마케팅팀', 'marketing@company.com', '마케팅팀 일정'),
('function', '회의실', 'meeting-rooms@company.com', '회의실 예약');
```

## 5. UI 컴포넌트 사용

### ServiceAccountCalendarManager 컴포넌트
```jsx
import ServiceAccountCalendarManager from '@/components/ServiceAccountCalendarManager'

export default function AdminPage() {
  return (
    <div>
      <h1>관리자 대시보드</h1>
      <ServiceAccountCalendarManager />
    </div>
  )
}
```

## 6. 캘린더 권한 설정 가이드

### Google Calendar에서 Service Account 권한 부여:

1. **Google Calendar 웹사이트** 접속
2. **캘린더 설정** (톱니바퀴 아이콘) 클릭
3. **왼쪽 사이드바에서 공유하려는 캘린더** 클릭
4. **"특정 사용자와 공유"** 섹션에서 **"사용자 추가"** 클릭
5. **이메일 주소**: `hr-calendar-service@ecstatic-device-288303.iam.gserviceaccount.com`
6. **권한 선택**:
   - `이벤트 세부정보 보기 및 수정` (추천)
   - `변경 및 공유 관리` (전체 권한)
7. **"전송"** 클릭

### 권한별 차이점:
- **이벤트 세부정보 보기 및 수정**: 이벤트 생성/수정/삭제 가능
- **변경 및 공유 관리**: 캘린더 설정 변경 및 다른 사용자와 공유 가능

이렇게 설정하면 HR 시스템에서 완전 자동으로 캘린더를 관리할 수 있습니다! 🎯