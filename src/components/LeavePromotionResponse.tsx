'use client'

import { useState } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { differenceInDays, format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useSupabase } from '@/components/SupabaseProvider'

interface PromotionRecord {
  id: string
  user_id: string
  promotion_year: number
  promotion_stage: '1st' | '2nd' | 'additional'
  remaining_days: number
  notice_sent_at: string
  response_deadline: string
  employee_response_at?: string
  requested_dates?: any[]
  company_designated_at?: string
  designated_dates?: any[]
  status: 'pending' | 'responded' | 'designated' | 'expired'
  is_compensation_exempt: boolean
}

interface LeavePromotionResponseProps {
  promotion: PromotionRecord
  onSubmit: () => void
}

export default function LeavePromotionResponse({ promotion, onSubmit }: LeavePromotionResponseProps) {
  const { supabase } = useSupabase()
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  
  if (promotion.status !== 'pending') {
    return null
  }
  
  const daysUntilDeadline = differenceInDays(new Date(promotion.response_deadline), new Date())
  const isOverdue = daysUntilDeadline < 0
  
  const handleDateSelect = (date: string) => {
    if (selectedDates.includes(date)) {
      setSelectedDates(selectedDates.filter(d => d !== date))
    } else if (selectedDates.length < promotion.remaining_days) {
      setSelectedDates([...selectedDates, date])
    }
  }
  
  const handleSubmit = async () => {
    if (selectedDates.length === 0) {
      alert('연차 사용일을 선택해주세요.')
      return
    }
    
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('leave_promotion_records')
        .update({
          employee_response_at: new Date().toISOString(),
          requested_dates: selectedDates.map(date => ({ date, type: 'annual' })),
          status: 'responded'
        })
        .eq('id', promotion.id)
      
      if (error) throw error
      
      alert('연차 사용일이 제출되었습니다.')
      onSubmit()
    } catch (error) {
      console.error('Error submitting promotion response:', error)
      alert('제출 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <div className={`${isOverdue ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300'} border-2 rounded-lg p-6 mb-4`}>
      <div className="flex items-start">
        <ExclamationTriangleIcon className={`h-6 w-6 ${isOverdue ? 'text-red-600' : 'text-yellow-600'} mt-1`} />
        <div className="ml-3 flex-1">
          <h3 className={`text-lg font-semibold ${isOverdue ? 'text-red-900' : 'text-yellow-900'}`}>
            연차 사용 촉진 통보 ({promotion.promotion_stage === '1st' ? '1차' : '2차'})
          </h3>
          
          <div className={`mt-2 text-sm ${isOverdue ? 'text-red-700' : 'text-yellow-700'}`}>
            <p>잔여 연차: <span className="font-bold">{promotion.remaining_days}일</span></p>
            {isOverdue ? (
              <p className="text-red-800 font-bold">⚠️ 응답 기한이 지났습니다!</p>
            ) : (
              <p>응답 기한: <span className="font-bold">{daysUntilDeadline}일 남음</span> ({format(new Date(promotion.response_deadline), 'yyyy년 MM월 dd일', { locale: ko })})</p>
            )}
          </div>
          
          {promotion.promotion_stage === '2nd' && promotion.designated_dates ? (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">회사 지정 연차 사용일</h4>
              <div className="bg-white rounded p-3">
                {promotion.designated_dates.map((date: any, idx: number) => (
                  <div key={idx} className="text-sm text-gray-700">
                    {format(new Date(date.date), 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-red-600">
                ※ 지정된 날짜에 연차를 사용하지 않을 경우, 미사용 연차에 대한 보상 의무가 소멸됩니다.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  연차 사용 희망일 선택 ({selectedDates.length}/{promotion.remaining_days}일)
                </label>
                
                <div className="bg-white rounded p-3 border border-gray-200">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="w-full text-left px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    {selectedDates.length > 0 
                      ? `${selectedDates.length}일 선택됨`
                      : '날짜 선택하기'}
                  </button>
                  
                  {showDatePicker && (
                    <div className="mt-2 p-2 border border-gray-200 rounded max-h-60 overflow-y-auto">
                      {/* 간단한 날짜 선택 UI - 실제로는 더 나은 Date Picker 컴포넌트 사용 권장 */}
                      <div className="grid grid-cols-7 gap-1 text-xs">
                        {Array.from({ length: 31 }, (_, i) => {
                          const date = new Date()
                          date.setDate(date.getDate() + i)
                          const dateStr = format(date, 'yyyy-MM-dd')
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6
                          const isSelected = selectedDates.includes(dateStr)
                          
                          return (
                            <button
                              key={i}
                              onClick={() => handleDateSelect(dateStr)}
                              disabled={isWeekend}
                              className={`
                                p-2 rounded text-center
                                ${isWeekend ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                                ${isSelected ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}
                              `}
                            >
                              {date.getDate()}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  
                  {selectedDates.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {selectedDates.map((date, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 px-2 py-1 rounded">
                          <span>{format(new Date(date), 'MM/dd (EEE)', { locale: ko })}</span>
                          <button
                            onClick={() => handleDateSelect(date)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || selectedDates.length === 0}
                  className={`px-4 py-2 rounded font-medium ${
                    submitting || selectedDates.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {submitting ? '제출 중...' : '사용일 제출'}
                </button>
                <button
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  나중에 응답
                </button>
              </div>
            </>
          )}
          
          <div className={`mt-4 p-3 ${isOverdue ? 'bg-red-100' : 'bg-yellow-100'} rounded text-xs ${isOverdue ? 'text-red-800' : 'text-yellow-800'}`}>
            <p>⚠️ 기한 내 미응답 시 회사가 연차 사용일을 지정합니다.</p>
            <p>⚠️ 2차 촉진 후에도 미사용 시 보상 의무가 소멸됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  )
}