import { Metadata } from 'next'
import SimpleCalendarSync from '@/components/SimpleCalendarSync'
import WorkSummarySync from '@/components/WorkSummarySync'

export const metadata: Metadata = {
  title: '간단한 캘린더 연동',
  description: '휴가 및 공휴일 데이터를 기존 시스템에 직접 추가'
}

export default function SimpleSyncPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8 space-y-8">
        {/* 자동 동기화 섹션 */}
        <WorkSummarySync />
        
        {/* 기존 수동 입력 섹션 */}
        <SimpleCalendarSync />
      </div>
    </div>
  )
}