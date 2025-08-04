'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface FormRequest {
  id: string
  user_id: string
  form_type: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request_data: any
  processed_at?: string
  user: {
    name: string
    department: string
  }
}

export default function AdminFormManagement() {
  const [requests, setRequests] = useState<FormRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  const fetchRequests = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)
    try {
      // Supabase에서 직접 form_requests 조회 (user 정보 별도로 조회)
      let query = supabase
        .from('form_requests')
        .select('*')
        .order('submitted_at', { ascending: false })

      // 필터 적용
      if (filter === 'pending') {
        query = query.eq('status', 'pending')
      }

      const { data: formRequests, error: fetchError } = await query

      if (fetchError) throw fetchError

      // user 정보를 별도로 조회하여 매핑
      const mappedRequests = []
      if (formRequests) {
        for (const req of formRequests) {
          // 각 요청에 대해 user 정보 조회
          const { data: userData } = await supabase
            .from('users')
            .select('name, department')
            .eq('id', req.user_id)
            .single()
          
          mappedRequests.push({
            ...req,
            user: userData || { name: '알 수 없음', department: '알 수 없음' }
          })
        }
      }

      setRequests(mappedRequests)
    } catch (err) {
      console.error('서식 신청 조회 오류:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [filter])

  useEffect(() => {
    fetchRequests(true)
  }, [fetchRequests])

  const handleUpdateRequest = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    const adminNote = newStatus === 'rejected' ? prompt('거절 사유를 입력하세요:') : undefined
    if (newStatus === 'rejected' && !adminNote) return

    // 현재 사용자 정보 가져오기
    const userStr = localStorage.getItem('motion-connect-user')
    const user = userStr ? JSON.parse(userStr) : null
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    // 요청 정보 찾기
    const request = requests.find(r => r.id === requestId)
    if (!request) {
      alert('요청을 찾을 수 없습니다.')
      return
    }

    // Optimistic update
    const originalRequests = [...requests]
    setRequests(currentRequests =>
      currentRequests.map(req =>
        req.id === requestId ? { ...req, status: newStatus, processed_at: new Date().toISOString() } : req
      )
    )

    try {
      const headers = getAuthHeaders()
      const requestBody = { 
        requestId, 
        action: newStatus === 'approved' ? 'approve' : 'reject',
        adminNote 
      }
      
      console.log('🔍 관리자 승인 API 호출:', {
        url: '/api/admin/approve-request',
        fullUrl: `${window.location.origin}/api/admin/approve-request`,
        method: 'POST',
        headers,
        body: requestBody,
        timestamp: new Date().toISOString()
      })
      
      // Supabase로 직접 승인 처리
      const { error: updateError } = await supabase
        .from('form_requests')
        .update({
          status: newStatus,
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          admin_notes: adminNote || null
        })
        .eq('id', request.id)

      if (updateError) {
        console.error('❌ Supabase 승인 처리 오류:', updateError)
        throw new Error('승인 처리에 실패했습니다.')
      }

      // 휴가 신청인 경우 users 테이블 휴가 데이터도 업데이트
      if (newStatus === 'approved' && request.form_type.includes('휴가')) {
        const leaveType = request.request_data?.['휴가형태'] || '';
        // 휴가일수 필드명 확인 (신청일수 또는 휴가일수)
        const leaveDays = parseFloat(request.request_data?.['휴가일수'] || request.request_data?.['신청일수'] || '0');

        if (leaveDays > 0) {
          let updateField = '';
          let isHourlyLeave = false;
          
          // 휴가 타입별 필드 매핑
          if (leaveType === '연차') {
            updateField = 'used_annual_days';
          } else if (leaveType === '병가') {
            updateField = 'used_sick_days';
          } else if (leaveType === '대체휴가' || request.request_data?.['_leaveCategory'] === 'substitute') {
            updateField = 'substitute_leave_hours';
            isHourlyLeave = true;
          } else if (leaveType === '보상휴가' || request.request_data?.['_leaveCategory'] === 'compensatory') {
            updateField = 'compensatory_leave_hours';
            isHourlyLeave = true;
          }

          if (updateField) {
            console.log('🔍 휴가 차감 처리:', {
              leaveType,
              leaveDays,
              updateField,
              isHourlyLeave,
              userId: request.user_id
            });

            const { data: userData } = await supabase
              .from('users')
              .select(updateField)
              .eq('id', request.user_id)
              .single();

            let newValue;
            const currentValue = (userData as any)?.[updateField] || 0;
            
            if (isHourlyLeave) {
              // 시간 단위 휴가는 시간으로 차감 (1일 = 8시간)
              const hoursToDeduct = leaveDays * 8;
              newValue = Math.max(0, currentValue - hoursToDeduct);
            } else {
              // 일 단위 휴가는 사용 일수에 추가
              newValue = currentValue + leaveDays;
            }
            
            console.log('🔍 휴가 차감 계산:', {
              currentValue,
              leaveDays,
              newValue,
              operation: isHourlyLeave ? 'subtract_hours' : 'add_used_days'
            });

            await supabase
              .from('users')
              .update({ [updateField]: newValue })
              .eq('id', request.user_id);
              
            console.log('✅ 휴가 차감 완료:', { updateField, newValue });
          }
        }
      }

      const successMessage = newStatus === 'approved' ? '승인되었습니다.' : '반려되었습니다.';
      
      console.log('✅ 서식 승인 성공:', {
        requestId,
        action: newStatus
      })
      
      // 성공 시 자동으로 전체보기로 전환하고 목록 갱신
      if (filter === 'pending') {
        setFilter('all')
      }
      setTimeout(() => fetchRequests(false), 500)
    } catch (err) {
      // 개선된 에러 처리: 구체적이고 도움이 되는 메시지
      const errorContext = {
        action: newStatus,
        requestId,
        requestType: requests.find(r => r.id === requestId)?.form_type
      }
      
      import('@/lib/error-handling/error-manager').then(({ ErrorManager }) => {
        const appError = ErrorManager.getUserFriendlyMessage(err, errorContext)
        ErrorManager.showUserError(appError)
        ErrorManager.logError(appError, 'admin-action')
      })
      
      setRequests(originalRequests) // 실패 시 원래 상태로 롤백
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'approved': return '승인됨'
      case 'rejected': return '거절됨'
      default: return '알 수 없음'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  if (loading) return <div className="p-4">로딩 중...</div>
  if (error) return <div className="p-4 text-red-500">오류: {error}</div>

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg relative">
      {isRefreshing && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10">
          <div className="text-sm text-gray-500">새로고침 중...</div>
        </div>
      )}
      <div className="p-5">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">전체 서식 신청 내역</h3>
          <div className="space-x-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 text-sm rounded-md ${filter === 'pending' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              승인 대기
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded-md ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              전체 보기
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">서식 종류</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청일시</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">처리</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.length > 0 ? (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium text-gray-900">{request.user.name}</div>
                      <div className="text-gray-500">{request.user.department}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div>{request.form_type}</div>
                      {request.form_type === '휴가 신청서' && request.request_data && (
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="font-medium">{request.request_data['휴가형태']}</span>
                          {request.request_data['시작일'] && request.request_data['종료일'] && (
                            <span className="ml-1">
                              ({request.request_data['시작일']} ~ {request.request_data['종료일']})
                            </span>
                          )}
                        </div>
                      )}
                      {request.form_type === '초과근무 신청서' && request.request_data && (
                        <div className="text-xs text-gray-500 mt-1">
                          {request.request_data['근무일']} {request.request_data['시작시간']} ~ {request.request_data['종료시간']}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(request.submitted_at)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      {request.status === 'pending' ? (
                        <div className="space-x-4">
                          <button
                            onClick={() => handleUpdateRequest(request.id, 'approved')}
                            className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleUpdateRequest(request.id, 'rejected')}
                            className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                          >
                            거절
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">{getStatusText(request.status)}</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    {filter === 'pending' ? '승인 대기 중인 신청이 없습니다.' : '표시할 신청 내역이 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}