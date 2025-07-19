'use client'

import MeetingListWidget from './MeetingListWidget'
import { type User } from '@/lib/auth'

interface AdminWeeklyScheduleProps {
  user: User
}

export default function AdminWeeklySchedule({}: AdminWeeklyScheduleProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                이번주 미팅 및 답사일정
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                관리자 일정 관리
              </dd>
            </dl>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <MeetingListWidget
            title="외부 미팅 및 답사"
            calendarType="external"
            noEventsMessage="외부 미팅 및 답사 일정이 없습니다"
            maxResults={5}
          />
          <hr className="border-gray-200" />
          <MeetingListWidget
            title="내부 회의 및 면담"
            calendarType="internal"
            noEventsMessage="내부 회의 및 면담 일정이 없습니다"
            maxResults={5}
          />
        </div>
      </div>
    </div>
  )
}