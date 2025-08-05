'use client'

import { useState } from 'react'
import { Utensils, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'

interface DinnerButtonProps {
  userId: string
  workDate: string
  checkInTime: string
  checkOutTime: string
  currentDinnerStatus?: string
  hadDinner?: boolean
  netWorkHours: number
  onDinnerAdded?: () => void
  className?: string
}

export default function DinnerButton({
  userId,
  workDate,
  checkInTime,
  checkOutTime,
  currentDinnerStatus = '',
  hadDinner = false,
  netWorkHours,
  onDinnerAdded,
  className = ''
}: DinnerButtonProps) {
  const { supabase } = useSupabase()
  const [isAdding, setIsAdding] = useState(false)
  const [addResult, setAddResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // 저녁식사 추가 가능 여부 확인
  const shouldShowButton = () => {
    if (currentDinnerStatus || hadDinner) return false
    if (netWorkHours < 8) return false
    
    try {
      const checkIn = new Date(`2000-01-01T${checkInTime}`)
      const checkOut = new Date(`2000-01-01T${checkOutTime}`)
      
      // 익일 퇴근 처리
      if (checkOut <= checkIn) {
        checkOut.setDate(checkOut.getDate() + 1)
      }
      
      const dinnerHour = new Date(`2000-01-01T19:00:00`)
      
      return checkIn <= dinnerHour && checkOut > dinnerHour
    } catch {
      return false
    }
  }

  const handleAddDinner = async () => {
    try {
      setIsAdding(true)
      setAddResult(null)

      // 권한 확인
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        setAddResult({
          success: false,
          message: '로그인이 필요합니다.'
        })
        return
      }

      // Supabase에서 저녁식사 기록 업데이트
      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .update({ 
          had_dinner: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('record_date', workDate)
        .eq('record_type', '퇴근')

      if (attendanceError) {
        throw new Error(`출퇴근 기록 업데이트 실패: ${attendanceError.message}`)
      }

      // daily_work_summary도 업데이트
      const { error: summaryError } = await supabase
        .from('daily_work_summary')
        .update({
          had_dinner: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('work_date', workDate)

      if (summaryError) {
        throw new Error(`일별 요약 업데이트 실패: ${summaryError.message}`)
      }

      setAddResult({
        success: true,
        message: '✅ 저녁식사 기록이 추가되었습니다.'
      })

      // 콜백 호출
      if (onDinnerAdded) {
        onDinnerAdded()
      }

    } catch (error) {
      console.error('저녁식사 추가 오류:', error)
      setAddResult({
        success: false,
        message: `❌ 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      })
    } finally {
      setIsAdding(false)
    }
  }

  if (!shouldShowButton()) {
    return null
  }

  if (addResult) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {addResult.success ? (
          <div className="flex items-center text-green-600 text-sm">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>저녁식사 기록됨</span>
          </div>
        ) : (
          <div className="flex items-center text-red-600 text-sm">
            <AlertCircle className="h-4 w-4 mr-1" />
            <span>추가 실패</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center text-orange-600 text-sm">
        <Clock className="h-4 w-4 mr-1" />
        <span>저녁식사 기록 누락</span>
      </div>
      <button
        onClick={handleAddDinner}
        disabled={isAdding}
        className="px-3 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm flex items-center"
      >
        <Utensils className="h-3 w-3 mr-1" />
        {isAdding ? '추가 중...' : '저녁식사 추가'}
      </button>
    </div>
  )
}

// 저녁식사 상태 표시 컴포넌트
export function DinnerStatus({
  hadDinner,
  dinnerStatus,
  className = ''
}: {
  hadDinner: boolean
  dinnerStatus?: string
  className?: string
}) {
  if (hadDinner || dinnerStatus === 'O') {
    return (
      <div className={`flex items-center text-green-600 text-sm ${className}`}>
        <Utensils className="h-4 w-4 mr-1" />
        <span>저녁식사</span>
      </div>
    )
  }

  return null
}

// 저녁식사 감지 결과 표시 컴포넌트
export function DinnerDetectionResult({
  checkInTime,
  checkOutTime,
  netWorkHours,
  currentDinnerStatus = '',
  hadDinner = false,
  className = ''
}: {
  checkInTime: string
  checkOutTime: string
  netWorkHours: number
  currentDinnerStatus?: string
  hadDinner?: boolean
  className?: string
}) {
  // 조건 확인
  const workHours8Plus = netWorkHours >= 8
  const noDinnerRecord = !currentDinnerStatus && !hadDinner
  
  let checkInBefore19 = false
  let checkOutAfter19 = false
  
  try {
    const checkIn = new Date(`2000-01-01T${checkInTime}`)
    const checkOut = new Date(`2000-01-01T${checkOutTime}`)
    
    if (checkOut <= checkIn) {
      checkOut.setDate(checkOut.getDate() + 1)
    }
    
    const dinnerHour = new Date(`2000-01-01T19:00:00`)
    checkInBefore19 = checkIn <= dinnerHour
    checkOutAfter19 = checkOut > dinnerHour
  } catch {
    // 시간 파싱 오류
  }

  const isDinnerMissing = workHours8Plus && checkInBefore19 && checkOutAfter19 && noDinnerRecord

  if (!isDinnerMissing) {
    let reason = ''
    if (!workHours8Plus) reason = `근무시간 부족 (${netWorkHours}h)`
    else if (!checkInBefore19) reason = '19시 이후 출근'
    else if (!checkOutAfter19) reason = '19시 이전 퇴근'
    else if (!noDinnerRecord) reason = '저녁식사 기록됨'

    return (
      <div className={`text-gray-500 text-xs ${className}`}>
        {reason}
      </div>
    )
  }

  return (
    <div className={`flex items-center text-orange-600 text-sm ${className}`}>
      <AlertCircle className="h-4 w-4 mr-1" />
      <span>저녁식사 기록 누락 ({netWorkHours}h 근무)</span>
    </div>
  )
}