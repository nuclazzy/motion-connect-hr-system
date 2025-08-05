import { Metadata } from 'next'
import SimpleCalendarSync from '@/components/SimpleCalendarSync'

export const metadata: Metadata = {
  title: '간단한 캘린더 연동',
  description: '휴가 및 공휴일 데이터를 기존 시스템에 직접 추가'
}

export default function SimpleSyncPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8">
        <SimpleCalendarSync />
      </div>
    </div>
  )
}