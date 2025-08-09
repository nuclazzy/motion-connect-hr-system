'use client'

import { useState, useEffect, useCallback } from 'react'
import { type User, authenticatedFetch } from '@/lib/auth'
import { getLeaveStatus, LEAVE_TYPE_NAMES } from '@/lib/hoursToLeaveDay'
import { supabase } from '@/lib/supabase'
import { getMonthHolidayInfo, getCalendarCellStyle, getDayLabelStyle, type HolidayInfo } from '@/lib/holiday-calendar-utils'

interface LeaveData {
  id: string
  name: string
  department: string
  position: string
  hire_date?: string
  annual_days: number
  used_annual_days: number
  sick_days: number
  used_sick_days: number
  substitute_leave_hours: number
  compensatory_leave_hours: number
  updated_at: string
}

interface UserLeaveStatusProps {
  user: User
  onApply: (formType: string, defaultValues?: Record<string, string>) => void
}

export default function UserLeaveStatus({ user, onApply }: UserLeaveStatusProps) {
  const [leaveData, setLeaveData] = useState<LeaveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [holidayMap, setHolidayMap] = useState<Map<string, HolidayInfo>>(new Map())
  const [holidaysLoading, setHolidaysLoading] = useState(false)
  const [currentDate] = useState(new Date())

  const fetchLeaveData = useCallback(async () => {
      try {
        setLoading(true)
        console.log('휴가 데이터 조회 시작 (users 테이블 직접):', { userId: user.id, userName: user.name })
        
        // users 테이블에서 직접 모든 데이터 조회
        const { data, error } = await supabase
          .from('users')
          .select(`
            id, name, department, position, hire_date,
            annual_days, used_annual_days,
            sick_days, used_sick_days,
            substitute_leave_hours, compensatory_leave_hours,
            updated_at
          `)
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Supabase 사용자 데이터 조회 오류:', error)
          setError('휴가 데이터를 불러올 수 없습니다.')
          return
        }

        console.log('✅ 휴가 데이터 조회 성공 (users 테이블):', data)
        
        setLeaveData(data)
        
      } catch (err) {
        console.error('휴가 데이터 조회 오류:', err)
        setError('휴가 데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
  }, [user.id, user.name])

  useEffect(() => {
    fetchLeaveData()
    
    // 폼 제출 성공 이벤트 리스너 추가
    const handleFormSubmitSuccess = () => {
      fetchLeaveData()
    }
    
    window.addEventListener('formSubmitSuccess', handleFormSubmitSuccess)
    
    return () => {
      window.removeEventListener('formSubmitSuccess', handleFormSubmitSuccess)
    }
  }, [user.id, user.name, fetchLeaveData])

  // 공휴일 정보 로드
  useEffect(() => {
    const loadHolidays = async () => {
      setHolidaysLoading(true)
      try {
        const holidays = await getMonthHolidayInfo(
          currentDate.getFullYear(), 
          currentDate.getMonth() + 1
        )
        setHolidayMap(holidays)
      } catch (error) {
        console.error('공휴일 정보 로드 실패:', error)
      } finally {
        setHolidaysLoading(false)
      }
    }
    
    loadHolidays()
  }, [currentDate])

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  휴가 현황
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  불러오는 중...
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !leaveData) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-red-500 truncate">
                  휴가 현황
                </dt>
                <dd className="text-sm text-red-700">
                  {error}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const annualRemaining = (leaveData.annual_days || 0) - (leaveData.used_annual_days || 0)
  const sickRemaining = (leaveData.sick_days || 0) - (leaveData.used_sick_days || 0)
  
  // 시간 단위 휴가 상태 계산 (users 테이블 컬럼에서 직접 조회)
  const substituteHours = leaveData.substitute_leave_hours ?? 0
  const compensatoryHours = leaveData.compensatory_leave_hours ?? 0
  
  console.log('🔍 직원 대시보드 휴가 시간 확인 (users 테이블):', {
    userId: user.id,
    userName: user.name,
    substituteHours,
    compensatoryHours,
    annualRemaining,
    sickRemaining
  })
  const substituteStatus = getLeaveStatus(substituteHours)
  const compensatoryStatus = getLeaveStatus(compensatoryHours)
  
  // 미니 캘린더 렌더링
  const renderMiniCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    const days = []

    // 빈 셀들
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-1"></div>)
    }

    // 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const holidayInfo = holidayMap.get(dateString) || {
        date: dateString,
        name: '',
        isHoliday: false,
        isWeekend: new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6,
        dayType: 'weekday' as const
      }
      
      const isToday = today.getFullYear() === year && 
                     today.getMonth() === month && 
                     today.getDate() === day

      const dayStyle = holidayInfo.isHoliday ? 'text-red-600 font-bold' : 
                      holidayInfo.isWeekend ? 'text-gray-400' : 
                      'text-gray-700'
      
      const bgStyle = isToday ? 'bg-blue-100 ring-1 ring-blue-400' :
                     holidayInfo.isHoliday ? 'bg-red-50' :
                     holidayInfo.isWeekend ? 'bg-gray-50' : ''

      days.push(
        <div 
          key={day} 
          className={`p-1 text-center text-xs ${bgStyle} rounded-sm relative group cursor-default`}
          title={holidayInfo.isHoliday ? holidayInfo.name : ''}
        >
          <span className={dayStyle}>{day}</span>
          {holidayInfo.isHoliday && (
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"></div>
          )}
        </div>
      )
    }

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 text-xs text-center mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((dayName, idx) => (
            <div key={dayName} className={`font-medium ${
              idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}>
              {dayName}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                나의 휴가 현황
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {user.name}님의 휴가 정보
              </dd>
            </dl>
          </div>
        </div>
        
        <div className="mt-5">
          <div className="grid grid-cols-1 gap-4">
            {/* 연차 현황 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-900">연차</h4>
                  <div className="mt-1">
                    <p className="text-lg font-semibold text-blue-900">
                      {leaveData.used_annual_days || 0}/{leaveData.annual_days || 0}일 사용
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(annualRemaining * 10) / 10}
                  </div>
                  <div className="text-xs text-blue-500">잔여 일수</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200 flex justify-end">
                <button
                  onClick={() => onApply('휴가 신청서', { '휴가형태': '연차' })}
                  className="bg-white text-blue-600 px-4 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-blue-100 transition-colors"
                >
                  연차 신청
                </button>
              </div>
            </div>

            {/* 병가 현황 */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">병가</h4>
                  <div className="mt-1">
                    <p className="text-lg font-semibold text-yellow-900">
                      {leaveData.used_sick_days || 0}/{leaveData.sick_days || 0}일 사용
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-600">
                    {Math.round(sickRemaining * 10) / 10}
                  </div>
                  <div className="text-xs text-yellow-500">잔여 일수</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-yellow-200 flex justify-end">
                <button
                  onClick={() => onApply('휴가 신청서', { '휴가형태': '병가' })}
                  className="bg-white text-yellow-600 px-4 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-yellow-100 transition-colors"
                >
                  병가 신청
                </button>
              </div>
            </div>

            {/* 대체휴가 현황 - 시간이 있을 때만 표시 */}
            {substituteHours > 0 && (
              <div className={`rounded-lg p-4 ${substituteStatus.needsAlert ? 'bg-red-50 border-2 border-red-200' : 'bg-purple-50'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={`text-sm font-medium ${substituteStatus.needsAlert ? 'text-red-900' : 'text-purple-900'}`}>
                      {LEAVE_TYPE_NAMES.substitute}
                      {substituteStatus.needsAlert && (
                        <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full animate-pulse">
                          사용 권고
                        </span>
                      )}
                    </h4>
                    <div className="mt-1">
                      <p className={`text-lg font-semibold ${substituteStatus.needsAlert ? 'text-red-900' : 'text-purple-900'}`}>
                        {substituteStatus.displayText}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${substituteStatus.needsAlert ? 'text-red-600' : 'text-purple-600'}`}>
                      {substituteStatus.days}
                    </div>
                    <div className={`text-xs ${substituteStatus.needsAlert ? 'text-red-500' : 'text-purple-500'}`}>잔여 일수</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-purple-200 flex justify-end">
                  <button
                    onClick={() => onApply('휴가 신청서', { '_leaveCategory': 'substitute' })}
                    className="bg-white text-purple-600 px-4 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-purple-100 transition-colors"
                  >
                    대체휴가 신청
                  </button>
                </div>
              </div>
            )}

            {/* 보상휴가 현황 - 시간이 있을 때만 표시 */}
            {compensatoryHours > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-green-900">{LEAVE_TYPE_NAMES.compensatory}</h4>
                    <div className="mt-1">
                      <p className="text-lg font-semibold text-green-900">
                        {compensatoryStatus.displayText}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {compensatoryStatus.days}
                    </div>
                    <div className="text-xs text-green-500">잔여 일수</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-200 flex justify-end">
                  <button
                    onClick={() => onApply('휴가 신청서', { '_leaveCategory': 'compensatory' })}
                    className="bg-white text-green-600 px-4 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-green-100 transition-colors"
                  >
                    보상휴가 신청
                  </button>
                </div>
              </div>
            )}
          </div>


          {/* 기타 휴가 신청 (기존 OtherLeaveWidget 통합) */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-base font-semibold leading-6 text-gray-900 text-center mb-3">기타 휴가/휴직 신청</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => onApply('휴가 신청서', { '휴가형태': '경조사' })}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium text-center"
              >경조사</button>
              <button
                onClick={() => onApply('휴가 신청서', { '휴가형태': '공가' })}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium text-center"
              >공가</button>
              <button
                onClick={() => onApply('출산휴가 및 육아휴직 신청서')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium text-center"
              >육아휴직</button>
              <button
                onClick={() => onApply('휴가 신청서', { '휴가형태': '기타' })}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium text-center"
              >기타 휴가</button>
            </div>
          </div>

          {/* 이번 달 캘린더 (공휴일 포함) */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-base font-semibold leading-6 text-gray-900 mb-3">
              <span className="flex items-center">
                <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </span>
            </h4>
            <div className="bg-gray-50 rounded-lg p-3">
              {renderMiniCalendar()}
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-50 border border-red-200 rounded-sm mr-1"></div>
                  <span className="text-gray-600">공휴일</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded-sm mr-1"></div>
                  <span className="text-gray-600">오늘</span>
                </div>
              </div>
            </div>
          </div>

          {/* 업데이트 일시 */}
          <div className="mt-3 text-xs text-gray-400 text-right">
            최종 업데이트: {new Date(leaveData.updated_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
    </div>
  )
}