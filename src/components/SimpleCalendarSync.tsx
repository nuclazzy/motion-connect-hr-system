'use client'

import { useState } from 'react'
import { Calendar, Users, Plus, Download, CheckCircle, AlertTriangle } from 'lucide-react'
import { addLeaveToEmployee, addHolidayForAllUsers, syncNaverHolidays } from '@/utils/calendarSync'

interface SyncResult {
  success: boolean
  message: string
  data?: any
}

export default function SimpleCalendarSync() {
  const [results, setResults] = useState<SyncResult[]>([])
  const [loading, setLoading] = useState(false)

  // 개별 휴가 추가 폼
  const [leaveForm, setLeaveForm] = useState({
    userName: '',
    leaveDate: '',
    leaveType: '연차',
    hours: 8.0
  })

  // 공휴일 추가 폼
  const [holidayForm, setHolidayForm] = useState({
    holidayDate: '',
    holidayName: ''
  })

  // 개별 휴가 추가
  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await addLeaveToEmployee(
        leaveForm.userName,
        leaveForm.leaveDate,
        leaveForm.leaveType,
        leaveForm.hours
      )

      setResults(prev => [...prev, {
        success: result.success,
        message: result.success 
          ? `${leaveForm.userName}님 ${leaveForm.leaveDate} ${leaveForm.leaveType} 추가 완료`
          : `오류: ${result.error}`
      }])

      if (result.success) {
        setLeaveForm({ userName: '', leaveDate: '', leaveType: '연차', hours: 8.0 })
      }
    } catch (error) {
      setResults(prev => [...prev, {
        success: false,
        message: `오류: ${error}`
      }])
    } finally {
      setLoading(false)
    }
  }

  // 공휴일 전체 적용
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await addHolidayForAllUsers(
        holidayForm.holidayDate,
        holidayForm.holidayName
      )

      setResults(prev => [...prev, {
        success: result.success,
        message: result.success 
          ? `${holidayForm.holidayDate} ${holidayForm.holidayName} 전체 직원 적용 완료 (${result.data?.applied_users}명)`
          : `오류: ${result.error}`
      }])

      if (result.success) {
        setHolidayForm({ holidayDate: '', holidayName: '' })
      }
    } catch (error) {
      setResults(prev => [...prev, {
        success: false,
        message: `오류: ${error}`
      }])
    } finally {
      setLoading(false)
    }
  }

  // 네이버 공휴일 자동 동기화
  const handleSyncNaverHolidays = async () => {
    setLoading(true)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    try {
      const result = await syncNaverHolidays(year, month)
      
      if (result.success && result.holidayResults && Array.isArray(result.holidayResults)) {
        setResults(prev => [...prev, {
          success: true,
          message: `${year}년 ${month}월 네이버 공휴일 동기화 완료 (${result.holidayResults.length}개 공휴일)`
        }])
      } else {
        setResults(prev => [...prev, {
          success: false,
          message: `네이버 공휴일 동기화 오류: ${result.error || '알 수 없는 오류'}`
        }])
      }
    } catch (error) {
      setResults(prev => [...prev, {
        success: false,
        message: `네이버 공휴일 동기화 오류: ${error}`
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          간단한 캘린더 및 공휴일 연동
        </h2>
        <p className="text-gray-600">
          기존 일별 근무시간 테이블에 직접 휴가 및 공휴일 데이터 추가
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 개별 휴가 추가 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Users className="h-5 w-5 text-blue-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">개별 휴가 추가</h3>
          </div>

          <form onSubmit={handleAddLeave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                직원 이름
              </label>
              <input
                type="text"
                value={leaveForm.userName}
                onChange={(e) => setLeaveForm(prev => ({ ...prev, userName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="김철수"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                휴가 날짜
              </label>
              <input
                type="date"
                value={leaveForm.leaveDate}
                onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                휴가 유형
              </label>
              <select
                value={leaveForm.leaveType}
                onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveType: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="연차">연차</option>
                <option value="반차">반차</option>
                <option value="오전 반차">오전 반차</option>
                <option value="오후 반차">오후 반차</option>
                <option value="시간차">시간차</option>
                <option value="병가">병가</option>
                <option value="경조사">경조사</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시간 (시간)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="8"
                value={leaveForm.hours}
                onChange={(e) => setLeaveForm(prev => ({ ...prev, hours: parseFloat(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              휴가 추가
            </button>
          </form>
        </div>

        {/* 공휴일 전체 적용 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Calendar className="h-5 w-5 text-green-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">공휴일 전체 적용</h3>
          </div>

          <form onSubmit={handleAddHoliday} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                공휴일 날짜
              </label>
              <input
                type="date"
                value={holidayForm.holidayDate}
                onChange={(e) => setHolidayForm(prev => ({ ...prev, holidayDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                공휴일 이름
              </label>
              <input
                type="text"
                value={holidayForm.holidayName}
                onChange={(e) => setHolidayForm(prev => ({ ...prev, holidayName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="광복절"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
            >
              <Users className="h-4 w-4 mr-2" />
              전체 직원 적용
            </button>
          </form>

          {/* 네이버 공휴일 자동 동기화 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleSyncNaverHolidays}
              disabled={loading}
              className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center"
            >
              <Download className="h-4 w-4 mr-2" />
              이번 달 네이버 공휴일 자동 동기화
            </button>
          </div>
        </div>
      </div>

      {/* 실행 결과 */}
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">실행 결과</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`flex items-center p-3 rounded-lg ${
                  result.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                )}
                <span className={`text-sm ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {result.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 사용법 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">📋 사용법</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>개별 휴가 추가</strong>: 특정 직원의 휴가를 일별 근무시간 테이블에 직접 추가</li>
          <li>• <strong>공휴일 전체 적용</strong>: 모든 직원에게 공휴일을 8시간 유급휴가로 적용</li>
          <li>• <strong>네이버 공휴일 동기화</strong>: 네이버 API에서 이번 달 공휴일을 자동으로 가져와서 적용</li>
          <li>• 기존 출퇴근 기록이 있는 날짜는 자동으로 스킵됩니다</li>
        </ul>
      </div>
    </div>
  )
}