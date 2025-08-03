-- 모든 사용자의 leave_types JSON 필드에 시간 단위 휴가 필드 추가
UPDATE leave_days 
SET leave_types = jsonb_set(
  jsonb_set(
    leave_types::jsonb,
    '{substitute_leave_hours}',
    COALESCE(substitute_leave_hours, 0)::text::jsonb
  ),
  '{compensatory_leave_hours}',
  COALESCE(compensatory_leave_hours, 0)::text::jsonb
),
updated_at = NOW()
WHERE leave_types::jsonb ? 'annual_days' 
AND (
  NOT (leave_types::jsonb ? 'substitute_leave_hours') 
  OR NOT (leave_types::jsonb ? 'compensatory_leave_hours')
);

-- 결과 확인
SELECT 
  u.name,
  ld.substitute_leave_hours as column_substitute,
  ld.leave_types->>'substitute_leave_hours' as json_substitute,
  ld.compensatory_leave_hours as column_compensatory,
  ld.leave_types->>'compensatory_leave_hours' as json_compensatory
FROM leave_days ld
JOIN users u ON ld.user_id = u.id
WHERE u.role = 'user'
ORDER BY u.name;