'use client'

import MeetingListWidget from './MeetingListWidget'

interface InternalMeetingProps {
  user?: unknown // user prop이 사용되지 않으므로 선택적으로 변경
}

export default function InternalMeeting({}: InternalMeetingProps) {
  return (
    <MeetingListWidget
      title="내부 회의/면담"
      targetName="internal-meeting"
      noEventsMessage="이번 주에는 예정된 내부 회의/면담 일정이 없습니다."
    />
  )
}