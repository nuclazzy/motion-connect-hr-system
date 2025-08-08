'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createCalendarEventFromServer } from '@/lib/googleCalendarClient'
import { CALENDAR_IDS } from '@/lib/calendarMapping'

interface SpecialLeaveGrantModalProps {
  isOpen: boolean
  onClose: () => void
  employee?: {
    id: string
    name: string
    department: string
    position: string
  } | null
  onSuccess?: () => void
}

export default function SpecialLeaveGrantModal({ 
  isOpen, 
  onClose, 
  employee,
  onSuccess 
}: SpecialLeaveGrantModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    employeeId: employee?.id || '',
    employeeName: employee?.name || '',
    leaveTitle: '', // 예: "본인 결혼 특별휴가", "가족 경조사 휴가"
    startDate: '',
    endDate: '',
    leaveDays: 1,
    reason: ''
  })

  // 직원 검색 (이름으로)
  const [searchResults, setSearchResults] = useState<typeof employee[]>([])
  const [searching, setSearching] = useState(false)

  const searchEmployee = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, department, position')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .eq('role', 'user')
        .limit(5)

      if (!error && data) {
        setSearchResults(data)
      }
    } catch (error) {
      console.error('직원 검색 오류:', error)
    } finally {
      setSearching(false)
    }
  }

  const calculateLeaveDays = () => {
    if (!formData.startDate || !formData.endDate) return 1
    
    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    
    setFormData(prev => ({ ...prev, leaveDays: diffDays }))
  }

  const handleSubmit = async () => {
    if (!formData.employeeId || !formData.leaveTitle || !formData.startDate) {
      alert('필수 정보를 모두 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      // 1. Google Calendar에 이벤트 생성 (Service Account)
      const eventData = {
        summary: `${formData.employeeName} - ${formData.leaveTitle}`,
        description: formData.reason || `관리자가 부여한 특별휴가\n휴가일수: ${formData.leaveDays}일`,
        start: formData.endDate ? {
          date: formData.startDate
        } : {
          dateTime: `${formData.startDate}T09:00:00`,
          timeZone: 'Asia/Seoul'
        },
        end: formData.endDate ? {
          date: new Date(new Date(formData.endDate).getTime() + 86400000).toISOString().split('T')[0] // 종료일 +1
        } : {
          dateTime: `${formData.startDate}T18:00:00`,
          timeZone: 'Asia/Seoul'
        }
      }

      const createdEvent = await createCalendarEventFromServer(CALENDAR_IDS.LEAVE_MANAGEMENT, eventData)
      
      if (createdEvent?.id) {
        // 2. 특별휴가 기록 저장 (테이블이 있는 경우만)
        try {
          await supabase
            .from('special_leave_records')
            .insert({
              user_id: formData.employeeId,
              leave_title: formData.leaveTitle,
              start_date: formData.startDate,
              end_date: formData.endDate || formData.startDate,
              leave_days: formData.leaveDays,
              reason: formData.reason,
              granted_by: 'admin', // 실제로는 현재 관리자 ID
              calendar_event_id: createdEvent.id
            })
        } catch (dbError) {
          console.log('특별휴가 기록 저장 오류 (테이블이 없을 수 있음):', dbError)
          // 테이블이 없어도 캘린더 이벤트는 생성되었으므로 계속 진행
        }

        alert(`✅ ${formData.employeeName}님에게 "${formData.leaveTitle}" ${formData.leaveDays}일을 부여했습니다.`)
        
        // 초기화
        setFormData({
          employeeId: '',
          employeeName: '',
          leaveTitle: '',
          startDate: '',
          endDate: '',
          leaveDays: 1,
          reason: ''
        })
        setSearchResults([])
        
        onSuccess?.()
        onClose()
      }
    } catch (error) {
      console.error('특별휴가 부여 오류:', error)
      alert('특별휴가 부여 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">특별휴가 부여</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* 직원 선택/검색 */}
            {!employee && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  직원 검색
                </label>
                <input
                  type="text"
                  placeholder="이름 또는 이메일로 검색"
                  value={formData.employeeName}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, employeeName: e.target.value }))
                    searchEmployee(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
                {searching && (
                  <div className="text-sm text-gray-500 mt-1">검색 중...</div>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                    {searchResults.map((emp) => (
                      <button
                        key={emp!.id}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            employeeId: emp!.id,
                            employeeName: emp!.name
                          }))
                          setSearchResults([])
                        }}
                        className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                      >
                        {emp!.name} ({emp!.department} {emp!.position})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 선택된 직원 표시 */}
            {(employee || formData.employeeId) && (
              <div className="bg-blue-50 p-3 rounded-md">
                <div className="text-sm text-blue-800">
                  <span className="font-medium">선택된 직원:</span> {formData.employeeName}
                  {employee && ` (${employee.department} ${employee.position})`}
                </div>
              </div>
            )}

            {/* 휴가 제목 (자유 입력) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                휴가 종류 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 본인 결혼 특별휴가, 가족 경조사 휴가, 리프레시 휴가"
                value={formData.leaveTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, leaveTitle: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                자유롭게 휴가 종류를 입력하세요
              </p>
            </div>

            {/* 시작일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, startDate: e.target.value }))
                  calculateLeaveDays()
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* 종료일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일 (선택)
              </label>
              <input
                type="date"
                value={formData.endDate}
                min={formData.startDate}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, endDate: e.target.value }))
                  calculateLeaveDays()
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                비워두면 당일 휴가로 처리됩니다
              </p>
            </div>

            {/* 휴가 일수 표시 */}
            {formData.startDate && (
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm text-gray-700">
                  휴가 일수: <span className="font-bold text-indigo-600">{formData.leaveDays}일</span>
                </div>
              </div>
            )}

            {/* 사유 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                부여 사유 (선택)
              </label>
              <textarea
                rows={2}
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="특별휴가 부여 사유를 입력하세요"
              />
            </div>

            {/* 안내 메시지 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-xs text-yellow-800">
                💡 이 휴가는 연차와 별개로 부여되며, 휴가 일수에서 차감되지 않습니다.
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !formData.employeeId || !formData.leaveTitle || !formData.startDate}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white
                  ${loading || !formData.employeeId || !formData.leaveTitle || !formData.startDate
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
              >
                {loading ? '처리 중...' : '휴가 부여'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}