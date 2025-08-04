'use client'

import { useState } from 'react'
import { getLeaveStatus, LEAVE_TYPE_NAMES } from '@/lib/hoursToLeaveDay'
import { supabase } from '@/lib/supabase'

interface Employee {
  id: string
  name: string
  department: string
  position: string
}

interface HourlyLeaveGrantModalProps {
  employee: Employee
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function HourlyLeaveGrantModal({ 
  employee, 
  isOpen, 
  onClose, 
  onSuccess 
}: HourlyLeaveGrantModalProps) {
  const [leaveType, setLeaveType] = useState<'substitute' | 'compensatory'>('substitute')
  const [hours, setHours] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const leaveStatus = getLeaveStatus(hours)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (hours <= 0) {
      setError('시간은 0보다 커야 합니다.')
      return
    }

    if (!reason.trim()) {
      setError('지급 사유를 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      // Supabase로 직접 시간 단위 휴가 부여
      const fieldName = leaveType === 'substitute' ? 'substitute_leave_hours' : 'compensatory_leave_hours';
      
      const { data: currentData } = await supabase
        .from('users')
        .select(fieldName)
        .eq('id', employee.id)
        .single();

      const currentHours = (currentData as any)?.[fieldName] || 0;
      const newHours = currentHours + hours;

      const { error } = await supabase
        .from('users')
        .update({ [fieldName]: newHours })
        .eq('id', employee.id);

      if (error) {
        console.error('Supabase hourly leave grant error:', error);
        throw new Error('시간 단위 휴가 부여에 실패했습니다.');
      }

      // 성공 처리
      const leaveTypeName = LEAVE_TYPE_NAMES[leaveType]
      alert(`✅ ${employee.name}님에게 ${leaveTypeName} ${hours}시간(${leaveStatus.days}일)이 지급되었습니다.`)
      onSuccess()
      handleClose()
    } catch (err) {
      console.error('시간 단위 휴가 지급 오류:', err)
      setError('지급 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setLeaveType('substitute')
    setHours(0)
    setReason('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              시간 단위 휴가 지급
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>대상 직원:</strong> {employee.name} ({employee.department} {employee.position})
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 휴가 종류 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                휴가 종류
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="leaveType"
                    value="substitute"
                    checked={leaveType === 'substitute'}
                    onChange={(e) => setLeaveType(e.target.value as 'substitute')}
                    className="mr-2"
                  />
                  <span className="text-sm">{LEAVE_TYPE_NAMES.substitute}</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="leaveType"
                    value="compensatory"
                    checked={leaveType === 'compensatory'}
                    onChange={(e) => setLeaveType(e.target.value as 'compensatory')}
                    className="mr-2"
                  />
                  <span className="text-sm">{LEAVE_TYPE_NAMES.compensatory}</span>
                </label>
              </div>
            </div>

            {/* 시간 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                지급할 시간
              </label>
              <input
                type="number"
                min="1"
                max="24"
                step="1"
                value={hours || ''}
                onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                placeholder="시간을 입력하세요"
                required
              />
              {hours > 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  = <strong>{leaveStatus.displayText}</strong>
                  {leaveStatus.needsAlert && (
                    <span className="ml-2 text-red-600">⚠️ 대체휴가 사용 권고</span>
                  )}
                </p>
              )}
            </div>

            {/* 지급 사유 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                지급 사유
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                placeholder="예: 주말 초과근무, 공휴일 출근 등"
                required
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-purple-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '지급 중...' : '지급하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}