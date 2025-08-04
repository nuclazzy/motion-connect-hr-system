'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface GrantSpecialLeaveModalProps {
  employee: {
    id: string
    name: string
    department: string
    position: string
  }
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function GrantSpecialLeaveModal({ employee, isOpen, onClose, onSuccess }: GrantSpecialLeaveModalProps) {
  const [formData, setFormData] = useState({
    leaveType: '',
    days: '',
    reason: '',
    validUntil: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const leaveTypes = [
    { value: 'compensatory', label: '보상휴가' },
    { value: 'substitute', label: '대체휴가' },
    { value: 'special', label: '특별휴가' },
    { value: 'reward', label: '포상휴가' },
    { value: 'other', label: '기타' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.leaveType || !formData.days || !formData.reason) {
      setError('모든 필수 항목을 입력해주세요.')
      return
    }

    const days = parseFloat(formData.days)
    if (days <= 0 || days > 30) {
      setError('휴가 일수는 0일 초과 30일 이하로 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      // Supabase로 직접 휴가 부여
      let updateData: any = {};
      
      if (formData.leaveType === 'compensatory') {
        // 보상휴가는 시간 단위
        const { data: currentData } = await supabase
          .from('users')
          .select('compensatory_leave_hours')
          .eq('id', employee.id)
          .single();
        
        const currentHours = currentData?.compensatory_leave_hours || 0;
        updateData.compensatory_leave_hours = currentHours + (days * 8); // 일 단위를 시간으로 변환
      } else if (formData.leaveType === 'substitute') {
        // 대체휴가는 시간 단위
        const { data: currentData } = await supabase
          .from('users')
          .select('substitute_leave_hours')
          .eq('id', employee.id)
          .single();
        
        const currentHours = currentData?.substitute_leave_hours || 0;
        updateData.substitute_leave_hours = currentHours + (days * 8); // 일 단위를 시간으로 변환
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', employee.id);

      if (error) {
        console.error('Supabase grant leave error:', error);
        throw new Error('휴가 부여에 실패했습니다.');
      }

      // 성공 처리
      alert(`✅ ${employee.name}님에게 ${formData.leaveType === 'compensatory' ? '보상휴가' : 
             formData.leaveType === 'substitute' ? '대체휴가' :
             formData.leaveType === 'special' ? '특별휴가' :
             formData.leaveType === 'reward' ? '포상휴가' : '기타휴가'} ${days}일이 지급되었습니다.`)
      onSuccess()
      handleClose()
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
      console.error('Special leave grant error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({
      leaveType: '',
      days: '',
      reason: '',
      validUntil: ''
    })
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
              <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              특별휴가 지급
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

          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3">
            <h4 className="font-medium text-gray-900">{employee.name}</h4>
            <p className="text-sm text-gray-600">{employee.department} {employee.position}</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="leaveType" className="block text-sm font-medium text-gray-700">
                휴가 종류 <span className="text-red-500">*</span>
              </label>
              <select
                id="leaveType"
                name="leaveType"
                value={formData.leaveType}
                onChange={(e) => setFormData(prev => ({ ...prev, leaveType: e.target.value }))}
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">선택해주세요</option>
                {leaveTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="days" className="block text-sm font-medium text-gray-700">
                휴가 일수 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="days"
                name="days"
                min="0.5"
                max="30"
                step="0.5"
                value={formData.days}
                onChange={(e) => setFormData(prev => ({ ...prev, days: e.target.value }))}
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="예: 1, 0.5, 2"
              />
              <p className="mt-1 text-xs text-gray-500">0.5일 단위로 입력 가능합니다.</p>
            </div>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                지급 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="특별휴가 지급 사유를 입력해주세요"
              />
            </div>

            <div>
              <label htmlFor="validUntil" className="block text-sm font-medium text-gray-700">
                유효기간 (선택사항)
              </label>
              <input
                type="date"
                id="validUntil"
                name="validUntil"
                value={formData.validUntil}
                onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">미입력 시 제한 없음</p>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
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
                className="bg-green-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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