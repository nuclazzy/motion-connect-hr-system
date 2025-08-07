# Backup Files Directory

이 디렉토리는 Motion Connect HR System v2.1 개발 과정에서 생성되었지만 현재 시스템에서 사용되지 않는 파일들을 보관합니다.

## 📁 Directory Structure

### `legacy-files/`
**Google Apps Script 기반 이전 시스템 파일들**
- `CalculatorCode.gs` - 구 근무시간 계산 로직 (449줄)
- `Code.gs` - 구 메인 서버 로직 및 웹앱 엔드포인트

이 파일들은 기존 Google Apps Script 기반 시스템의 핵심 로직을 포함하고 있으며, Next.js + Supabase 시스템으로 완전히 전환되면서 더 이상 사용되지 않습니다.

### `unused-assets/`  
**사용되지 않는 정적 자산들**
- `Index.html` - 구 웹앱 HTML 인터페이스
- `WorkTimeViewer.html` - 구 근무시간 뷰어 HTML

이 파일들은 기존 HTML 기반 UI를 포함하고 있으며, React 컴포넌트로 완전히 대체되었습니다.

### `testing-scripts/`
**개발 및 테스트 스크립트들**
- `check-*.js` - Supabase 데이터베이스 검증 스크립트들 (8개)
- `test-*.js` - 기능 테스트 스크립트들 (2개) 
- `verify-*.js` - 시스템 검증 스크립트들 (2개)
- `final-*.js` - 최종 검증 스크립트 (1개)
- `deep-*.js` - 심화 검증 스크립트 (1개)
- `add-missing-columns.sql` - 데이터베이스 스키마 추가 스크립트
- `deploy-edge-functions.sh` - Supabase Edge Functions 배포 스크립트
- `기록데이터샘플.csv` - CAPS 시스템 샘플 데이터

이 파일들은 개발 과정에서 시스템 검증과 테스트를 위해 생성되었으며, 시스템 완성 후에는 필요하지 않습니다.

## 🎯 보관 이유

### 1. **개발 히스토리 보존**
- Google Apps Script에서 Next.js로 전환한 과정의 증거
- 기존 시스템의 로직과 구조 참조용

### 2. **롤백 가능성 대비**
- 만약 미래에 기존 로직 참조가 필요한 경우 활용 가능
- 특히 `CalculatorCode.gs`는 근무시간 계산의 원본 로직 포함

### 3. **테스트 스크립트 재사용**
- 향후 시스템 확장 시 검증 스크립트들을 참조하여 새로운 테스트 작성 가능
- 데이터 마이그레이션 스크립트들도 유사한 작업에 재활용 가능

## ⚠️ 주의사항

- 이 백업 파일들은 현재 프로덕션 시스템에서 **사용되지 않습니다**
- 파일 수정 시 현재 시스템에 영향을 주지 않습니다
- 필요시 안전하게 삭제 가능합니다

## 📊 파일 통계

- **총 백업 파일**: 19개
- **Google Apps Script**: 2개 (레거시 시스템)
- **HTML 자산**: 2개 (구 UI)
- **테스트 스크립트**: 15개 (개발/검증용)

---

**백업 생성일**: 2025년 8월 7일  
**시스템 버전**: Motion Connect HR System v2.1  
**백업 사유**: Direct Supabase Integration 전환 완료