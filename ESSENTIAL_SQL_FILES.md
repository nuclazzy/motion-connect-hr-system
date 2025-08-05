# 핵심 필수 SQL 파일 목록

## 보관할 파일들 (7개)

### 1. 기본 스키마
- `supabase-attendance-system-schema.sql` - 메인 데이터베이스 스키마

### 2. 최신 중요 수정사항
- `complete-cleanup-and-fix.sql` - 6월 11일 초과근무 25.8시간 버그 수정
- `fix-all-calendar-constraints.sql` - 캘린더 연동 시스템 완전 구축
- `prevent-abnormal-work-hours-trigger.sql` - 비정상 근무시간 방지 시스템

### 3. 분기별 시스템
- `quarterly-overtime-settlement.sql` - 3개월 탄력근무제 정산 시스템
- `implement-auto-calendar-sync.sql` - 구글 캘린더 자동 동기화

### 4. 실행 가이드
- `MANUAL_SQL_EXECUTION_GUIDE.md` - SQL 실행 매뉴얼

## 삭제할 파일들 (71개)
- 모든 중복/테스트/실험용 SQL 파일들
- 구버전 및 임시 파일들
- 디버깅용 임시 파일들