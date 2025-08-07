'use client'

import { useState, useEffect } from 'react'
import { Clock, Calculator, AlertTriangle } from 'lucide-react'
import { calculateWorkTimeAsync, type WorkTimeCalculation } from '@/lib/flexible-work-utils'

interface WorkTimePreviewProps {
  checkInTime?: string  // HH:MM 형식
  checkOutTime?: string // HH:MM 형식
  workDate: string     // YYYY-MM-DD 형식
  className?: string
}

/**
 * 실시간 근무시간 미리보기 컴포넌트
 * WorkPolicyManagement에서 설정한 값들을 실시간으로 반영하여 계산
 */
export default function WorkTimePreview({ 
  checkInTime, 
  checkOutTime, 
  workDate, 
  className = '' 
}: WorkTimePreviewProps) {
  const [calculation, setCalculation] = useState<WorkTimeCalculation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 입력값 변경 시 실시간 계산
  useEffect(() => {
    if (!checkInTime || !checkOutTime) {
      setCalculation(null)
      return
    }

    const calculatePreview = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const result = await calculateWorkTimeAsync(
          checkInTime,
          checkOutTime, 
          workDate,
          60 // 점심시간 1시간
        )
        setCalculation(result)
      } catch (err) {
        console.error('근무시간 미리보기 계산 오류:', err)
        setError('계산 중 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }

    // 디바운스 적용 (500ms 후 계산)
    const timeoutId = setTimeout(calculatePreview, 500)
    return () => clearTimeout(timeoutId)
  }, [checkInTime, checkOutTime, workDate])

  if (!checkInTime || !checkOutTime) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-gray-500">
          <Clock className="h-4 w-4" />
          <span className="text-sm">출퇴근 시간을 입력하면 미리보기가 표시됩니다</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`bg-blue-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-blue-600">
          <Calculator className="h-4 w-4 animate-spin" />
          <span className="text-sm">근무시간 계산 중...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-red-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    )
  }

  if (!calculation) {
    return null
  }

  const formatHours = (hours: number) => {
    return hours > 0 ? `${hours.toFixed(1)}시간` : '-'
  }

  const getWorkTypeDisplay = (workType: string) => {
    switch (workType) {
      case 'saturday': return '토요일 근무'
      case 'sunday_or_holiday': return '일요일/공휴일 근무'
      case 'weekday': return '평일 근무'
      default: return '일반 근무'
    }
  }

  const getOvertimeThresholdText = (threshold: number) => {
    return threshold === 12 ? '탄력근무제 적용 (12시간 기준)' : `일반 근무 (${threshold}시간 기준)`
  }

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="h-4 w-4 text-blue-600" />
            <h3 className="font-medium text-gray-900">근무시간 미리보기</h3>
          </div>
          <div className="text-xs text-gray-500">
            {getWorkTypeDisplay(calculation.work_type)}
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          {getOvertimeThresholdText(calculation.overtime_threshold_used)}
        </p>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 기본 근무시간 */}
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatHours(calculation.basic_hours)}
            </div>
            <div className="text-xs text-gray-600">기본 근무</div>
          </div>

          {/* 초과 근무시간 */}
          <div className="text-center">
            <div className={`text-2xl font-bold ${calculation.overtime_hours > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {formatHours(calculation.overtime_hours)}
            </div>
            <div className="text-xs text-gray-600">초과 근무</div>
          </div>

          {/* 야간 근무시간 */}
          <div className="text-center">
            <div className={`text-2xl font-bold ${calculation.night_hours > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
              {formatHours(calculation.night_hours)}
            </div>
            <div className="text-xs text-gray-600">야간 근무</div>
          </div>

          {/* 총 근무시간 */}
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatHours(calculation.basic_hours + calculation.overtime_hours)}
            </div>
            <div className="text-xs text-gray-600">총 근무</div>
          </div>
        </div>

        {/* 휴가 정보 (토요일/일요일만) */}
        {(calculation.substitute_hours > 0 || calculation.compensatory_hours > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">휴가 적립</h4>
            <div className="grid grid-cols-2 gap-4">
              {calculation.substitute_hours > 0 && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-blue-600">
                    {formatHours(calculation.substitute_hours)}
                  </div>
                  <div className="text-xs text-blue-700">대체휴가 적립</div>
                  <div className="text-xs text-blue-600 mt-1">토요일 근무</div>
                </div>
              )}
              {calculation.compensatory_hours > 0 && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-green-600">
                    {formatHours(calculation.compensatory_hours)}
                  </div>
                  <div className="text-xs text-green-700">보상휴가 적립</div>
                  <div className="text-xs text-green-600 mt-1">일요일/공휴일 근무</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 추가 정보 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center space-x-4">
              <span>저녁식사 차감: {calculation.dinner_break_detected ? '1시간' : '없음'}</span>
              <span>점심시간: 1시간</span>
            </div>
            <span>실시간 DB 설정 적용</span>
          </div>
        </div>
      </div>
    </div>
  )
}