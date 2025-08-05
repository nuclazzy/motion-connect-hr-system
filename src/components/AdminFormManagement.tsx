'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/auth'
import { getLeaveCalendarConfig, syncLeaveDataFromCalendar, createLeaveEvent } from '@/lib/actions/calendar-sync'
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
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)

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

  // Google Calendar 연차 데이터 동기화
  const handleSyncLeaveData = async () => {
    setIsSyncing(true)
    setSyncResult(null)
    setError(null)

    try {
      // 먼저 연차 캘린더 설정 조회
      const leaveCalendars = await getLeaveCalendarConfig()

      if (!leaveCalendars || leaveCalendars.length === 0) {
        setError('연차 캘린더가 설정되지 않았습니다. 먼저 캘린더 설정에서 연차 캘린더를 등록해주세요.')
        return
      }

      // 첫 번째 연차 캘린더로 동기화 실행
      const leaveCalendar = leaveCalendars[0]
      const syncData = await syncLeaveDataFromCalendar(
        leaveCalendar.calendar_id,
        new Date('2025-06-01').toISOString(), // 6월부터
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 3개월 후까지
      )

      if (syncData.success) {
        setSyncResult(syncData)
        // 동기화 후 요청 목록 새로고침
        fetchRequests()
      } else {
        setError('Google Calendar 동기화에 실패했습니다.')
      }

    } catch (error) {
      console.error('Google Calendar 동기화 오류:', error)
      setError('Google Calendar 동기화 중 오류가 발생했습니다.')
    } finally {
      setIsSyncing(false)
    }
  }

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

        // 휴가 승인 시 Google Calendar에 이벤트 생성 (Server Action 사용)
        try {
          const startDate = request.request_data?.['시작일'] || '';
          const endDate = request.request_data?.['종료일'] || startDate;
          
          if (startDate) {
            // 종료일 계산 (Google Calendar는 종일 이벤트의 경우 다음날까지 포함해야 함)
            const endDateObj = new Date(endDate);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const adjustedEndDate = endDateObj.toISOString().split('T')[0];

            console.log('📅 캘린더 이벤트 생성 요청');

            // Server Action 호출
            const calendarResult = await createLeaveEvent(
              {
                leaveType: leaveType,
                leaveDays: leaveDays,
                startDate: startDate,
                endDate: adjustedEndDate,
                reason: request.request_data?.['사유'] || request.request_data?.['휴가사유'] || '',
                formRequestId: request.id
              },
              {
                id: request.user_id,
                name: request.user.name,
                department: request.user.department
              }
            );

            if (calendarResult.success) {
              console.log('✅ 휴가 캘린더 이벤트 생성 성공:', calendarResult);
            } else {
              console.error('❌ 휴가 캘린더 이벤트 생성 실패:', calendarResult.error);
            }
          }
        } catch (calendarError) {
          console.error('❌ 캘린더 이벤트 생성 중 오류:', calendarError);
          // 캘린더 오류는 휴가 승인 자체에는 영향을 주지 않음
        }
      }

      const successMessage = newStatus === 'approved' ? '승인되었습니다.' : '반려되었습니다.';
      
      console.log('✅ 서식 승인 성공:', {
        requestId,
        action: newStatus
      })
      
      // 성공 시 즉시 목록 갱신 및 필터 조정
      if (filter === 'pending') {
        setFilter('all')
      }
      await fetchRequests(false) // 즉시 새로고침
      
      // 사용자에게 성공 피드백 제공
      alert(successMessage)
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
          <div className="flex items-center space-x-4">
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
            <button
              onClick={handleSyncLeaveData}
              disabled={isSyncing}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {isSyncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>동기화 중...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Google Calendar 동기화</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 동기화 결과 표시 */}
        {syncResult && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-sm font-medium text-green-800">Google Calendar 동기화 완료</h4>
            </div>
            <div className="mt-2 text-sm text-green-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="font-medium">처리된 이벤트:</span> {syncResult.results?.processed || 0}개
                </div>
                <div>
                  <span className="font-medium">매칭 성공:</span> {syncResult.results?.matched || 0}개
                </div>
                <div>
                  <span className="font-medium">매칭 실패:</span> {syncResult.results?.unmatched || 0}개
                </div>
                <div>
                  <span className="font-medium">오류:</span> {syncResult.results?.errors || 0}개
                </div>
              </div>
              {syncResult.totalLeaveEvents > 0 && (
                <div className="mt-2">
                  <span className="font-medium">총 연차 이벤트:</span> {syncResult.totalLeaveEvents}개
                </div>
              )}
            </div>
            <button
              onClick={() => setSyncResult(null)}
              className="inline-flex items-center mt-2 text-xs text-green-600 hover:text-green-800"
            >
              닫기
            </button>
          </div>
        )}

        {/* 에러 메시지 표시 */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-sm font-medium text-red-800">동기화 오류</h4>
            </div>
            <div className="mt-1 text-sm text-red-700">{error}</div>
            <button
              onClick={() => setError(null)}
              className="inline-flex items-center mt-2 text-xs text-red-600 hover:text-red-800"
            >
              닫기
            </button>
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">서식 종류</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청일시</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태 / 처리</th>
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {request.status === 'pending' ? (
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                            {getStatusText(request.status)}
                          </span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleUpdateRequest(request.id, 'approved')}
                              className="bg-green-100 text-green-800 hover:bg-green-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleUpdateRequest(request.id, 'rejected')}
                              className="bg-red-100 text-red-800 hover:bg-red-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                            >
                              거절
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                            {getStatusText(request.status)}
                          </span>
                          {request.processed_at && (
                            <span className="text-xs text-gray-500 ml-2">
                              {formatDate(request.processed_at)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
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