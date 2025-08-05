'use client'

import { useState, useEffect } from 'react'
import { Clock, MapPin, Coffee, User, Calendar, AlertCircle } from 'lucide-react'
import { getCurrentUser, type User as AuthUser } from '@/lib/auth'
import { useSupabase } from '@/components/SupabaseProvider'

interface User {
  id: string
  name: string
  department: string
  position: string
}

interface AttendanceRecord {
  id: string
  record_time: string
  record_type: '출근' | '퇴근' | '해제' | '세트' | '출입' // CAPS 호환
  reason?: string
  had_dinner?: boolean
  source?: string // CAPS/WEB 구분
}

interface WorkSummary {
  basic_hours: number
  overtime_hours: number
  work_status: string
  check_in_time?: string
  check_out_time?: string
}

interface AttendanceStatus {
  user: User
  date: string
  currentStatus: string
  statusMessage: string
  canCheckIn: boolean
  canCheckOut: boolean
  todayRecords: {
    checkIn: AttendanceRecord[]
    checkOut: AttendanceRecord[]
    total: number
    // CAPS 호환 추가 정보
    entryCount?: number // 출입 기록 수
    capsRecords?: number // CAPS 기록 수
    webRecords?: number // 웹 기록 수
  }
  workSummary: WorkSummary
}

export default function AttendanceRecorder() {
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [reason, setReason] = useState('')
  const [hadDinner, setHadDinner] = useState(false)
  const [selectedTime, setSelectedTime] = useState('')
  const [useCurrentTime, setUseCurrentTime] = useState(true)
  const [location, setLocation] = useState<{lat: number, lng: number, accuracy: number} | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // 사용자 인증 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        setCurrentUser(user)
      } catch (error) {
        console.error('사용자 인증 확인 오류:', error)
      } finally {
        setAuthLoading(false)
      }
    }
    checkAuth()
  }, [])

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 초기 시간 설정
  useEffect(() => {
    if (useCurrentTime) {
      setSelectedTime(formatTime(currentTime).substring(0, 5))
    }
  }, [currentTime, useCurrentTime])

  // 위치 정보 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        (error) => {
          console.log('위치 정보를 가져올 수 없습니다:', error)
        }
      )
    }
  }, [])

  // 출퇴근 현황 조회 (직접 Supabase 연동)
  const fetchAttendanceStatus = async () => {
    if (!currentUser?.id) return

    try {
      const today = new Date().toISOString().split('T')[0]
      
      // 사용자 정보 조회
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, department, position')
        .eq('id', currentUser.id)
        .single()

      if (userError || !user) {
        console.error('사용자 정보 조회 오류:', userError)
        return
      }

      // 오늘의 출퇴근 기록 조회
      const { data: todayRecords, error: recordsError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('record_date', today)
        .order('record_timestamp', { ascending: true })

      if (recordsError) {
        console.error('출퇴근 기록 조회 오류:', recordsError)
        return
      }

      // 오늘의 근무 요약 조회
      const { data: workSummary, error: summaryError } = await supabase
        .from('daily_work_summary')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('work_date', today)
        .single()

      if (summaryError && summaryError.code !== 'PGRST116') {
        console.error('근무 요약 조회 오류:', summaryError)
      }

      // CAPS 호환 출퇴근 기록 분류
      const checkInRecords = todayRecords?.filter(r => ['출근', '해제'].includes(r.record_type)) || []
      const checkOutRecords = todayRecords?.filter(r => ['퇴근', '세트'].includes(r.record_type)) || []
      const entryRecords = todayRecords?.filter(r => r.record_type === '출입') || []
      
      // CAPS 호환 상태 계산
      const hasCheckIn = checkInRecords.length > 0
      const hasCheckOut = checkOutRecords.length > 0
      const totalRecords = (todayRecords?.length || 0)
      const totalEntryRecords = entryRecords.length
      
      let currentStatus = '출근전'
      let statusMessage = '출근 기록을 해주세요'
      let canCheckIn = true
      let canCheckOut = false
      
      if (hasCheckIn && !hasCheckOut) {
        currentStatus = '근무중'
        statusMessage = `퇴근 기록을 해주세요 ${totalEntryRecords > 0 ? `(출입 ${totalEntryRecords}건)` : ''}`
        canCheckIn = false
        canCheckOut = true
      } else if (hasCheckIn && hasCheckOut) {
        currentStatus = '퇴근완료'
        statusMessage = `오늘 업무가 완료되었습니다 ${totalRecords > 2 ? `(총 ${totalRecords}건 기록)` : ''}`
        canCheckIn = false
        canCheckOut = false
      }

      const statusData: AttendanceStatus = {
        user: {
          id: user.id,
          name: user.name,
          department: user.department,
          position: user.position
        },
        date: today,
        currentStatus,
        statusMessage,
        canCheckIn,
        canCheckOut,
        todayRecords: {
          checkIn: checkInRecords.map(r => ({
            id: r.id,
            record_time: r.record_time,
            record_type: r.record_type as '출근' | '퇴근',
            reason: r.reason || `${r.source} ${r.record_type}`,
            had_dinner: r.had_dinner,
            source: r.source // CAPS/WEB 구분
          })),
          checkOut: checkOutRecords.map(r => ({
            id: r.id,
            record_time: r.record_time,
            record_type: r.record_type as '출근' | '퇴근',
            reason: r.reason || `${r.source} ${r.record_type}`,
            had_dinner: r.had_dinner,
            source: r.source
          })),
          total: totalRecords,
          // CAPS 추가 정보
          entryCount: totalEntryRecords,
          capsRecords: todayRecords?.filter(r => r.source?.includes('CAPS')).length || 0,
          webRecords: todayRecords?.filter(r => r.source === 'WEB').length || 0
        },
        workSummary: {
          basic_hours: workSummary?.basic_hours || 0,
          overtime_hours: workSummary?.overtime_hours || 0,
          work_status: workSummary?.work_status || '정상근무',
          check_in_time: workSummary?.check_in_time,
          check_out_time: workSummary?.check_out_time
        }
      }

      setStatus(statusData)
    } catch (error) {
      console.error('출퇴근 현황 조회 오류:', error)
    }
  }

  // 사용자 인증 완료 후 상태 조회
  useEffect(() => {
    if (currentUser?.id) {
      fetchAttendanceStatus()
    }
  }, [currentUser])

  // 출퇴근 기록 (직접 Supabase 연동)
  const recordAttendance = async (recordType: '출근' | '퇴근') => {
    if (!currentUser?.id) {
      alert('사용자 인증이 필요합니다.')
      return
    }

    if (recordType === '출근' && !reason.trim()) {
      alert('출근 시에는 업무 사유를 반드시 입력해주세요.')
      return
    }

    if (!useCurrentTime && !selectedTime) {
      alert('시간을 선택해주세요.')
      return
    }

    // 미래 시간 검증
    if (!useCurrentTime) {
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const selectedDateTime = new Date()
      selectedDateTime.setHours(hours, minutes, 0, 0)
      
      if (selectedDateTime > new Date()) {
        alert('미래 시간으로는 기록할 수 없습니다.')
        return
      }
    }

    setLoading(true)

    try {
      // 사용자 존재 여부 확인
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', currentUser.id)
        .single()

      if (userError || !user) {
        alert('유효하지 않은 사용자입니다.')
        return
      }

      // 현재 시간 또는 사용자 지정 시간 설정
      let recordTimestamp: Date
      let recordDate: string
      let recordTime: string

      if (useCurrentTime) {
        recordTimestamp = new Date()
        recordDate = recordTimestamp.toISOString().split('T')[0]
        recordTime = recordTimestamp.toTimeString().split(' ')[0]
      } else {
        recordDate = new Date().toISOString().split('T')[0]
        recordTime = selectedTime + ':00'
        recordTimestamp = new Date(`${recordDate}T${recordTime}`)
      }

      // 중복 기록 확인 (같은 날, 같은 타입의 웹 기록만 체크)
      const { data: existingRecords, error: duplicateError } = await supabase
        .from('attendance_records')
        .select('id, source')
        .eq('user_id', currentUser.id)
        .eq('record_date', recordDate)
        .eq('record_type', recordType)
        .eq('source', 'WEB') // 웹 기록만 중복 체크 (CAPS 기록과는 별도)

      if (duplicateError) {
        console.error('중복 기록 확인 오류:', duplicateError)
        alert('기록 확인 중 오류가 발생했습니다.')
        return
      }

      if (existingRecords && existingRecords.length > 0) {
        alert(`오늘 이미 ${recordType} 기록이 존재합니다.`)
        return
      }

      // CAPS 형식 호환 출퇴근 기록 생성
      const { data: newRecord, error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          user_id: currentUser.id,
          record_date: recordDate,
          record_time: recordTime,
          record_timestamp: recordTimestamp.toISOString(),
          record_type: recordType, // '출근' 또는 '퇴근' (CAPS 호환)
          reason: reason.trim() || `웹 ${recordType} 기록`,
          location_lat: location?.lat,
          location_lng: location?.lng,
          location_accuracy: location?.accuracy,
          source: 'WEB', // CAPS 형식에 맞춰 대문자로 통일
          had_dinner: recordType === '퇴근' ? hadDinner : false,
          is_manual: !useCurrentTime,
          // CAPS 호환 메타데이터 추가
          notes: `웹앱 기록 - 사용자: ${user.name}, 시간: ${useCurrentTime ? '현재시간' : '수동선택'}`
        })
        .select()
        .single()

      if (insertError) {
        console.error('출퇴근 기록 생성 오류:', insertError)
        alert(`기록 실패: ${insertError.message}`)
        return
      }

      if (newRecord) {
        alert(`${recordType} 기록이 완료되었습니다!`)
        setReason('')
        setHadDinner(false)
        setUseCurrentTime(true)
        setSelectedTime('')
        
        // 상태 새로고침
        await fetchAttendanceStatus()
      }
    } catch (error) {
      console.error('출퇴근 기록 오류:', error)
      alert('출퇴근 기록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

  if (authLoading) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-pulse" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">인증 정보 확인 중...</h3>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">로그인이 필요합니다</h3>
          <p className="text-gray-600 mb-4">출퇴근 기록을 위해 먼저 로그인해주세요.</p>
          <a 
            href="/auth/login"
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            로그인하기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      {/* 현재 시간 및 날짜 */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-2">
          <Clock className="h-5 w-5 text-blue-500 mr-2" />
          <div className="text-2xl font-mono font-bold text-gray-800">
            {formatTime(currentTime)}
          </div>
        </div>
        <div className="flex items-center justify-center text-gray-600">
          <Calendar className="h-4 w-4 mr-1" />
          <div className="text-sm">{formatDate(currentTime)}</div>
        </div>
      </div>

      {/* 사용자 정보 및 현재 상태 */}
      {status && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center mb-2">
            <User className="h-4 w-4 text-gray-500 mr-2" />
            <span className="font-medium">{status.user.name}</span>
            <span className="text-sm text-gray-500 ml-2">({status.user.department})</span>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            {status.statusMessage}
          </div>
          
          {/* CAPS/웹 기록 현황 */}
          {status.todayRecords.total > 0 && (
            <div className="text-xs text-gray-500 mb-2">
              오늘 기록: 총 {status.todayRecords.total}건
              {status.todayRecords.capsRecords && status.todayRecords.capsRecords > 0 && (
                <span className="text-blue-600"> (CAPS {status.todayRecords.capsRecords}건)</span>
              )}
              {status.todayRecords.webRecords && status.todayRecords.webRecords > 0 && (
                <span className="text-green-600"> (웹 {status.todayRecords.webRecords}건)</span>
              )}
              {status.todayRecords.entryCount && status.todayRecords.entryCount > 0 && (
                <span className="text-orange-600"> (출입 {status.todayRecords.entryCount}건)</span>
              )}
            </div>
          )}
          
          {/* 오늘 근무 현황 */}
          {status.workSummary && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">기본시간:</span>
                <span className="font-medium ml-1">{status.workSummary.basic_hours}h</span>
              </div>
              <div>
                <span className="text-gray-500">연장시간:</span>
                <span className="font-medium ml-1">{status.workSummary.overtime_hours}h</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 위치 정보 */}
      {location && (
        <div className="mb-4 flex items-center text-xs text-gray-500">
          <MapPin className="h-3 w-3 mr-1" />
          <span>위치: {location.lat.toFixed(4)}, {location.lng.toFixed(4)} (±{Math.round(location.accuracy)}m)</span>
        </div>
      )}

      {/* 시간 선택 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          기록 시간
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              checked={useCurrentTime}
              onChange={(e) => {
                setUseCurrentTime(e.target.checked)
                if (e.target.checked) {
                  setSelectedTime(formatTime(currentTime).substring(0, 5))
                }
              }}
              className="mr-2"
              disabled={loading}
            />
            <Clock className="h-4 w-4 mr-1" />
            <span className="text-sm">현재 시간 사용 ({formatTime(currentTime)})</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={!useCurrentTime}
              onChange={(e) => {
                setUseCurrentTime(!e.target.checked)
                if (e.target.checked) {
                  setSelectedTime(formatTime(currentTime).substring(0, 5))
                }
              }}
              className="mr-2"
              disabled={loading}
            />
            <span className="text-sm">직접 시간 선택</span>
          </label>
          {!useCurrentTime && (
            <div className="ml-6">
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                max={formatTime(currentTime).substring(0, 5)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                현재 시간 이전만 선택 가능합니다
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 출근 사유 입력 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          업무 사유 {status?.canCheckIn && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="오늘 수행할 업무나 프로젝트를 간단히 입력해주세요..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          rows={3}
          disabled={loading}
        />
      </div>

      {/* 저녁식사 여부 (퇴근 시) */}
      {status?.canCheckOut && (
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={hadDinner}
              onChange={(e) => setHadDinner(e.target.checked)}
              className="mr-2"
              disabled={loading}
            />
            <Coffee className="h-4 w-4 mr-1" />
            <span className="text-sm">저녁식사를 했습니다</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            저녁식사를 한 경우 체크해주세요 (1시간 차감)
          </p>
        </div>
      )}

      {/* 출퇴근 버튼 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => recordAttendance('출근')}
          disabled={loading || !status?.canCheckIn}
          className={`py-3 px-4 rounded-lg font-medium text-white transition-colors ${
            loading || !status?.canCheckIn
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
          }`}
        >
          {loading ? '처리중...' : '출근'}
        </button>

        <button
          onClick={() => recordAttendance('퇴근')}
          disabled={loading || !status?.canCheckOut}
          className={`py-3 px-4 rounded-lg font-medium text-white transition-colors ${
            loading || !status?.canCheckOut
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
          }`}
        >
          {loading ? '처리중...' : '퇴근'}
        </button>
      </div>

      {/* 오늘 기록 내역 */}
      {status?.todayRecords && status.todayRecords.total > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-800 mb-3">오늘 기록</h4>
          <div className="space-y-2">
            {[...status.todayRecords.checkIn, ...status.todayRecords.checkOut]
              .sort((a, b) => a.record_time.localeCompare(b.record_time))
              .map((record, index) => (
                <div key={index} className="flex justify-between items-center text-xs">
                  <div className="flex items-center">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      ['출근', '해제'].includes(record.record_type) ? 'bg-green-500' : 
                      ['퇴근', '세트'].includes(record.record_type) ? 'bg-red-500' : 'bg-orange-500'
                    }`} />
                    <span className="font-medium">{record.record_type}</span>
                    {/* CAPS/웹 구분 배지 */}
                    <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                      record.source?.includes('CAPS') ? 'bg-blue-100 text-blue-800' :
                      record.source === 'WEB' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {record.source?.includes('CAPS') ? 'CAPS' : record.source === 'WEB' ? '웹' : '기타'}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    {record.record_time}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 주의사항 */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="mb-1">• <strong>원칙적으로 CAPS(지문인식기) 사용을 권장합니다</strong></p>
            <p className="mb-1">• 웹 출퇴근과 CAPS 기록이 모두 저장되어 통합 관리됩니다</p>
            <p className="mb-1">• 출근 시에는 반드시 업무 사유를 입력해주세요</p>
            <p className="mb-1">• 퇴근 시 저녁식사를 한 경우 체크해주세요 (근무시간 계산에 반영)</p>
            <p className="mb-1">• CAPS 기록과 웹 기록이 모두 위 목록에 표시됩니다</p>
            <p>• 모든 기록은 데이터베이스 트리거로 자동 근무시간 계산됩니다</p>
          </div>
        </div>
      </div>
    </div>
  )
}