# 휴가 시스템 완전 수정 계획서

## 🚨 **현재 문제점 요약**

### **Critical Issues**
1. **데이터 구조 이중성**: JSON 필드와 별도 컬럼 간 불일치
2. **트랜잭션 함수 의존성**: 환경별 동작 차이
3. **휴가 잔여량 계산 불일치**: 여러 로직이 다른 결과 반환
4. **"대체휴가 잔여량 부족" 오류**: 실제 데이터와 무관한 실패

### **Root Cause**
- 별도 컬럼이 존재하지 않아 `leaveData.substitute_leave_hours`가 항상 `undefined`
- 복잡한 트랜잭션 시스템이 환경에 따라 불안정하게 동작
- 데이터 조회 로직이 일관성 없이 구현됨

## 🔧 **Complete Solution Implementation**

### **Phase 1: Database Schema Fix**

#### 1.1 Database Schema Update
```bash
# 데이터베이스 스키마 수정 실행
cd "/Users/lewis/Desktop/HR System/motion-connect"
psql [YOUR_DATABASE_URL] -f fix-vacation-system.sql
```

**실행 내용:**
- 별도 컬럼 추가 (`substitute_leave_hours`, `compensatory_leave_hours`)
- 기존 JSON 데이터를 별도 컬럼으로 마이그레이션
- 단순화된 PostgreSQL 함수 생성

#### 1.2 Data Validation
```sql
-- 데이터 일관성 확인
SELECT 
  u.name,
  ld.substitute_leave_hours as separate_substitute,
  ld.leave_types->>'substitute_leave_hours' as json_substitute,
  ld.compensatory_leave_hours as separate_compensatory,
  ld.leave_types->>'compensatory_leave_hours' as json_compensatory
FROM leave_days ld
JOIN users u ON ld.user_id = u.id
WHERE u.role = 'user'
ORDER BY u.name;
```

### **Phase 2: API System Replacement**

#### 2.1 Form Request API Update
```bash
# 기존 파일 백업
cp src/app/api/form-requests/route.ts src/app/api/form-requests/route.ts.backup

# 새로운 단순화된 API로 교체
cp src/app/api/form-requests/route-simplified.ts src/app/api/form-requests/route.ts
```

#### 2.2 Approve Request API Update  
```bash
# 기존 파일 백업
cp src/app/api/admin/approve-request/route.ts src/app/api/admin/approve-request/route.ts.backup2

# 새로운 단순화된 API로 교체
cp src/app/api/admin/approve-request/route-simplified.ts src/app/api/admin/approve-request/route.ts
```

### **Phase 3: Frontend Component Update (Optional)**

현재 프론트엔드 컴포넌트들은 이미 데이터 우선순위를 올바르게 처리하고 있어 별도 수정 불필요:
- `UserLeaveStatus.tsx` (line 143): 올바른 fallback 로직
- 별도 컬럼이 생성되면 자동으로 정상 작동

## 🧪 **Comprehensive Test Plan**

### **Test Phase 1: Database Validation**

#### T1.1 Schema Verification
```sql
-- 별도 컬럼 존재 확인
\d leave_days

-- 데이터 동기화 확인
SELECT COUNT(*) as total_users,
       COUNT(substitute_leave_hours) as has_substitute_column,
       COUNT(compensatory_leave_hours) as has_compensatory_column
FROM leave_days;
```

#### T1.2 Data Consistency Check
```sql
-- JSON과 별도 컬럼 값 일치 확인
SELECT u.name,
       CASE 
         WHEN ld.substitute_leave_hours = (ld.leave_types->>'substitute_leave_hours')::NUMERIC 
         THEN 'OK' 
         ELSE 'MISMATCH' 
       END as substitute_status,
       CASE 
         WHEN ld.compensatory_leave_hours = (ld.leave_types->>'compensatory_leave_hours')::NUMERIC 
         THEN 'OK' 
         ELSE 'MISMATCH' 
       END as compensatory_status
FROM leave_days ld
JOIN users u ON ld.user_id = u.id;
```

### **Test Phase 2: API Functionality**

#### T2.1 Vacation Application Test
```bash
# 1. 대체휴가 신청 테스트
curl -X POST http://localhost:3000/api/form-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [USER_ID]" \
  -d '{
    "formType": "휴가 신청서",
    "requestData": {
      "휴가형태": "대체휴가",
      "시작일": "2025-08-10",
      "종료일": "2025-08-10",
      "사유": "테스트"
    }
  }'

# 2. 보상휴가 신청 테스트
curl -X POST http://localhost:3000/api/form-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [USER_ID]" \
  -d '{
    "formType": "휴가 신청서",
    "requestData": {
      "휴가형태": "보상휴가",
      "시작일": "2025-08-11",
      "종료일": "2025-08-11",
      "사유": "테스트"
    }
  }'

# 3. 연차 신청 테스트
curl -X POST http://localhost:3000/api/form-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [USER_ID]" \
  -d '{
    "formType": "휴가 신청서",
    "requestData": {
      "휴가형태": "연차",
      "시작일": "2025-08-12",
      "종료일": "2025-08-12",
      "사유": "테스트"
    }
  }'
```

#### T2.2 Vacation Approval Test
```bash
# 1. 승인 API 작동 확인
curl -X GET http://localhost:3000/api/admin/approve-request

# 2. 실제 승인 처리 테스트
curl -X POST http://localhost:3000/api/admin/approve-request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ADMIN_USER_ID]" \
  -d '{
    "requestId": "[REQUEST_ID]",
    "action": "approve",
    "adminNote": "테스트 승인"
  }'
```

### **Test Phase 3: End-to-End User Flow**

#### T3.1 Complete User Journey
1. **사용자 로그인** → 대시보드 접근
2. **휴가 현황 확인** → 잔여량 정확 표시 확인
3. **대체휴가 신청** → 오류 없이 신청 완료
4. **관리자 승인** → 정상 승인 처리
5. **잔여량 업데이트** → 차감 후 정확한 잔여량 표시

#### T3.2 Error Scenarios
1. **잔여량 부족 시** → 정확한 오류 메시지
2. **중복 신청** → 적절한 오류 처리
3. **권한 없는 접근** → 인증 오류

### **Test Phase 4: Performance & Reliability**

#### T4.1 Concurrent Access Test
- 동시에 여러 사용자가 휴가 신청
- 데이터 일관성 유지 확인

#### T4.2 Database Transaction Test
- 승인 중 실패 시 롤백 확인
- 부분 처리 방지 확인

## 📋 **Implementation Checklist**

### **Pre-Deployment**
- [ ] 기존 데이터 백업
- [ ] 데이터베이스 스키마 업데이트 실행
- [ ] 데이터 마이그레이션 검증
- [ ] API 파일 백업 및 교체

### **Deployment**
- [ ] 데이터베이스 스키마 변경 적용
- [ ] API 엔드포인트 재배포
- [ ] 기본 기능 테스트 실행

### **Post-Deployment**
- [ ] 전체 시스템 기능 테스트
- [ ] 사용자 테스트 요청
- [ ] 모니터링 및 로그 확인
- [ ] 성능 지표 수집

## 🎯 **Expected Results**

### **Immediate Fixes**
1. ✅ "대체휴가 잔여량 부족" 오류 해결
2. ✅ 휴가 승인 기능 정상 작동
3. ✅ 데이터 일관성 보장
4. ✅ 시간 단위 휴가 정확한 계산

### **Long-term Benefits**
1. **단순화된 구조**: 유지보수 용이성 증대
2. **높은 안정성**: 트랜잭션 함수 의존성 제거
3. **일관된 동작**: 환경별 차이 최소화
4. **확장 가능성**: 새로운 휴가 유형 추가 용이

## 🚀 **Immediate Action Items**

### **Priority 1 (즉시 실행)**
1. 데이터베이스 스키마 수정 (`fix-vacation-system.sql` 실행)
2. API 파일 교체 (백업 후 simplified 버전으로 교체)
3. 기본 테스트 실행

### **Priority 2 (테스트 후)**
1. 전체 기능 테스트
2. 사용자 승인 테스트 요청
3. 프로덕션 배포

## 📞 **Support & Rollback Plan**

### **Rollback Strategy**
```bash
# API 롤백
cp src/app/api/form-requests/route.ts.backup src/app/api/form-requests/route.ts
cp src/app/api/admin/approve-request/route.ts.backup2 src/app/api/admin/approve-request/route.ts

# 데이터베이스 롤백 (필요시)
# 별도 컬럼 제거하고 JSON 필드만 사용하도록 복원
```

### **Monitoring Points**
- API 응답 시간
- 오류 발생률
- 데이터 일관성
- 사용자 피드백

---

**이 계획서를 따라 실행하면 현재의 모든 휴가 시스템 문제가 해결되고, 안정적이고 확장 가능한 시스템을 구축할 수 있습니다.**