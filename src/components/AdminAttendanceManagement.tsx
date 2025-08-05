'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  Calendar, 
  Clock, 
  Edit, 
  Plus, 
  Download, 
  Filter,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Upload
} from 'lucide-react'
import { getCurrentUser, checkPermission, type User as AuthUser } from '@/lib/auth'
import { useSupabase } from '@/components/SupabaseProvider'
import CapsUploadManager from './CapsUploadManager'
import CapsTestDataGenerator from './CapsTestDataGenerator'

interface Employee {
  id: string
  name: string
  department: string
  position: string
}

interface AttendanceRecord {
  id: string
  user_id: string
  record_date: string
  record_time: string
  record_type: '출근' | '퇴근' | '해제' | '세트' | '출입' // CAPS 호환
  reason?: string
  had_dinner?: boolean
  is_manual?: boolean
  source?: string // CAPS/WEB 구분
  users: {
    name: string
    department: string
    position: string
  }
}

interface MissingRecordRequest {
  user_id: string
  date_string: string
  time_string: string
  record_type: '출근' | '퇴근' | '해제' | '세트' | '출입' // CAPS 호환
  reason: string
}

export default function AdminAttendanceManagement() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [filterType, setFilterType] = useState<'all' | '출근' | '퇴근' | '해제' | '세트' | '출입' | 'missing'>('all')
  const [showMissingForm, setShowMissingForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'attendance' | 'upload' | 'test'>('attendance')
  const [missingFormData, setMissingFormData] = useState<MissingRecordRequest>({
    user_id: '',
    date_string: '',
    time_string: '',
    record_type: '출근',
    reason: ''
  })

  // 관리자 인증 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user && checkPermission(user, 'admin')) {
          setCurrentUser(user)
        } else {
          console.error('관리자 권한이 필요합니다')
        }
      } catch (error) {
        console.error('관리자 인증 확인 오류:', error)
      } finally {
        setAuthLoading(false)
      }
    }
    checkAuth()
  }, [])

  // 직원 목록 조회
  const fetchEmployees = async () => {
    try {
      console.log('👥 관리자 - 전체 직원 목록 조회 요청')
      
      const { supabase } = useSupabase()

      // 전체 직원 정보 조회
      const { data: employees, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          department,
          position,
          phone,
          start_date,
          role,
          salary,
          hourly_rate,
          annual_leave_days,
          used_leave_days,
          remaining_leave_days,
          created_at
        `)
        .order('department', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('❌ 직원 목록 조회 오류:', error)
        alert('직원 목록 조회에 실패했습니다.')
        return
      }

      console.log('✅ 직원 목록 조회 성공:', {
        count: employees?.length || 0,
        departments: [...new Set(employees?.map(emp => emp.department))].length
      })

      setEmployees(employees || [])
    } catch (error) {
      console.error('❌ 직원 목록 조회 오류:', error)
      alert('직원 목록 조회 중 오류가 발생했습니다.')
    }
  }

  // 출퇴근 기록 조회
  const fetchAttendanceRecords = async () => {
    setLoading(true)
    try {
      console.log('📋 출퇴근 기록 조회 요청:', {
        selectedDate,
        filterType,
        searchTerm
      })

      const { supabase } = useSupabase()

      let query = supabase
        .from('attendance_records')
        .select(`
          id,
          user_id,
          record_date,
          record_time,
          record_timestamp,
          record_type,
          reason,
          location_lat,
          location_lng,
          source,
          had_dinner,
          is_manual,
          created_at,
          users(name, department, position)
        `)
        .order('record_timestamp', { ascending: false })
        .limit(100)

      // 날짜 필터 적용
      query = query.gte('record_date', selectedDate)
      query = query.lte('record_date', selectedDate)

      // 기록 유형 필터 적용 (CAPS 호환)
      if (filterType !== 'all' && filterType !== 'missing' && ['출근', '퇴근', '해제', '세트', '출입'].includes(filterType)) {
        query = query.eq('record_type', filterType)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ 출퇴근 기록 조회 오류:', error)
        alert('출퇴근 기록 조회에 실패했습니다.')
        return
      }

      let filteredRecords = data || []
      
      // 검색어 필터링
      if (searchTerm) {
        filteredRecords = filteredRecords.filter((record: any) =>
          record.users?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.users?.department?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      console.log('✅ 출퇴근 기록 조회 성공:', {
        count: filteredRecords.length,
        date_range: selectedDate
      })

      setRecords(filteredRecords as unknown as AttendanceRecord[])
    } catch (error) {
      console.error('❌ 출퇴근 기록 조회 오류:', error)
      alert('출퇴근 기록 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 누락 기록 추가
  const addMissingRecord = async () => {
    if (!currentUser?.id) {
      alert('관리자 인증이 필요합니다.')
      return
    }

    if (!missingFormData.user_id || !missingFormData.date_string || 
        !missingFormData.time_string || !missingFormData.reason) {
      alert('모든 필드를 입력해주세요.')
      return
    }

    if (!['출근', '퇴근', '해제', '세트', '출입'].includes(missingFormData.record_type)) {
      alert('기록 유형이 올바르지 않습니다.')
      return
    }

    try {
      console.log('➕ 누락 기록 추가 요청:', {
        user_id: missingFormData.user_id,
        date_string: missingFormData.date_string,
        time_string: missingFormData.time_string,
        record_type: missingFormData.record_type,
        admin_user_id: currentUser.id
      })

      const { supabase } = useSupabase()

      // 대상 사용자 확인
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, department')
        .eq('id', missingFormData.user_id)
        .single()

      if (userError || !user) {
        alert('사용자를 찾을 수 없습니다.')
        return
      }

      // 날짜와 시간 파싱
      const [year, month, day] = missingFormData.date_string.split('-').map(Number)
      const [hours, minutes] = missingFormData.time_string.split(':').map(Number)
      
      if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
        alert('날짜 또는 시간 형식이 올바르지 않습니다.')
        return
      }

      const timestamp = new Date(year, month - 1, day, hours, minutes)
      
      // 미래 시간 검증
      if (timestamp > new Date()) {
        alert('미래 시간으로는 기록할 수 없습니다.')
        return
      }

      // 중복 기록 검사
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('id, record_time')
        .eq('user_id', missingFormData.user_id)
        .eq('record_date', missingFormData.date_string)
        .eq('record_type', missingFormData.record_type)
        .single()

      if (existingRecord) {
        alert(`${missingFormData.record_type} 기록이 이미 존재합니다. (${existingRecord.record_time})`)
        return
      }

      // 누락 기록 추가
      const { data: newRecord, error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          user_id: missingFormData.user_id,
          record_date: missingFormData.date_string,
          record_time: missingFormData.time_string,
          record_timestamp: timestamp.toISOString(),
          record_type: missingFormData.record_type,
          reason: missingFormData.reason?.trim() || '누락 기록 보충',
          source: 'manual',
          is_manual: true,
          approved_by: currentUser.id,
          approved_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ 누락 기록 추가 오류:', insertError)
        alert('누락 기록 추가에 실패했습니다.')
        return
      }

      console.log('✅ 누락 기록 추가 성공:', {
        user: user.name,
        type: missingFormData.record_type,
        date: missingFormData.date_string,
        time: missingFormData.time_string
      })

      alert(`✅ ${user.name}님의 ${missingFormData.record_type} 기록이 추가되었습니다. (${missingFormData.date_string} ${missingFormData.time_string})`)
      
      setShowMissingForm(false)
      setMissingFormData({
        user_id: '',
        date_string: '',
        time_string: '',
        record_type: '출근',
        reason: ''
      })
      fetchAttendanceRecords()

    } catch (error) {
      console.error('❌ 누락 기록 추가 오류:', error)
      alert('누락 기록 추가 중 오류가 발생했습니다.')
    }
  }

  // 데이터 로드
  useEffect(() => {
    if (currentUser) {
      fetchEmployees()
      fetchAttendanceRecords()
    }
  }, [currentUser])

  useEffect(() => {
    if (currentUser) {
      fetchAttendanceRecords()
    }
  }, [selectedDate, filterType, searchTerm, currentUser])

  // 출근/퇴근 상태 분석
  const getAttendanceStatus = () => {
    const today = selectedDate
    const employeeStatus = new Map()

    // 각 직원별 출퇴근 상태 분석
    employees.forEach(emp => {
      employeeStatus.set(emp.id, {
        employee: emp,
        checkIn: null,
        checkOut: null,
        status: '결근'
      })
    })

    records.forEach(record => {
      const empStatus = employeeStatus.get(record.user_id)
      if (empStatus) {
        if (record.record_type === '출근') {
          empStatus.checkIn = record
        } else {
          empStatus.checkOut = record
        }
      }
    })

    // 상태 업데이트
    employeeStatus.forEach(status => {
      if (status.checkIn && status.checkOut) {
        status.status = '정상근무'
      } else if (status.checkIn && !status.checkOut) {
        status.status = '퇴근미기록'
      } else if (!status.checkIn && status.checkOut) {
        status.status = '출근미기록'
      }
    })

    return Array.from(employeeStatus.values())
  }

  const attendanceStatus = getAttendanceStatus()
  const normalCount = attendanceStatus.filter(s => s.status === '정상근무').length
  const missingCount = attendanceStatus.filter(s => s.status.includes('미기록')).length
  const absentCount = attendanceStatus.filter(s => s.status === '결근').length

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-pulse" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">관리자 인증 확인 중...</h3>
          <div className="w-full max-w-xs mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">관리자 권한이 필요합니다</h3>
          <p className="text-gray-600 mb-4">출퇴근 관리 기능은 관리자만 접근할 수 있습니다.</p>
          <div className="space-x-3">
            <a 
              href="/auth/login"
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              로그인하기
            </a>
            <a 
              href="/admin"
              className="inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              관리자 대시보드
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">출퇴근 관리</h2>
          <p className="text-gray-600">직원들의 출퇴근 현황을 관리합니다</p>
        </div>
        {activeTab === 'attendance' && (
          <button
            onClick={() => setShowMissingForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            누락 기록 추가
          </button>
        )}
      </div>

      {/* 탭 메뉴 */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'attendance'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          출퇴근 현황
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 font-medium flex items-center ${
            activeTab === 'upload'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload className="h-4 w-4 mr-2" />
          CAPS 데이터 업로드
        </button>
        <button
          onClick={() => setActiveTab('test')}
          className={`px-4 py-2 font-medium flex items-center ${
            activeTab === 'test'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar className="h-4 w-4 mr-2" />
          테스트 데이터
        </button>
      </div>

      {/* 출퇴근 현황 탭 */}
      {activeTab === 'attendance' && (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-blue-600">전체 직원</p>
              <p className="text-2xl font-bold text-blue-700">{employees.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-green-600">정상근무</p>
              <p className="text-2xl font-bold text-green-700">{normalCount}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm text-yellow-600">기록 누락</p>
              <p className="text-2xl font-bold text-yellow-700">{missingCount}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded-lg">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm text-red-600">결근</p>
              <p className="text-2xl font-bold text-red-700">{absentCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">구분</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="출근">출근</option>
            <option value="퇴근">퇴근</option>
            <option value="해제">해제 (CAPS)</option>
            <option value="세트">세트 (CAPS)</option>
            <option value="출입">출입 (CAPS)</option>
            <option value="missing">누락</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름 또는 부서 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-end">
          <button
            onClick={fetchAttendanceRecords}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            <Filter className="h-4 w-4 inline mr-2" />
            조회
          </button>
        </div>
      </div>

      {/* 출퇴근 현황 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">
            {selectedDate} 출퇴근 현황
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-pulse">데이터를 불러오는 중...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    직원정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출근시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    퇴근시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    저녁식사
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceStatus.map((status, index) => (
                  <tr key={status.employee.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {status.employee.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {status.employee.department} · {status.employee.position}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {status.checkIn ? (
                        <div className="text-sm text-gray-900">
                          {status.checkIn.record_time}
                          {status.checkIn.is_manual && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              수동
                            </span>
                          )}
                          {/* CAPS 기록 표시 */}
                          {status.checkIn.source?.includes('CAPS') && (
                            <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                              CAPS
                            </span>
                          )}
                          {status.checkIn.source === 'WEB' && (
                            <span className="ml-1 px-1 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              웹
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {status.checkOut ? (
                        <div className="text-sm text-gray-900">
                          {status.checkOut.record_time}
                          {status.checkOut.is_manual && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              수동
                            </span>
                          )}
                          {/* CAPS 기록 표시 */}
                          {status.checkOut.source?.includes('CAPS') && (
                            <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                              CAPS
                            </span>
                          )}
                          {status.checkOut.source === 'WEB' && (
                            <span className="ml-1 px-1 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              웹
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        status.status === '정상근무' 
                          ? 'bg-green-100 text-green-800'
                          : status.status.includes('미기록')
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {status.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {status.checkOut?.had_dinner ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-300" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 mr-3">
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 누락 기록 추가 모달 */}
      {showMissingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">누락 기록 추가</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  직원 선택
                </label>
                <select
                  value={missingFormData.user_id}
                  onChange={(e) => setMissingFormData({...missingFormData, user_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">직원을 선택하세요</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  날짜
                </label>
                <input
                  type="date"
                  value={missingFormData.date_string}
                  onChange={(e) => setMissingFormData({...missingFormData, date_string: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시간
                </label>
                <input
                  type="time"
                  value={missingFormData.time_string}
                  onChange={(e) => setMissingFormData({...missingFormData, time_string: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  구분
                </label>
                <select
                  value={missingFormData.record_type}
                  onChange={(e) => setMissingFormData({...missingFormData, record_type: e.target.value as '출근' | '퇴근' | '해제' | '세트' | '출입'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="출근">출근</option>
                  <option value="퇴근">퇴근</option>
                  <option value="해제">해제 (CAPS)</option>
                  <option value="세트">세트 (CAPS)</option>
                  <option value="출입">출입 (CAPS)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사유
                </label>
                <textarea
                  value={missingFormData.reason}
                  onChange={(e) => setMissingFormData({...missingFormData, reason: e.target.value})}
                  placeholder="누락 사유를 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowMissingForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={addMissingRecord}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* CAPS 업로드 탭 */}
      {activeTab === 'upload' && (
        <CapsUploadManager />
      )}

      {/* 테스트 데이터 생성 탭 */}
      {activeTab === 'test' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CapsTestDataGenerator />
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">테스트 가이드</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-700">1. 테스트 데이터 생성</h4>
                <p>직원 수와 날짜 범위를 선택하여 CAPS 형식의 테스트 데이터를 생성합니다.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700">2. 데이터 업로드</h4>
                <p>생성된 파일을 다운로드한 후, CAPS 데이터 업로드 탭에서 업로드합니다.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700">3. 결과 확인</h4>
                <p>출퇴근 현황 탭에서 업로드된 데이터를 확인할 수 있습니다.</p>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 rounded-md">
                <p className="text-yellow-800">
                  <strong>주의:</strong> 테스트 데이터에 포함된 직원명이 실제 데이터베이스에 존재해야 업로드가 성공합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}