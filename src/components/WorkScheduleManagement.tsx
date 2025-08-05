'use client'

import { useState, useEffect } from 'react'
import { 
  Clock, 
  Settings,
  Calendar,
  Info,
  Moon,
  Sun,
  AlertCircle
} from 'lucide-react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'

interface FlexibleWorkSettings {
  start_date: string
  end_date: string
  period_name: string
}

interface OvertimeSettings {
  night_start_time: string
  night_end_time: string
  night_allowance_rate: number
  overtime_threshold: number
  overtime_allowance_rate: number
  break_minutes_4h: number
  break_minutes_8h: number
  dinner_time_threshold: number
}

interface LeaveSettings {
  saturday_substitute_enabled: boolean
  saturday_base_rate: number
  saturday_overtime_rate: number
  sunday_compensatory_enabled: boolean
  sunday_base_rate: number
  sunday_overtime_rate: number
  holiday_base_rate: number
  holiday_overtime_rate: number
  max_substitute_hours: number
  max_compensatory_hours: number
}

export default function WorkScheduleManagement() {
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'flexible' | 'overtime' | 'leave'>('flexible')
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // 탄력근무제 설정
  const [flexibleSettings, setFlexibleSettings] = useState<FlexibleWorkSettings>({
    start_date: '2025-06-01',
    end_date: '2025-08-31',
    period_name: '2025년 하반기 탄력근무제 (6-7-8월)'
  })
  
  // 야간/초과근무 설정
  const [overtimeSettings, setOvertimeSettings] = useState<OvertimeSettings>({
    night_start_time: '22:00',
    night_end_time: '06:00',
    night_allowance_rate: 1.5,
    overtime_threshold: 8,
    overtime_allowance_rate: 1.5,
    break_minutes_4h: 30,
    break_minutes_8h: 60,
    dinner_time_threshold: 9
  })
  
  // 대체/보상휴가 설정
  const [leaveSettings, setLeaveSettings] = useState<LeaveSettings>({
    saturday_substitute_enabled: true,
    saturday_base_rate: 1.0,
    saturday_overtime_rate: 1.5,
    sunday_compensatory_enabled: true,
    sunday_base_rate: 1.5,
    sunday_overtime_rate: 2.0,
    holiday_base_rate: 1.5,
    holiday_overtime_rate: 2.0,
    max_substitute_hours: 240,
    max_compensatory_hours: 240
  })

  // 현재 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const user = await getCurrentUser()
        if (!user || user.role !== 'admin') {
          console.error('관리자 권한이 필요합니다.')
          return
        }
        setCurrentUser(user)

        // 시스템 설정에서 각종 설정 로드
        const { data: settings, error } = await supabase
          .from('system_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [
            'flexible_work_start_date', 'flexible_work_end_date', 'flexible_work_period_name',
            'overtime_night_start', 'overtime_night_end', 'overtime_night_rate',
            'overtime_threshold', 'overtime_rate', 'break_4h', 'break_8h', 'dinner_threshold',
            'saturday_substitute_enabled', 'saturday_base_rate', 'saturday_overtime_rate',
            'sunday_compensatory_enabled', 'sunday_base_rate', 'sunday_overtime_rate',
            'holiday_base_rate', 'holiday_overtime_rate', 'max_substitute_hours', 'max_compensatory_hours'
          ])

        if (!error && settings) {
          settings.forEach(setting => {
            switch(setting.setting_key) {
              // 탄력근무제 설정
              case 'flexible_work_start_date':
                setFlexibleSettings(prev => ({ ...prev, start_date: setting.setting_value }))
                break
              case 'flexible_work_end_date':
                setFlexibleSettings(prev => ({ ...prev, end_date: setting.setting_value }))
                break
              case 'flexible_work_period_name':
                setFlexibleSettings(prev => ({ ...prev, period_name: setting.setting_value }))
                break
              // 야간/초과근무 설정
              case 'overtime_night_start':
                setOvertimeSettings(prev => ({ ...prev, night_start_time: setting.setting_value }))
                break
              case 'overtime_night_end':
                setOvertimeSettings(prev => ({ ...prev, night_end_time: setting.setting_value }))
                break
              case 'overtime_night_rate':
                setOvertimeSettings(prev => ({ ...prev, night_allowance_rate: parseFloat(setting.setting_value) }))
                break
              case 'overtime_threshold':
                setOvertimeSettings(prev => ({ ...prev, overtime_threshold: parseInt(setting.setting_value) }))
                break
              case 'overtime_rate':
                setOvertimeSettings(prev => ({ ...prev, overtime_allowance_rate: parseFloat(setting.setting_value) }))
                break
              case 'break_4h':
                setOvertimeSettings(prev => ({ ...prev, break_minutes_4h: parseInt(setting.setting_value) }))
                break
              case 'break_8h':
                setOvertimeSettings(prev => ({ ...prev, break_minutes_8h: parseInt(setting.setting_value) }))
                break
              case 'dinner_threshold':
                setOvertimeSettings(prev => ({ ...prev, dinner_time_threshold: parseInt(setting.setting_value) }))
                break
              // 대체/보상휴가 설정
              case 'saturday_substitute_enabled':
                setLeaveSettings(prev => ({ ...prev, saturday_substitute_enabled: setting.setting_value === 'true' }))
                break
              case 'saturday_base_rate':
                setLeaveSettings(prev => ({ ...prev, saturday_base_rate: parseFloat(setting.setting_value) }))
                break
              case 'saturday_overtime_rate':
                setLeaveSettings(prev => ({ ...prev, saturday_overtime_rate: parseFloat(setting.setting_value) }))
                break
              case 'sunday_compensatory_enabled':
                setLeaveSettings(prev => ({ ...prev, sunday_compensatory_enabled: setting.setting_value === 'true' }))
                break
              case 'sunday_base_rate':
                setLeaveSettings(prev => ({ ...prev, sunday_base_rate: parseFloat(setting.setting_value) }))
                break
              case 'sunday_overtime_rate':
                setLeaveSettings(prev => ({ ...prev, sunday_overtime_rate: parseFloat(setting.setting_value) }))
                break
              case 'holiday_base_rate':
                setLeaveSettings(prev => ({ ...prev, holiday_base_rate: parseFloat(setting.setting_value) }))
                break
              case 'holiday_overtime_rate':
                setLeaveSettings(prev => ({ ...prev, holiday_overtime_rate: parseFloat(setting.setting_value) }))
                break
              case 'max_substitute_hours':
                setLeaveSettings(prev => ({ ...prev, max_substitute_hours: parseInt(setting.setting_value) }))
                break
              case 'max_compensatory_hours':
                setLeaveSettings(prev => ({ ...prev, max_compensatory_hours: parseInt(setting.setting_value) }))
                break
            }
          })
        }
      } catch (error) {
        console.error('설정 로드 오류:', error)
      }
    }

    loadSettings()
  }, [supabase])

  // 탄력근무제 기간 설정 업데이트
  const updateFlexiblePeriod = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('관리자 권한이 필요합니다.')
      return
    }

    try {
      setLoading(true)

      const updates = [
        {
          setting_key: 'flexible_work_start_date',
          setting_value: flexibleSettings.start_date,
          setting_type: 'date',
          description: '탄력근무제 시작일'
        },
        {
          setting_key: 'flexible_work_end_date',
          setting_value: flexibleSettings.end_date,
          setting_type: 'date',
          description: '탄력근무제 종료일'
        },
        {
          setting_key: 'flexible_work_period_name',
          setting_value: flexibleSettings.period_name,
          setting_type: 'string',
          description: '탄력근무제 기간명'
        }
      ]

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({
            ...update,
            updated_at: new Date().toISOString()
          })

        if (error) {
          console.error('기간 설정 업데이트 오류:', error)
          alert('기간 설정 업데이트 중 오류가 발생했습니다.')
          return
        }
      }

      alert('탄력근무제 기간이 업데이트되었습니다.')
    } catch (error) {
      console.error('기간 업데이트 오류:', error)
      alert('기간 설정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 야간/초과근무 설정 업데이트
  const updateOvertimeSettings = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('관리자 권한이 필요합니다.')
      return
    }

    try {
      setLoading(true)

      const updates = [
        { setting_key: 'overtime_night_start', setting_value: overtimeSettings.night_start_time, setting_type: 'time', description: '야간근무 시작시간' },
        { setting_key: 'overtime_night_end', setting_value: overtimeSettings.night_end_time, setting_type: 'time', description: '야간근무 종료시간' },
        { setting_key: 'overtime_night_rate', setting_value: overtimeSettings.night_allowance_rate.toString(), setting_type: 'decimal', description: '야간근무 수당 비율' },
        { setting_key: 'overtime_threshold', setting_value: overtimeSettings.overtime_threshold.toString(), setting_type: 'integer', description: '초과근무 기준시간' },
        { setting_key: 'overtime_rate', setting_value: overtimeSettings.overtime_allowance_rate.toString(), setting_type: 'decimal', description: '초과근무 수당 비율' },
        { setting_key: 'break_4h', setting_value: overtimeSettings.break_minutes_4h.toString(), setting_type: 'integer', description: '4시간 근무 시 휴게시간(분)' },
        { setting_key: 'break_8h', setting_value: overtimeSettings.break_minutes_8h.toString(), setting_type: 'integer', description: '8시간 근무 시 휴게시간(분)' },
        { setting_key: 'dinner_threshold', setting_value: overtimeSettings.dinner_time_threshold.toString(), setting_type: 'integer', description: '저녁식사 기준시간' }
      ]

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({
            ...update,
            updated_at: new Date().toISOString()
          })

        if (error) {
          console.error('야간/초과근무 설정 업데이트 오류:', error)
          alert('설정 업데이트 중 오류가 발생했습니다.')
          return
        }
      }

      alert('야간/초과근무 설정이 업데이트되었습니다.')
    } catch (error) {
      console.error('설정 업데이트 오류:', error)
      alert('설정 업데이트 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 대체/보상휴가 설정 업데이트
  const updateLeaveSettings = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('관리자 권한이 필요합니다.')
      return
    }

    try {
      setLoading(true)

      const updates = [
        { setting_key: 'saturday_substitute_enabled', setting_value: leaveSettings.saturday_substitute_enabled.toString(), setting_type: 'boolean', description: '토요일 대체휴가 활성화' },
        { setting_key: 'saturday_base_rate', setting_value: leaveSettings.saturday_base_rate.toString(), setting_type: 'decimal', description: '토요일 기본 비율' },
        { setting_key: 'saturday_overtime_rate', setting_value: leaveSettings.saturday_overtime_rate.toString(), setting_type: 'decimal', description: '토요일 초과 비율' },
        { setting_key: 'sunday_compensatory_enabled', setting_value: leaveSettings.sunday_compensatory_enabled.toString(), setting_type: 'boolean', description: '일요일 보상휴가 활성화' },
        { setting_key: 'sunday_base_rate', setting_value: leaveSettings.sunday_base_rate.toString(), setting_type: 'decimal', description: '일요일 기본 비율' },
        { setting_key: 'sunday_overtime_rate', setting_value: leaveSettings.sunday_overtime_rate.toString(), setting_type: 'decimal', description: '일요일 초과 비율' },
        { setting_key: 'holiday_base_rate', setting_value: leaveSettings.holiday_base_rate.toString(), setting_type: 'decimal', description: '공휴일 기본 비율' },
        { setting_key: 'holiday_overtime_rate', setting_value: leaveSettings.holiday_overtime_rate.toString(), setting_type: 'decimal', description: '공휴일 초과 비율' },
        { setting_key: 'max_substitute_hours', setting_value: leaveSettings.max_substitute_hours.toString(), setting_type: 'integer', description: '최대 대체휴가 시간' },
        { setting_key: 'max_compensatory_hours', setting_value: leaveSettings.max_compensatory_hours.toString(), setting_type: 'integer', description: '최대 보상휴가 시간' }
      ]

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({
            ...update,
            updated_at: new Date().toISOString()
          })

        if (error) {
          console.error('대체/보상휴가 설정 업데이트 오류:', error)
          alert('설정 업데이트 중 오류가 발생했습니다.')
          return
        }
      }

      alert('대체/보상휴가 설정이 업데이트되었습니다.')
    } catch (error) {
      console.error('설정 업데이트 오류:', error)
      alert('설정 업데이트 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatRate = (rate: number): string => {
    return rate === 1 ? '100%' : `${Math.round(rate * 100)}%`
  }

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">관리자 권한이 필요합니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          근무제 관리
        </h2>
        <p className="text-gray-600">
          근무제도 및 수당 계산 규칙을 설정합니다
        </p>
      </div>

      {/* 탭 메뉴 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('flexible')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'flexible'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              탄력근무제
            </button>
            <button
              onClick={() => setActiveTab('overtime')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overtime'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              야간/초과근무
            </button>
            <button
              onClick={() => setActiveTab('leave')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'leave'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              대체/보상휴가
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* 탄력근무제 탭 */}
          {activeTab === 'flexible' && (
            <div className="space-y-6">
              {/* 탄력근무제 정보 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">💡 탄력근무제란?</h4>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>일정 기간(보통 1개월~3개월) 동안 주당 평균 근무시간을 40시간으로 맞추면서, 일별 근무시간을 탄력적으로 조정하는 제도입니다.</p>
                      <ul className="mt-2 ml-4 space-y-1">
                        <li>• 핵심시간(코어타임)을 설정하여 필수 근무시간 지정 가능</li>
                        <li>• 최소/최대 일일 근무시간 제한으로 과로 방지</li>
                        <li>• 정산 주기 종료 시 총 근무시간으로 초과근무 계산</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 기간 설정 */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">탄력근무제 기간 설정</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      기간명
                    </label>
                    <input
                      type="text"
                      value={flexibleSettings.period_name}
                      onChange={(e) => setFlexibleSettings(prev => ({ ...prev, period_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 2025년 하반기 탄력근무제"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        시작일
                      </label>
                      <input
                        type="date"
                        value={flexibleSettings.start_date}
                        onChange={(e) => setFlexibleSettings(prev => ({ ...prev, start_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        종료일
                      </label>
                      <input
                        type="date"
                        value={flexibleSettings.end_date}
                        onChange={(e) => setFlexibleSettings(prev => ({ ...prev, end_date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-yellow-500 mr-2" />
                      <h4 className="text-sm font-medium text-yellow-800">현재 설정된 기간</h4>
                    </div>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p><strong>{flexibleSettings.period_name}</strong></p>
                      <p>{flexibleSettings.start_date} ~ {flexibleSettings.end_date}</p>
                      <p className="mt-1 text-xs">
                        * 이 기간 동안 일일 최대 12시간까지 근무 가능하며, 기간 종료 후 총 근무시간을 기준으로 초과근무를 정산합니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={updateFlexiblePeriod}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? '저장 중...' : '기간 설정 저장'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 야간/초과근무 탭 */}
          {activeTab === 'overtime' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="text-md font-medium text-orange-900 mb-2">
                  <Moon className="inline h-4 w-4 mr-1" />
                  야간근무 & 
                  <Clock className="inline h-4 w-4 mx-1" />
                  초과근무 계산
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium text-orange-800 mb-1">야간근무 계산</h5>
                    <ul className="text-orange-700 ml-4 list-disc">
                      <li>22:00~06:00 시간대 근무 시</li>
                      <li>기본 시급 + 50% 가산 지급</li>
                      <li>예: 10,000원/시 → 15,000원/시</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-orange-800 mb-1">초과근무 계산</h5>
                    <ul className="text-orange-700 ml-4 list-disc">
                      <li>8시간 초과 근무 시</li>
                      <li>기본 시급 × 150% 지급</li>
                      <li>예: 10,000원/시 → 15,000원/시</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-orange-100 rounded">
                  <p className="text-sm text-orange-800">
                    <strong>휴게시간 차감 규칙:</strong> 4시간 근무(30분), 8시간 근무(1시간) 자동 차감 + 퇴근 시 저녁식사 여부 선택 시 추가 1시간 차감
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">야간/초과근무 설정</h3>
                
                <div className="space-y-6">
                  {/* 야간근무 설정 */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">야간근무 설정</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          야간근무 시작시간
                        </label>
                        <input
                          type="time"
                          value={overtimeSettings.night_start_time}
                          onChange={(e) => setOvertimeSettings(prev => ({ ...prev, night_start_time: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          야간근무 종료시간
                        </label>
                        <input
                          type="time"
                          value={overtimeSettings.night_end_time}
                          onChange={(e) => setOvertimeSettings(prev => ({ ...prev, night_end_time: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          야간수당 비율
                        </label>
                        <select
                          value={overtimeSettings.night_allowance_rate}
                          onChange={(e) => setOvertimeSettings(prev => ({ ...prev, night_allowance_rate: parseFloat(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="1.5">150% (1.5배)</option>
                          <option value="2.0">200% (2.0배)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 초과근무 설정 */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">초과근무 설정</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          초과근무 기준시간
                        </label>
                        <input
                          type="number"
                          value={overtimeSettings.overtime_threshold}
                          onChange={(e) => setOvertimeSettings(prev => ({ ...prev, overtime_threshold: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="1"
                          max="12"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          초과수당 비율
                        </label>
                        <select
                          value={overtimeSettings.overtime_allowance_rate}
                          onChange={(e) => setOvertimeSettings(prev => ({ ...prev, overtime_allowance_rate: parseFloat(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="1.5">150% (1.5배)</option>
                          <option value="2.0">200% (2.0배)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 휴게시간 설정 */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">휴게시간 설정</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          4시간 근무 시 휴게시간(분)
                        </label>
                        <input
                          type="number"
                          value={overtimeSettings.break_minutes_4h}
                          onChange={(e) => setOvertimeSettings(prev => ({ ...prev, break_minutes_4h: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max="60"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          8시간 근무 시 휴게시간(분)
                        </label>
                        <input
                          type="number"
                          value={overtimeSettings.break_minutes_8h}
                          onChange={(e) => setOvertimeSettings(prev => ({ ...prev, break_minutes_8h: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max="120"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          저녁식사 기준시간
                        </label>
                        <input
                          type="number"
                          value={overtimeSettings.dinner_time_threshold}
                          onChange={(e) => setOvertimeSettings(prev => ({ ...prev, dinner_time_threshold: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="8"
                          max="12"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={updateOvertimeSettings}
                      disabled={loading}
                      className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                    >
                      {loading ? '저장 중...' : '야간/초과근무 설정 저장'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 대체/보상휴가 탭 */}
          {activeTab === 'leave' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-md font-medium text-green-900 mb-3">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  대체/보상휴가 계산 방식
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="border border-green-300 rounded p-3">
                    <h5 className="font-medium text-green-800 mb-2">🗓️ 토요일 대체휴가</h5>
                    <ul className="text-green-700 space-y-1">
                      <li>• 8시간 이하: <strong>1:1 비율</strong></li>
                      <li>• 8시간 초과: <strong>8시간 + 초과분×1.5배</strong></li>
                      <li>• 야간근무: <strong>+0.5배 추가</strong></li>
                      <li className="text-xs text-green-600 bg-green-100 p-1 rounded">
                        예: 10시간 근무 = 8 + (2×1.5) = 11시간 대체휴가
                      </li>
                    </ul>
                  </div>
                  <div className="border border-green-300 rounded p-3">
                    <h5 className="font-medium text-green-800 mb-2">🎊 일요일/공휴일 보상휴가</h5>
                    <ul className="text-green-700 space-y-1">
                      <li>• 8시간 이하: <strong>1.5배 비율</strong></li>
                      <li>• 8시간 초과: <strong>(8×1.5) + 초과분×2.0배</strong></li>
                      <li>• 야간근무: <strong>+0.5배 추가</strong></li>
                      <li className="text-xs text-green-600 bg-green-100 p-1 rounded">
                        예: 10시간 근무 = (8×1.5) + (2×2.0) = 16시간 보상휴가
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-green-100 rounded">
                  <p className="text-sm text-green-800">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    <strong>주의:</strong> 최대 적립 시간 제한(기본 240시간) 및 소멸 시효(12개월) 적용
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">대체/보상휴가 계산 설정</h3>
                
                <div className="space-y-6">
                  {/* 토요일 대체휴가 설정 */}
                  <div className="border-b border-gray-200 pb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">🗓️ 토요일 대체휴가</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          활성화
                        </label>
                        <select
                          value={leaveSettings.saturday_substitute_enabled ? 'true' : 'false'}
                          onChange={(e) => setLeaveSettings(prev => ({ ...prev, saturday_substitute_enabled: e.target.value === 'true' }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="true">활성화</option>
                          <option value="false">비활성화</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          기본 비율
                        </label>
                        <select
                          value={leaveSettings.saturday_base_rate}
                          onChange={(e) => setLeaveSettings(prev => ({ ...prev, saturday_base_rate: parseFloat(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="1.0">100% (1.0배)</option>
                          <option value="1.5">150% (1.5배)</option>
                          <option value="2.0">200% (2.0배)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          초과 비율
                        </label>
                        <select
                          value={leaveSettings.saturday_overtime_rate}
                          onChange={(e) => setLeaveSettings(prev => ({ ...prev, saturday_overtime_rate: parseFloat(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="1.5">150% (1.5배)</option>
                          <option value="2.0">200% (2.0배)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 일요일/공휴일 보상휴가 설정 */}
                  <div className="border-b border-gray-200 pb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">🎊 일요일/공휴일 보상휴가</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          일요일 활성화
                        </label>
                        <select
                          value={leaveSettings.sunday_compensatory_enabled ? 'true' : 'false'}
                          onChange={(e) => setLeaveSettings(prev => ({ ...prev, sunday_compensatory_enabled: e.target.value === 'true' }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="true">활성화</option>
                          <option value="false">비활성화</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          일요일 기본
                        </label>
                        <select
                          value={leaveSettings.sunday_base_rate}
                          onChange={(e) => setLeaveSettings(prev => ({ ...prev, sunday_base_rate: parseFloat(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="1.5">150% (1.5배)</option>
                          <option value="2.0">200% (2.0배)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          일요일 초과
                        </label>
                        <select
                          value={leaveSettings.sunday_overtime_rate}
                          onChange={(e) => setLeaveSettings(prev => ({ ...prev, sunday_overtime_rate: parseFloat(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="2.0">200% (2.0배)</option>
                          <option value="2.5">250% (2.5배)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          공휴일 기본
                        </label>
                        <select
                          value={leaveSettings.holiday_base_rate}
                          onChange={(e) => setLeaveSettings(prev => ({ ...prev, holiday_base_rate: parseFloat(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="1.5">150% (1.5배)</option>
                          <option value="2.0">200% (2.0배)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 최대 적립 시간 설정 */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4">최대 적립 시간</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          최대 대체휴가 시간
                        </label>
                        <input
                          type="number"
                          value={leaveSettings.max_substitute_hours}
                          onChange={(e) => setLeaveSettings(prev => ({ ...prev, max_substitute_hours: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max="999"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          최대 보상휴가 시간
                        </label>
                        <input
                          type="number"
                          value={leaveSettings.max_compensatory_hours}
                          onChange={(e) => setLeaveSettings(prev => ({ ...prev, max_compensatory_hours: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max="999"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={updateLeaveSettings}
                      disabled={loading}
                      className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? '저장 중...' : '대체/보상휴가 설정 저장'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}