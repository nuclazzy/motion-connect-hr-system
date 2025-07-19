'use client'

import MeetingListWidget from './MeetingListWidget'
import { type User } from '@/lib/auth'

interface UserWeeklyScheduleProps {
  user: User
}

export default function UserWeeklySchedule({}: UserWeeklyScheduleProps) {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* 데스크톱: 2열 그리드, 모바일: 1열 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* 외부 미팅 및 답사 일정 */}
        <div className="bg-white rounded-lg border p-3 md:p-4 shadow-sm">
          <MeetingListWidget
            title="외부 미팅 및 답사 일정"
            calendarType="external"
            noEventsMessage="외부 미팅 및 답사 일정이 없습니다"
          />
        </div>
        
        {/* 내부 회의 및 면담 일정 */}
        <div className="bg-white rounded-lg border p-3 md:p-4 shadow-sm">
          <MeetingListWidget
            title="내부 회의 및 면담 일정"
            calendarType="internal"
            noEventsMessage="내부 회의 및 면담 일정이 없습니다"
          />
        </div>
      </div>
    </div>
  )
}