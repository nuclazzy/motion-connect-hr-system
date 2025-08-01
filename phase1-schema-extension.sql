-- Phase 1: 데이터베이스 스키마 확장 
-- Motion Connect HR System - 동적 폼 시스템 구축
-- 기존 CLEAN-FINAL-schema.sql에 추가할 내용

-- ========================================
-- 8단계: 동적 서식 템플릿 테이블 (신규)
-- ========================================
CREATE TABLE public.form_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- 예: "휴가 신청서", "재직증명서"
    description TEXT,
    fields JSONB NOT NULL, -- 폼을 구성하는 필드들의 정의
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

COMMENT ON COLUMN public.form_templates.fields IS '폼 필드 정의. 예: [{"name": "휴가형태", "label": "휴가 형태", "type": "select", "required": true, "options": ["연차", "병가"], "condition": {"field": "...", "operator": "...", "value": "..."}}]';

-- RLS 정책
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view active form templates"
ON public.form_templates FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Admins can manage form templates"
ON public.form_templates FOR ALL
USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- ========================================
-- 9단계: 알림 시스템 테이블 (신규)
-- ========================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- 알림을 받는 사용자
    message TEXT NOT NULL,
    link TEXT, -- 클릭 시 이동할 경로 (예: /admin/leave-management)
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own notifications"
ON public.notifications FOR ALL
USING (auth.uid() = user_id);

-- 인덱스 추가
CREATE INDEX idx_form_templates_name ON public.form_templates(name);
CREATE INDEX idx_form_templates_is_active ON public.form_templates(is_active);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

-- 자동 업데이트 트리거 추가
CREATE TRIGGER update_form_templates_updated_at BEFORE UPDATE ON public.form_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 10단계: 초기 서식 템플릿 데이터
-- ========================================

-- 초기 서식 템플릿 데이터 INSERT
INSERT INTO public.form_templates (name, description, fields)
VALUES
(
  '휴가 신청서',
  '연차, 병가, 경조사 등 일반 휴가를 신청합니다.',
  '[
    { "name": "휴가형태", "label": "휴가 형태", "type": "select", "required": true, "options": ["연차", "오전 반차", "오후 반차", "병가", "경조사", "공가", "기타"] },
    { "name": "시작일", "label": "날짜 또는 시작일", "type": "date", "required": true },
    { "name": "종료일", "label": "종료일", "type": "date", "required": true, "condition": { "field": "휴가형태", "operator": "not in", "value": ["오전 반차", "오후 반차"] } },
    { "name": "사유", "label": "사유 (연차/반차 외 필수)", "type": "textarea", "required": false, "condition": { "field": "휴가형태", "operator": "not in", "value": ["연차", "오전 반차", "오후 반차"] } },
    { "name": "전달사항", "label": "전달사항 (업무 인수인계)", "type": "textarea", "required": false },
    { "name": "비상연락처", "label": "비상연락처", "type": "text", "required": false }
  ]'
),
(
  '재직증명서',
  '재직증명서 발급을 신청합니다.',
  '[
    { "name": "제출처", "label": "제출처 (용도)", "type": "text", "required": true }
  ]'
),
(
  '휴직계',
  '개인 사유로 인한 휴직을 신청합니다.',
  '[
    { "name": "휴직형태", "label": "휴직 형태", "type": "select", "required": true, "options": ["무급휴직", "유급휴직", "기타"] },
    { "name": "시작일", "label": "휴직 시작일", "type": "date", "required": true },
    { "name": "종료일", "label": "휴직 종료일", "type": "date", "required": true },
    { "name": "휴직사유", "label": "휴직 사유", "type": "textarea", "required": true }
  ]'
),
(
  '초과근무 신청서',
  '주말 및 공휴일 근무 시 신청합니다. 근무 시간에 따라 대체휴가 또는 보상휴가가 지급됩니다.',
  '[
    { "name": "근무일", "label": "근무일", "type": "date", "required": true },
    { "name": "시작시간", "label": "시작 시간", "type": "time", "required": true },
    { "name": "종료시간", "label": "종료 시간", "type": "time", "required": true },
    { "name": "저녁식사 여부", "label": "저녁 식사 여부 (오후 6시 이후 근무 시)", "type": "select", "options": ["아니오", "예"], "required": true, "condition": { "field": "종료시간", "operator": ">=", "value": "18:00" } },
    { "name": "업무내용", "label": "주요 업무 내용", "type": "textarea", "required": true }
  ]'
);

-- 스키마 확장 완료 확인
SELECT 
    '🚀 Phase 1 스키마 확장 완료!' as status,
    '📋 ' || COUNT(*) || '개 폼 템플릿 생성' as templates_created,
    '🔔 알림 시스템 테이블 생성 완료' as notifications_ready
FROM public.form_templates
WHERE is_active = TRUE;