# 🛠️ 수동 SQL 실행 가이드

캘린더 동기화 시스템을 완성하기 위해 다음 SQL 파일들을 Supabase SQL Editor에서 수동 실행해야 합니다.

## 📋 실행 방법

1. **Supabase SQL Editor 접속**
   ```
   https://supabase.com/dashboard/project/uxfjjquhbksvlqzrjfpj/sql
   ```

2. **파일들을 순서대로 실행**

## 📄 실행할 파일 목록

### 1. `implement-auto-calendar-sync.sql`
**목적**: 캘린더 자동 동기화 시스템 구축
- `calendar_sync_logs` 테이블 생성
- `auto_sync_calendar_data()` 함수 생성  
- `employee_events` 테이블 생성
- `calendar_events_view` 뷰 생성
- `calendar_sync_status` 뷰 생성

### 2. `quarterly-overtime-settlement.sql` 
**목적**: 3개월 탄력근무제 초과근무 정산 시스템
- `quarterly_work_summary` 테이블 생성
- `calculate_quarterly_overtime()` 함수 생성
- 트리거 생성
- 기존 데이터 집계

### 3. `fix-overtime-calculation-logic.sql`
**목적**: 초과근무 계산 로직 버그 수정
- 기존 트리거 제거 및 수정된 함수 적용
- 6월 11일 데이터 수정
- 수동 계산 무시 로직 추가

## ✅ 실행 완료 후 확인사항

실행 완료 후 다음 명령어로 정상 동작 확인:

```sql
-- 1. 캘린더 동기화 상태 확인
SELECT * FROM calendar_sync_status;

-- 2. 3개월 정산 현황 확인  
SELECT * FROM quarterly_overtime_view 
WHERE quarter_start_date >= '2025-01-01'
ORDER BY quarter_start_date DESC, employee_name;

-- 3. 6월 11일 데이터 확인
SELECT 
  u.name,
  dws.work_date,
  TO_CHAR(dws.check_in_time, 'HH24:MI') as check_in,
  TO_CHAR(dws.check_out_time, 'HH24:MI') as check_out,
  dws.basic_hours,
  dws.overtime_hours,
  dws.night_hours,
  dws.work_status
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE u.name = '허지현' 
AND dws.work_date = '2025-06-11';
```

## 🚨 중요사항

- **순서 준수**: 반드시 위 순서대로 실행해야 합니다
- **오류 처리**: 각 파일 실행 시 오류가 발생하면 오류 메시지를 확인하고 해결 후 계속 진행
- **테이블 존재**: 일부 테이블은 이미 존재할 수 있으므로 "already exists" 오류는 정상입니다

## 📞 문제 발생 시

실행 중 문제가 발생하면:
1. 오류 메시지 전체 복사
2. 실행 중이던 SQL 파일명과 위치 기록
3. 현재 데이터베이스 상태 확인

---

이 과정 완료 후 캘린더 동기화 시스템이 완전히 작동합니다! 🎉