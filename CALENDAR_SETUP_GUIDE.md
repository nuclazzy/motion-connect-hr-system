# 🚨 캘린더 일정이 안 보이는 문제 해결 가이드

## 📋 **문제 원인 분석**

일정이 안 보이는 가장 일반적인 원인들:

### 1. **Google Calendar Service Account 권한 문제** (가능성 90%)
- Service Account 이메일: `hr-calendar-service@motion-connect-hr-system.iam.gserviceaccount.com`
- 이 이메일이 각 Google Calendar에 공유되어야 함

### 2. **캘린더 ID 오류** (가능성 5%)
- 캘린더 ID가 실제와 다를 수 있음

### 3. **API 인증 오류** (가능성 5%)
- 환경변수 설정 문제

## 🔧 **해결 방법**

### **Step 1: Service Account 권한 부여** (필수!)

다음 Google Calendar들에 Service Account를 공유해야 합니다:

#### 팀별 캘린더:
1. **이벤트 기획 본부**: `motionsense.co.kr_v114c8qko1blc6966cice8hcv4@group.calendar.google.com`
2. **중계 및 시스템 운영**: `c_a3439675645443007e8ff58575fcfa4bbb7fbfadece96235962422566cf987e3@group.calendar.google.com`
3. **촬영팀**: `dingastory.com_i0i3lutf4rkeijhen3cqju08co@group.calendar.google.com`
4. **편집팀**: `c_22693rqcgc7nrbdhl96f0g903k@group.calendar.google.com`

#### 미팅 캘린더:
5. **외부 미팅 및 답사**: `motionsense.co.kr_vdbr1eu5ectsbsnod67gdohj00@group.calendar.google.com`
6. **내부 회의 및 면담**: `dingastory.com_aatf30n7ad8e3mq7kfilhvu6rk@group.calendar.google.com`

#### 휴가 캘린더:
7. **연차 및 경조사 현황**: `c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com`

### **각 캘린더에 권한 부여 방법:**

1. Google Calendar 웹사이트에서 각 캘린더 열기
2. 캘린더 설정 → "특정 사용자와 공유"
3. 이메일 추가: `hr-calendar-service@motion-connect-hr-system.iam.gserviceaccount.com`
4. 권한: **"변경 및 이벤트 관리"** 선택
5. 저장

### **Step 2: 브라우저에서 디버깅 확인**

1. 개발 서버 실행: `npm run dev`
2. 브라우저에서 `http://localhost:3002/user` 접속
3. 개발자 도구 → Console 탭 열기
4. TeamSchedule 컴포넌트에서 다음 로그 확인:

```
📅 [DEBUG] 부서별 캘린더 설정 시작: [부서명]
📅 [DEBUG] 부서별 캘린더: { own: [...], others: [...] }
📅 [DEBUG] 전체 캘린더 목록: [...]
🔄 [DEBUG] 동기화 시작 - 캘린더 설정 개수: [숫자]
🔄 [DEBUG] 캘린더 API 응답 상태: [200/403/404]
🔄 [DEBUG] 가져온 이벤트 수: [숫자]
📊 [DEBUG] DB에서 가져온 미팅 수: [숫자]
```

### **Step 3: 오류별 해결책**

#### **오류 1: "403 Forbidden"**
→ Service Account 권한이 없음. Step 1 실행

#### **오류 2: "404 Not Found"**
→ 캘린더 ID가 잘못됨. 실제 캘린더 ID 확인 필요

#### **오류 3: "401 Unauthorized"**
→ Service Account 인증 실패. 환경변수 확인

#### **오류 4: 캘린더 설정 개수가 0**
→ 부서명이 매핑에 없음. `DEPARTMENT_CALENDAR_MAPPING` 확인

#### **오류 5: DB 미팅 수가 0**
→ 동기화는 성공했지만 DB에 저장되지 않음. `/api/calendar/sync` 확인

## 🧪 **테스트 방법**

### **Google Calendar API 연결 테스트:**
```bash
curl http://localhost:3002/api/calendar/diagnose
```

### **Supabase DB 연결 테스트:**
```bash
curl http://localhost:3002/api/test-supabase
```

### **특정 캘린더 이벤트 조회 테스트:**
```bash
curl -X POST http://localhost:3002/api/calendar/events \
  -H "Content-Type: application/json" \
  -d '{
    "calendarId": "motionsense.co.kr_v114c8qko1blc6966cice8hcv4@group.calendar.google.com",
    "timeMin": "2024-01-01T00:00:00Z",
    "timeMax": "2024-12-31T23:59:59Z"
  }'
```

## 📝 **추가 디버깅**

`src/components/TeamSchedule.tsx`에 디버깅 로그가 추가되었습니다.
브라우저 콘솔에서 실시간으로 문제를 확인할 수 있습니다.

---

**대부분의 경우 Step 1의 Service Account 권한 부여만으로 해결됩니다!** 🚀