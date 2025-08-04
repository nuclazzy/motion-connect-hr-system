'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface FormRequest {
  id: string
  user_id: string
  form_type: string
  status: 'pending' | 'approved' | 'rejected'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request_data: any
  submitted_at: string
  user: {
    name: string
    department: string
    position: string
  }
}

export default function LocalAdminApprovalPanel() {
  const [requests, setRequests] = useState<FormRequest[]>([])
  const [loading, setLoading] = useState(true)

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('form_requests')
        .select(`
          id, user_id, form_type, status, request_data, submitted_at,
          user:users(name, department, position)
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })

      if (error) {
        console.error('Supabase form requests error:', error)
        return
      }

      // 조인된 user 데이터 타입 변환
      const formattedData = data?.map(item => ({
        ...item,
        user: Array.isArray(item.user) ? item.user[0] : item.user
      })) || []

      setRequests(formattedData)
    } catch (error) {
      console.error('신청 내역 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
    // 동적 폴링: 대기 중 요청이 있으면 5초, 없으면 30초
    const updatePollingInterval = () => {
      const hasPendingRequests = requests.some(req => req.status === 'pending')
      return hasPendingRequests ? 5000 : 30000
    }
    
    const interval = setInterval(() => {
      loadRequests()
    }, updatePollingInterval())
    
    return () => clearInterval(interval)
  }, [requests.length])

  const handleApprove = async (requestId: string) => {
    try {
      const userStr = localStorage.getItem('motion-connect-user')
      const user = userStr ? JSON.parse(userStr) : null
      if (!user) {
        alert('로그인이 필요합니다.')
        return
      }

      const { error } = await supabase
        .from('form_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: user.id
        })
        .eq('id', requestId)

      if (error) {
        console.error('Supabase approval error:', error)
        alert('❌ 승인 처리에 실패했습니다.')
        return
      }

      alert('✅ 승인 완료!')
      loadRequests()
    } catch (error) {
      console.error('승인 처리 오류:', error)
      alert('승인 처리 중 오류가 발생했습니다.')
    }
  }

  const handleReject = async (requestId: string) => {
    const reason = prompt('거절 사유를 입력하세요:')
    if (!reason) return

    try {
      const userStr = localStorage.getItem('motion-connect-user')
      const user = userStr ? JSON.parse(userStr) : null
      if (!user) {
        alert('로그인이 필요합니다.')
        return
      }

      const { error } = await supabase
        .from('form_requests')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          admin_note: reason
        })
        .eq('id', requestId)

      if (error) {
        console.error('Supabase rejection error:', error)
        alert('❌ 거절 처리에 실패했습니다.')
        return
      }

      alert('❌ 거절 완료!')
      loadRequests()
    } catch (error) {
      console.error('거절 처리 오류:', error)
      alert('거절 처리 중 오류가 발생했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">대기중</span>
      case 'approved':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">승인됨</span>
      case 'rejected':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">거절됨</span>
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">🏛️ 로컬 승인 관리</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          🏛️ 로컬 승인 관리
          <span className="ml-2 text-sm text-gray-500">({requests.length}건)</span>
        </h3>
      </div>

      {requests.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          신청된 서식이 없습니다.
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {requests.map((request) => (
            <div key={request.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="text-md font-medium text-gray-900">{request.form_type}</h4>
                    {getStatusBadge(request.status)}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    신청자: {request.user.name} ({request.user.department} {request.user.position})
                  </p>
                  
                  <p className="text-sm text-gray-500 mb-3">
                    신청일: {new Date(request.submitted_at).toLocaleString('ko-KR')}
                  </p>

                  {request.form_type === '휴가 신청서' && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                      <p className="text-sm text-blue-800">
                        <strong>휴가형태:</strong> {request.request_data.휴가형태}
                      </p>
                      <p className="text-sm text-blue-800">
                        <strong>기간:</strong> {request.request_data.시작일}
                        {request.request_data.종료일 && request.request_data.종료일 !== request.request_data.시작일 
                          ? ` ~ ${request.request_data.종료일}` 
                          : ''
                        }
                      </p>
                      {request.request_data.사유 && (
                        <p className="text-sm text-blue-800">
                          <strong>사유:</strong> {request.request_data.사유}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleApprove(request.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}