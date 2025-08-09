# 공휴일 데이터 관리 시스템 설정 가이드

## 개요

Motion Connect HR System은 **멀티소스 공휴일 관리 시스템**을 사용하여 정확한 공휴일 데이터를 제공합니다.

## 데이터 소스

### 1. Google Calendar API (우선순위 1)
- **가장 신뢰할 수 있는 소스**
- 정규 공휴일 + 임시공휴일 모두 포함
- 실시간 업데이트

### 2. KASI API (우선순위 2)  
- 한국천문연구원 공식 API
- 정규 공휴일만 제공 (연 11개)
- 정부 공인 데이터

### 3. Custom Database (우선순위 3)
- Supabase `custom_holidays` 테이블
- 관리자가 직접 관리
- 임시공휴일 수동 추가

## 설정 방법

### 1. Google Calendar API 설정

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "APIs & Services" → "Enable APIs and Services" 클릭
4. "Google Calendar API" 검색 후 활성화
5. "Credentials" → "Create Credentials" → "API Key" 생성
6. API 키를 `.env.local`에 추가:
   ```
   NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key_here
   ```

### 2. KASI API 설정

1. [공공데이터포털](https://www.data.go.kr) 접속
2. "한국천문연구원 특일정보" 검색
3. API 신청 및 승인 대기
4. 발급받은 서비스 키를 `.env.local`에 추가:
   ```
   HOLIDAY_API_KEY=your_kasi_api_key_here
   ```

### 3. Custom Holidays 관리

1. Supabase 대시보드에서 SQL 실행:
   ```sql
   -- supabase-custom-holidays.sql 파일 내용 실행
   ```

2. 관리자 페이지에서 임시공휴일 추가:
   - `/admin` → "임시공휴일 관리" 섹션
   - 날짜, 이름, 유형 입력 후 추가

## 데이터 동기화

### 자동 동기화
- 시스템이 자동으로 모든 소스에서 데이터 수집
- 우선순위에 따라 충돌 해결
- 24시간 캐싱

### 수동 동기화
1. 관리자 페이지 접속 (`/admin`)
2. "공휴일 데이터 모니터링" 섹션
3. "데이터 동기화" 버튼 클릭

## 문제 해결

### Google Calendar API 오류
- API 키 확인
- API 활성화 상태 확인
- 할당량 초과 여부 확인

### KASI API 오류
- 서비스 키 유효성 확인
- API 서버 상태 확인
- 인코딩 문제 확인 (URL 인코딩 필요)

### Custom Holidays 동기화 오류
- Supabase 연결 상태 확인
- 테이블 권한 확인
- 중복 데이터 확인

## 데이터 검증

관리자 페이지에서 "데이터 검증" 버튼을 클릭하여:
- 필수 공휴일 존재 여부 확인
- 데이터 충돌 감지
- 소스별 데이터 수 확인
- 권장사항 제공

## 임시공휴일 관리 절차

1. **정부 발표 확인**: 행정안전부 또는 정부24 공식 발표
2. **Custom DB 추가**: 관리자 페이지에서 즉시 추가
3. **데이터 동기화**: 동기화 버튼 클릭
4. **검증**: 데이터 검증으로 정상 반영 확인

## 모니터링

### 대시보드 지표
- 총 공휴일 수
- 활성 데이터 소스
- 마지막 동기화 시간
- 데이터 충돌 현황

### 로그 확인
브라우저 콘솔에서:
- ✅ 성공 메시지
- ⚠️ 경고 메시지  
- ❌ 오류 메시지

## 권장사항

1. **매일 1회 이상 자동 동기화 실행**
2. **정부 공휴일 발표 시 즉시 Custom DB 업데이트**
3. **월 1회 데이터 검증 실행**
4. **Google API 키 정기적 로테이션**
5. **백업 데이터 소스 항상 활성화**

## 지원

문제 발생 시:
1. 로그 확인
2. 데이터 검증 실행
3. GitHub Issues 등록