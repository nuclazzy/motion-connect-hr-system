# Supabase 완전 연동 솔루션

## 현재 문제점
- 로컬 메모리 데이터로 인한 서버 재시작 시 데이터 손실
- 브라우저 간 데이터 공유 불가
- 실제 프로덕션 환경과 다른 동작

## 해결 방안

### 1. API 수정 필요 목록
- `/api/form-requests` → Supabase `leave_days` 테이블 사용
- `/api/admin/employees/[userId]/adjust-leave` → Supabase `leave_days` 테이블 직접 수정
- `/api/admin/employees` → Supabase JOIN 쿼리로 휴가 데이터 포함

### 2. 수정 예시

```typescript
// form-requests/route.ts
const { data: leaveData } = await supabase
  .from('leave_days')
  .select('leave_types')
  .eq('user_id', userId)
  .single()

const availableHours = leaveData.leave_types.substitute_hours || 0
```

### 3. 장점
- ✅ 실시간 다중 브라우저 연동
- ✅ 서버 재시작 후에도 데이터 유지
- ✅ 프로덕션 환경과 동일한 동작
- ✅ 실제 데이터베이스 트랜잭션 테스트

### 4. 단점
- 🔧 약간의 코드 수정 필요 (30분 소요)
- 🔧 Supabase 의존성 증가