import HolidayApiTester from '@/components/HolidayApiTester'

export default function HolidayTestPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">공휴일 API 테스트</h1>
        <p className="text-gray-600 mt-2">
          Multi-Source 하이브리드 공휴일 API 시스템을 테스트합니다.
        </p>
      </div>
      
      <HolidayApiTester />
    </div>
  )
}