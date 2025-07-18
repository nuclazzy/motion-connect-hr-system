# HR-System: 기능 개발 작업 지시서

## 기능 요약

1.  **계약서 관리**: 관리자가 시스템에서 직원의 계약 유형(정규직, 계약직, 인턴, 연봉계약)에 따라 계약서를 동적으로 생성하고 PDF로 저장/관리하는 기능.
2.  **급여명세서 관리**: 관리자가 직원별 급여명세서 파일을 업로드하면, 직원이 대시보드에서 알림을 받고 안전하게 열람하는 "파일박스" 기능.

---

## Part 1: 계약서 생성 및 관리

### 1.1. 기능 개요

관리자가 특정 직원을 선택하고 계약 유형과 세부 정보를 입력하면, 미리 준비된 HTML 템플릿을 기반으로 동적 데이터가 채워진 PDF 계약서가 생성됩니다. 생성된 파일은 직원이 열람하고 출력할 수 있도록 안전하게 보관됩니다.

### 1.2. 데이터베이스 (Supabase)

#### `contracts` 테이블 신규 생성

-   **테이블명**: `contracts`
-   **설명**: 생성된 계약서의 메타데이터를 관리합니다.
-   **RLS 정책**: `payslips`와 유사하게, 관리자는 모든 데이터에 접근 가능하고 직원은 자신의 계약서만 볼 수 있도록 설정합니다.

##### SQL 스키마

```sql
-- 계약 유형을 관리하기 위한 ENUM 타입 생성
CREATE TYPE public.contract_type AS ENUM (
    '정규직',
    '계약직',
    '인턴',
    '연봉계약'
);

CREATE TABLE public.contracts (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    contract_type public.contract_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE, -- 정규직, 연봉계약의 경우 NULL일 수 있음
    salary BIGINT, -- 연봉 정보
    storage_path TEXT NOT NULL, -- Supabase Storage 내 파일 경로
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin full access on contracts"
ON public.contracts FOR ALL TO authenticated
USING (get_my_claim('user_role') = 'admin'::text);

CREATE POLICY "Allow user to view their own contracts"
ON public.contracts FOR SELECT TO authenticated
USING (auth.uid() = user_id);
```

### 1.3. 스토리지 (Supabase Storage)

#### `contracts` 버킷 설정

-   **버킷명**: `contracts`
-   **접근 정책**: Public Access 비활성화. RLS 정책으로 제어.
-   **폴더 구조**: `contracts/{user_id}/{contract_id}.pdf`

##### 스토리지 RLS 정책

```sql
-- SELECT (다운로드) 정책
CREATE POLICY "Allow admin to read all contract files"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts' AND get_my_claim('user_role') = 'admin'::text);

CREATE POLICY "Allow user to read their own contract files"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- INSERT (업로드) 정책
CREATE POLICY "Allow admin to upload contract files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contracts' AND get_my_claim('user_role') = 'admin'::text);
```

### 1.4. 백엔드 (Next.js API Routes)

#### 가. 계약서 생성 API

-   **경로**: `POST /api/admin/contracts/generate`
-   **역할**: 관리자가 요청한 정보를 바탕으로 계약서 PDF를 생성하고 저장합니다.
-   **요청 본문 (JSON)**:
    ```json
    {
      "userId": "...",
      "contractType": "연봉계약",
      "startDate": "2025-08-01",
      "endDate": "2026-07-31",
      "salary": 50000000
    }
    ```
-   **주요 로직**:
    1.  관리자 권한 확인.
    2.  `userId`로 직원 정보(이름 등) 조회.
    3.  `contractType`에 맞는 HTML 템플릿 (`/src/lib/contract-templates/` 폴더) 로드.
    4.  템플릿의 Placeholder (`{{employee_name}}`, `{{salary}}` 등)를 실제 데이터로 치환.
    5.  **(핵심)** `puppeteer` 또는 `chrome-aws-lambda` 라이브러리를 사용하여 HTML을 PDF로 변환.
    6.  생성된 PDF를 Supabase Storage(`contracts` 버킷)에 업로드.
    7.  파일 정보를 `contracts` 테이블에 저장.

#### 나. 사용자: 계약서 목록 조회 API

-   **경로**: `GET /api/user/contracts`
-   **역할**: 로그인한 직원이 자신의 계약서 목록을 조회합니다.

### 1.5. 프론트엔드 (React Components)

#### 가. 계약서 템플릿 준비

-   **위치**: `/src/lib/contract-templates/` 디렉토리 생성.
-   **파일**: `permanent.html`, `contract.html`, `intern.html`, `salary.html`
-   **내용**: 각 파일은 표준 계약서 양식이며, 동적 데이터는 `{{placeholder}}` 형식으로 작성.

#### 나. 관리자 페이지

-   **위치**: 직원 관리 페이지 내 '계약 관리' 탭 추가.
-   **기능**:
    1.  '신규 계약서 작성' 버튼 클릭 시, 계약 유형, 기간, 연봉 등 입력 폼(모달) 표시.
    2.  '생성하기' 클릭 시 `/api/admin/contracts/generate` API 호출.
    3.  해당 직원의 기존 계약서 목록과 다운로드 링크 표시.

#### 다. 사용자 대시보드

-   **위치**: `/user/page.tsx` 내 '내 계약 정보' 컴포넌트 추가.
-   **기능**:
    1.  `/api/user/contracts` API로 자신의 계약서 목록 조회.
    2.  목록에서 항목 클릭 시, PDF 다운로드/열람.

---

## Part 2: 급여명세서 관리

### 2.1. 기능 개요

관리자가 직원별로 급여명세서 파일을 업로드하고, 직원은 자신의 대시보드에서 이를 확인하고 열람할 수 있는 "파일박스" 형태의 기능을 개발합니다.

### 2.2. 데이터베이스 (Supabase)

#### `payslips` 테이블 신규 생성

-   **테이블명**: `payslips`
-   **RLS 정책**: 직원은 자기 데이터만, 관리자는 모든 데이터 접근 가능.

##### SQL 스키마

```sql
CREATE TABLE public.payslips (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pay_date DATE NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payslips_user_pay_date_unique UNIQUE (user_id, pay_date)
);

-- RLS Policies
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin full access on payslips"
ON public.payslips FOR ALL TO authenticated
USING (get_my_claim('user_role') = 'admin'::text);

CREATE POLICY "Allow user to view their own payslips"
ON public.payslips FOR SELECT TO authenticated
USING (auth.uid() = user_id);
```

### 2.3. 스토리지 (Supabase Storage)

#### `payslips` 버킷 설정

-   **버킷명**: `payslips`
-   **접근 정책**: Public Access 비활성화.
-   **폴더 구조**: `payslips/{user_id}/{file_name}`

##### 스토리지 RLS 정책

```sql
-- SELECT (다운로드) 정책
CREATE POLICY "Allow admin to read all payslip files"
ON storage.objects FOR SELECT
USING (bucket_id = 'payslips' AND get_my_claim('user_role') = 'admin'::text);

CREATE POLICY "Allow user to read their own payslip files"
ON storage.objects FOR SELECT
USING (bucket_id = 'payslips' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- INSERT (업로드) 정책
CREATE POLICY "Allow admin to upload payslip files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payslips' AND get_my_claim('user_role') = 'admin'::text);
```

### 2.4. 백엔드 (Next.js API Routes)

-   **관리자 업로드**: `POST /api/admin/payslips` (`multipart/form-data`)
-   **사용자 목록 조회**: `GET /api/user/payslips`
-   **사용자 읽음 처리**: `PATCH /api/user/payslips/[payslipId]`

### 2.5. 프론트엔드 (React Components)

-   **관리자 페이지**: 직원 선택 > 지급 월/파일 선택 > 업로드 기능.
-   **사용자 대시보드**: `is_read: false`인 경우 "새 명세서" 알림, 목록 조회 및 다운로드, 클릭 시 읽음 처리.

---

## 3. 작업 순서 제안 (통합 체크리스트)

### 계약서 기능
1.  [ ] **DB**: `contract_type` ENUM 및 `contracts` 테이블 스키마 적용.
2.  [ ] **DB**: `contracts` 테이블 RLS 정책 적용.
3.  [ ] **Storage**: `contracts` 버킷 생성 및 RLS 정책 적용.
4.  [ ] **Frontend**: HTML 계약서 템플릿 4종 추가.
5.  [ ] **Backend**: 계약서 생성 API (`/api/admin/contracts/generate`) 개발 (PDF 변환 포함).
6.  [ ] **Backend**: 사용자 계약서 목록 API (`/api/user/contracts`) 개발.
7.  [ ] **Frontend**: 관리자 페이지에 계약서 생성/관리 UI 구현.
8.  [ ] **Frontend**: 사용자 대시보드에 계약서 조회 UI 구현.

### 급여명세서 기능
9.  [ ] **DB**: `payslips` 테이블 스키마 적용.
10. [ ] **DB**: `payslips` 테이블 RLS 정책 적용.
11. [ ] **Storage**: `payslips` 버킷 생성 및 RLS 정책 적용.
12. [ ] **Backend**: 급여명세서 관련 API 3종 개발.
13. [ ] **Frontend**: 관리자 페이지에 급여명세서 업로드 UI 구현.
14. [ ] **Frontend**: 사용자 대시보드에 급여명세서 알림/조회 UI 구현.

### 최종
15. [ ] **Test**: 두 기능 전체 통합 테스트.