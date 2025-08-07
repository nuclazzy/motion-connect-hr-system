-- 특별휴가 기록 테이블 생성
-- 연차와 별개로 부여되는 특별휴가 (결혼, 경조사, 리프레시 등)를 기록

CREATE TABLE IF NOT EXISTS special_leave_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  leave_title VARCHAR(200) NOT NULL, -- 휴가 종류 (예: "본인 결혼 특별휴가")
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_days INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  granted_by VARCHAR(100), -- 부여한 관리자
  calendar_event_id VARCHAR(255), -- Google Calendar 이벤트 ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_special_leave_user_id ON special_leave_records(user_id);
CREATE INDEX idx_special_leave_start_date ON special_leave_records(start_date);
CREATE INDEX idx_special_leave_created_at ON special_leave_records(created_at);

-- form_requests 테이블에 cancelled 상태와 관련 필드 추가 (이미 없는 경우)
ALTER TABLE form_requests 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(100);

-- 상태 체크 제약 조건 업데이트 (cancelled 추가)
ALTER TABLE form_requests 
DROP CONSTRAINT IF EXISTS form_requests_status_check;

ALTER TABLE form_requests
ADD CONSTRAINT form_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

COMMENT ON TABLE special_leave_records IS '특별휴가 부여 기록 - 연차와 별개로 관리되는 휴가';
COMMENT ON COLUMN special_leave_records.leave_title IS '휴가 종류 (예: 본인 결혼, 가족 경조사, 리프레시 휴가 등)';
COMMENT ON COLUMN special_leave_records.granted_by IS '휴가를 부여한 관리자 ID 또는 이름';
COMMENT ON COLUMN special_leave_records.calendar_event_id IS 'Google Calendar에 생성된 이벤트 ID';