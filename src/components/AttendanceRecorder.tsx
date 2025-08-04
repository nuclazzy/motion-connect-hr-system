'use client'

import { useState, useEffect } from 'react'
import { Clock, MapPin, Coffee, User, Calendar, AlertCircle } from 'lucide-react'

interface User {
  id: string
  name: string
  department: string
  position: string
}

interface AttendanceRecord {
  id: string
  record_time: string
  record_type: '출근' | '퇴근'
  reason?: string
  had_dinner?: boolean
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
  }
  workSummary: WorkSummary
}

export default function AttendanceRecorder() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [reason, setReason] = useState('')
  const [hadDinner, setHadDinner] = useState(false)
  const [location, setLocation] = useState<{lat: number, lng: number, accuracy: number} | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [userId, setUserId] = useState('') // 실제로는 인증에서 가져와야 함

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

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

  // 출퇴근 현황 조회
  const fetchAttendanceStatus = async () => {
    if (!userId) return

    try {
      const response = await fetch(`/api/attendance/status?user_id=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        setStatus(data.data)
      } else {
        console.error('출퇴근 현황 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('출퇴근 현황 조회 오류:', error)
    }
  }

  // 컴포넌트 마운트 시 상태 조회
  useEffect(() => {
    if (userId) {
      fetchAttendanceStatus()
    }
  }, [userId])

  // 출퇴근 기록
  const recordAttendance = async (recordType: '출근' | '퇴근') => {
    if (!userId) {
      alert('사용자 ID가 필요합니다.')
      return
    }

    if (recordType === '출근' && !reason.trim()) {
      alert('출근 시에는 업무 사유를 반드시 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/attendance/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          record_type: recordType,
          reason: reason.trim() || null,
          had_dinner: recordType === '퇴근' ? hadDinner : false,
          location_lat: location?.lat,
          location_lng: location?.lng,
          location_accuracy: location?.accuracy
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message)
        setReason('')
        setHadDinner(false)
        
        // 상태 새로고침
        await fetchAttendanceStatus()
      } else {
        alert(`기록 실패: ${data.error}`)
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

  if (!userId) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">사용자 인증 필요</h3>
          <input
            type="text"
            placeholder="사용자 ID를 입력하세요"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
            8시간 이상 근무 시 저녁식사 여부를 체크해주세요
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
                      record.record_type === '출근' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium">{record.record_type}</span>
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
            <p className="mb-1">• 출근 시에는 반드시 업무 사유를 입력해주세요</p>
            <p className="mb-1">• 8시간 이상 근무 시 저녁식사 여부를 체크해주세요</p>
            <p>• 기록은 실시간으로 저장되며 수정이 어려우니 신중히 입력해주세요</p>
          </div>
        </div>
      </div>
    </div>
  )
}