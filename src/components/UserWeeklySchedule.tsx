'use client'

import MeetingListWidget from './MeetingListWidget'
import { type User } from '@/lib/auth'

interface UserWeeklyScheduleProps {
  user: User
}

export default function UserWeeklySchedule({}: UserWeeklyScheduleProps) {
  return (
    <div className="space-y-4">
      {/* 외부 미팅 및 답사 일정 */}
      <div className="bg-white rounded-lg border p-4">
        <MeetingListWidget
          title="외부 미팅 및 답사 일정"
          calendarType="external"
          noEventsMessage="외부 미팅 및 답사 일정이 없습니다"
        />
      </div>
      
      {/* 내부 회의 및 면담 일정 */}
      <div className="bg-white rounded-lg border p-4">
        <MeetingListWidget
          title="내부 회의 및 면담 일정"
          calendarType="internal"
          noEventsMessage="내부 회의 및 면담 일정이 없습니다"
        />
      </div>
    </div>
  )
}