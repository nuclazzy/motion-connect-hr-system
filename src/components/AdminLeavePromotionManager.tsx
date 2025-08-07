'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/SupabaseProvider'
import { format, addDays, differenceInDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ExclamationTriangleIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface PromotionTarget {
  id: string
  name: string
  email: string
  department: string
  hire_date: string
  annual_days: number
  used_annual_days: number
  remaining_days: number
  needs_promotion: boolean
  years_of_service: number
}

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

export default function AdminLeavePromotionManager() {
  const { supabase } = useSupabase()
  const [targets, setTargets] = useState<PromotionTarget[]>([])
  const [promotionRecords, setPromotionRecords] = useState<PromotionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [sending, setSending] = useState(false)

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true)
      
      // 연차 촉진 대상자 조회
      const { data: targetsData, error: targetsError } = await supabase
        .from('leave_promotion_targets')
        .select('*')
        .order('remaining_days', { ascending: false })
      
      if (targetsError) {
        console.error('Error loading promotion targets:', targetsError)
        return
      }
      
      // 기존 촉진 기록 조회
      const currentYear = new Date().getFullYear()
      const { data: recordsData, error: recordsError } = await supabase
        .from('leave_promotion_records')
        .select('*')
        .eq('promotion_year', currentYear)
        .order('created_at', { ascending: false })
      
      if (recordsError) {
        console.error('Error loading promotion records:', recordsError)
        return
      }
      
      setTargets(targetsData || [])
      setPromotionRecords(recordsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 1차 촉진 통보 발송
  const sendFirstPromotion = async (userId: string) => {
    try {
      setSending(true)
      
      const target = targets.find(t => t.id === userId)
      if (!target) return
      
      const responseDeadline = addDays(new Date(), 10)
      
      const { error } = await supabase
        .from('leave_promotion_records')
        .insert({
          user_id: userId,
          promotion_year: new Date().getFullYear(),
          promotion_stage: '1st',
          remaining_days: target.remaining_days,
          notice_sent_at: new Date().toISOString(),
          response_deadline: format(responseDeadline, 'yyyy-MM-dd'),
          status: 'pending'
        })
      
      if (error) {
        console.error('Error creating promotion record:', error)
        alert('촉진 통보 생성 실패')
        return
      }
      
      // TODO: 이메일 발송 로직 연동
      
      alert(`${target.name}님에게 1차 연차 촉진 통보를 발송했습니다.`)
      await loadData()
    } catch (error) {
      console.error('Error sending promotion:', error)
      alert('촉진 통보 발송 실패')
    } finally {
      setSending(false)
    }
  }

  // 2차 촉진 (회사 지정)
  const sendSecondPromotion = async (firstPromotionId: string) => {
    try {
      setSending(true)
      
      const firstPromotion = promotionRecords.find(r => r.id === firstPromotionId)
      if (!firstPromotion) return
      
      // 자동으로 연차 사용일 지정 (남은 연차를 순차적으로 배치)
      const designatedDates: any[] = []
      const today = new Date()
      let currentDate = addDays(today, 14) // 2주 후부터 시작
      
      for (let i = 0; i < firstPromotion.remaining_days; i++) {
        // 주말 제외
        while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          currentDate = addDays(currentDate, 1)
        }
        
        designatedDates.push({
          date: format(currentDate, 'yyyy-MM-dd'),
          type: 'annual'
        })
        
        currentDate = addDays(currentDate, 1)
      }
      
      const { error } = await supabase
        .from('leave_promotion_records')
        .insert({
          user_id: firstPromotion.user_id,
          promotion_year: new Date().getFullYear(),
          promotion_stage: '2nd',
          remaining_days: firstPromotion.remaining_days,
          notice_sent_at: new Date().toISOString(),
          response_deadline: format(addDays(today, 3), 'yyyy-MM-dd'),
          company_designated_at: new Date().toISOString(),
          designated_dates: designatedDates,
          status: 'designated',
          is_compensation_exempt: true
        })
      
      if (error) {
        console.error('Error creating 2nd promotion:', error)
        alert('2차 촉진 생성 실패')
        return
      }
      
      // 1차 촉진 상태 업데이트
      await supabase
        .from('leave_promotion_records')
        .update({ status: 'expired' })
        .eq('id', firstPromotionId)
      
      alert('2차 연차 촉진(회사 지정)을 발송했습니다.')
      await loadData()
    } catch (error) {
      console.error('Error sending 2nd promotion:', error)
      alert('2차 촉진 발송 실패')
    } finally {
      setSending(false)
    }
  }

  // 촉진 기록 상태에 따른 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'responded': return 'text-green-600 bg-green-100'
      case 'designated': return 'text-red-600 bg-red-100'
      case 'expired': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '응답 대기'
      case 'responded': return '직원 응답'
      case 'designated': return '회사 지정'
      case 'expired': return '만료'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">연차 사용 촉진 관리</h2>
        <p className="text-sm text-gray-600">
          연차 잔여일이 많은 직원들에게 연차 사용 촉진 통보를 발송할 수 있습니다.
        </p>
      </div>

      {/* 촉진 대상자 목록 */}
      <div className="space-y-4">
        {targets.map(target => {
          const userPromotions = promotionRecords.filter(r => r.user_id === target.id)
          const hasFirstPromotion = userPromotions.some(r => r.promotion_stage === '1st')
          const hasSecondPromotion = userPromotions.some(r => r.promotion_stage === '2nd')
          const pendingFirstPromotion = userPromotions.find(r => r.promotion_stage === '1st' && r.status === 'pending')
          
          return (
            <div key={target.id} className="border border-gray-200 rounded-lg p-4">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedUser(expandedUser === target.id ? null : target.id)}
              >
                <div className="flex items-center space-x-4">
                  {expandedUser === target.id ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  )}
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900">{target.name}</h3>
                      <span className="text-sm text-gray-500">({target.department})</span>
                      {target.needs_promotion && (
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      잔여 연차: <strong>{target.remaining_days}일</strong> / 
                      총 {target.annual_days}일 중 {target.used_annual_days}일 사용
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {!hasFirstPromotion && target.needs_promotion && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        sendFirstPromotion(target.id)
                      }}
                      disabled={sending}
                      className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                    >
                      1차 촉진
                    </button>
                  )}
                  
                  {pendingFirstPromotion && differenceInDays(new Date(pendingFirstPromotion.response_deadline), new Date()) < 0 && !hasSecondPromotion && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        sendSecondPromotion(pendingFirstPromotion.id)
                      }}
                      disabled={sending}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      2차 촉진
                    </button>
                  )}
                </div>
              </div>
              
              {/* 촉진 이력 */}
              {expandedUser === target.id && userPromotions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">촉진 이력</h4>
                  {userPromotions.map(promotion => (
                    <div key={promotion.id} className="bg-gray-50 rounded p-3 text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          {promotion.promotion_stage === '1st' ? '1차 촉진' : '2차 촉진'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(promotion.status)}`}>
                          {getStatusText(promotion.status)}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-gray-600">
                        <p>통보일: {format(new Date(promotion.notice_sent_at), 'yyyy년 MM월 dd일', { locale: ko })}</p>
                        <p>응답 기한: {format(new Date(promotion.response_deadline), 'yyyy년 MM월 dd일', { locale: ko })}</p>
                        
                        {promotion.employee_response_at && (
                          <p>직원 응답: {format(new Date(promotion.employee_response_at), 'yyyy년 MM월 dd일', { locale: ko })}</p>
                        )}
                        
                        {promotion.requested_dates && promotion.requested_dates.length > 0 && (
                          <div>
                            <p className="font-medium">신청 날짜:</p>
                            <div className="ml-2">
                              {promotion.requested_dates.map((date: any, idx: number) => (
                                <span key={idx} className="inline-block mr-2">
                                  {format(new Date(date.date), 'MM/dd', { locale: ko })}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {promotion.designated_dates && promotion.designated_dates.length > 0 && (
                          <div>
                            <p className="font-medium text-red-600">회사 지정 날짜:</p>
                            <div className="ml-2">
                              {promotion.designated_dates.map((date: any, idx: number) => (
                                <span key={idx} className="inline-block mr-2 text-red-600">
                                  {format(new Date(date.date), 'MM/dd', { locale: ko })}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {promotion.is_compensation_exempt && (
                          <p className="text-red-600 font-medium">⚠️ 보상 의무 소멸</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {targets.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          현재 연차 촉진 대상자가 없습니다.
        </div>
      )}
    </div>
  )
}