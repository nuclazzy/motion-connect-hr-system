'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'

interface LeaveRequest {
  id: string
  form_type: string
  status: 'pending' | 'approved' | 'rejected'
  request_data: {
    leave_type?: string
    start_date?: string
    end_date?: string
    reason?: string
    days?: number
  }
  submitted_at: string
  processed_at?: string
  admin_notes?: string
}

interface LeaveStatusModalProps {
  user: User
  isOpen: boolean
  onClose: () => void
}

export default function LeaveStatusModal({ user, isOpen, onClose }: LeaveStatusModalProps) {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchLeaveRequests()
    }
  }, [isOpen, user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeaveRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('form_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('form_type', 'leave')
        .order('submitted_at', { ascending: false })

      if (error) {
        console.error('휴가 신청 내역 조회 실패:', error)
      } else {
        setLeaveRequests(data || [])
      }
    } catch (error) {
      console.error('휴가 신청 내역 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    
    const labels = {
      pending: '대기중',
      approved: '승인됨',
      rejected: '거절됨'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white max-h-96 overflow-y-auto">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">휴가 신청 현황</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">불러오는 중...</p>
            </div>
          ) : leaveRequests.length > 0 ? (
            <div className="space-y-4">
              {leaveRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {request.request_data.leave_type || '휴가'} 신청
                      </h4>
                      <p className="text-sm text-gray-600">
                        {request.request_data.start_date} ~ {request.request_data.end_date}
                      </p>
                      {request.request_data.days && (
                        <p className="text-sm text-gray-600">
                          {request.request_data.days}일
                        </p>
                      )}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  
                  {request.request_data.reason && (
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">사유:</span> {request.request_data.reason}
                    </p>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    신청일: {new Date(request.submitted_at).toLocaleDateString('ko-KR')}
                  </p>
                  
                  {request.processed_at && (
                    <p className="text-xs text-gray-500">
                      처리일: {new Date(request.processed_at).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                  
                  {request.admin_notes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">관리자 메모:</span> {request.admin_notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-600">휴가 신청 내역이 없습니다.</p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}