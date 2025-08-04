# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-08-04

### Added
- **출퇴근 기록 시스템** - Google Apps Script 웹앱 기능 완전 이전
  - 실시간 출퇴근 기록 with GPS 위치정보
  - 자동 근무시간 계산 (기본/연장/야간 근무시간)
  - 한국 근로기준법 준수 (휴게시간, 저녁식사 시간 자동 차감)
  - 누락 기록 관리 및 관리자 승인 시스템
  - 월별 통계 및 출근율 계산

- **데이터베이스 스키마**
  - `attendance_records` 테이블 - 출퇴근 기록 저장
  - `daily_work_summary` 테이블 - 일별 근무시간 요약
  - `monthly_work_stats` 테이블 - 월별 통계 자동 생성
  - `work_calendar` 테이블 - 공휴일 관리
  - `flex_work_settings` 테이블 - 탄력근로제 설정
  - PostgreSQL 트리거를 통한 자동 계산 시스템

- **API 엔드포인트**
  - `POST /api/attendance/record` - 출퇴근 기록 생성
  - `GET /api/attendance/record` - 출퇴근 기록 조회
  - `PATCH /api/attendance/record` - 출퇴근 기록 수정 (관리자)
  - `GET /api/attendance/status` - 현재 출퇴근 상태 조회
  - `GET /api/attendance/summary` - 월별 근무시간 요약
  - `PATCH /api/attendance/summary` - 근무시간 수동 조정 (관리자)
  - `POST /api/attendance/missing` - 누락 기록 추가
  - `GET /api/attendance/missing` - 누락 기록 조회
  - `PATCH /api/attendance/missing` - 저녁식사 기록 업데이트

- **React 컴포넌트**
  - `AttendanceRecorder` - 실시간 출퇴근 기록 인터페이스
  - `AttendanceDashboard` - 개인 근무시간 현황 대시보드
  - `AdminAttendanceManagement` - 관리자용 전체 출퇴근 관리

- **사용자 페이지**
  - `/attendance` - 일반 직원용 출퇴근 관리 페이지
  - `/admin/attendance` - 관리자용 출퇴근 관리 페이지

- **버전 관리 시스템**
  - npm 스크립트를 통한 자동 버전 업데이트
  - `npm run version:patch/minor/major` 명령어 추가
  - `npm run deploy` 명령어 추가

### Fixed
- 급여 데이터 저장 오류 수정 (AdminEmployeeManagement.tsx)
- 초과근무 API 500 에러 해결 (테이블 존재 여부 확인 로직 추가)
- preventDefault 에러 해결 (이벤트 핸들러 매개변수 옵셔널 처리)
- TypeScript 타입 오류 수정 (API 응답 타입 명시적 선언)

### Changed
- package.json 버전을 2.0.0으로 업데이트
- 프로덕션 빌드 최적화

### Technical Details
- **데이터베이스**: PostgreSQL 트리거 함수로 실시간 계산
- **성능**: 인덱스 최적화로 출퇴근 기록 조회 성능 향상
- **보안**: 관리자 권한 검증 로직 강화
- **UI/UX**: 모바일 반응형 디자인 적용
- **배포**: Vercel 프로덕션 환경 배포 완료

### Deployment
- **Production URL**: https://motion-connect-hxr9zyo25-motionsenses-projects.vercel.app
- **Build Status**: ✅ Success
- **Deployment Date**: 2025-08-04

---

## [1.3.0] - 2024년 말

### Added
- 급여 관리 시스템 구현
- 초과근무 관리 기능
- 네이버 최저임금 API 연동

### Fixed
- 다양한 버그 수정 및 성능 개선

---

## [1.2.0] - 2024년 중반

### Added
- 휴가 관리 시스템 구현
- Google Calendar API 연동
- 휴가 신청/승인 프로세스

---

## [1.1.0] - 2024년 초반

### Added
- 직원 관리 시스템 구현
- 관리자 대시보드 구축
- 부서/직급 관리 기능

---

## [1.0.0] - 2024년 초

### Added
- Next.js 14 프로젝트 초기 설정
- Supabase 데이터베이스 연결
- 기본 인증 시스템 구현
- Vercel 배포 파이프라인 구축

---

## 버전 관리 명령어

### 자동 버전 업데이트 및 배포
```bash
# 패치 버전 업데이트 (2.0.0 → 2.0.1)
npm run version:patch

# 마이너 버전 업데이트 (2.0.0 → 2.1.0)
npm run version:minor

# 메이저 버전 업데이트 (2.0.0 → 3.0.0)
npm run version:major

# 수동 배포
npm run deploy
```

### 버전 업데이트 과정
1. `npm version` 명령어로 package.json 버전 업데이트
2. 자동으로 Git 태그 생성
3. 프로덕션 빌드 실행
4. GitHub에 코드 및 태그 푸시
5. Vercel 자동 배포 트리거

---

*각 버전의 상세한 기술 사양은 CLAUDE.md 파일에서 확인할 수 있습니다.*