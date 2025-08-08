-- users 테이블에 employee_number 컬럼 추가
-- 사원번호 기반 시스템 통일을 위한 스키마 변경

-- 1. users 테이블에 employee_number 컬럼 추가
ALTER TABLE users 
ADD COLUMN employee_number VARCHAR(20) UNIQUE;

-- 2. employee_number 컬럼에 인덱스 생성 (검색 성능 향상)
CREATE INDEX idx_users_employee_number ON users(employee_number);

-- 3. attendance_records 테이블에 employee_number 컬럼 추가 (선택적 - 조인 성능 향상용)
ALTER TABLE attendance_records 
ADD COLUMN employee_number VARCHAR(20);

-- 4. employee_number 인덱스 생성
CREATE INDEX idx_attendance_records_employee_number ON attendance_records(employee_number);

-- 5. 기존 데이터가 있다면 임시 사원번호 할당 (선택사항)
-- UPDATE users SET employee_number = 'EMP' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 3, '0') WHERE employee_number IS NULL;

COMMENT ON COLUMN users.employee_number IS '사원번호 - CSV 데이터와 연동용';
COMMENT ON COLUMN attendance_records.employee_number IS '사원번호 - 성능 향상을 위한 중복 저장';