'use client'

import MeetingListWidget from './MeetingListWidget'

interface FieldTripProps {
  user?: unknown // user prop이 사용되지 않으므로 선택적으로 변경
}

export default function FieldTrip({}: FieldTripProps) {
  return (
    <MeetingListWidget
      title="외부 미팅/답사"
      targetName="external-meeting"
      noEventsMessage="이번 주에는 예정된 외부 미팅/답사 일정이 없습니다."
    />
  )
}