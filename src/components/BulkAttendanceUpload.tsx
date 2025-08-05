'use client'

import { useState } from 'react'
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Users,
  Calendar,
  Clock
} from 'lucide-react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'

interface ParsedRecord {
  name: string
  date: string
  dayOfWeek: string
  status: string
  checkIn?: string
  checkOut?: string
  breakMinutes: number
  basicHours: number
  overtimeHours: number
  nightHours: number
  substituteHours: number
  compensatoryHours: number
  note: string
}

interface BulkAttendanceUploadProps {
  onUploadComplete?: () => void
}

export default function BulkAttendanceUpload({ onUploadComplete }: BulkAttendanceUploadProps) {
  const { supabase } = useSupabase()
  const [textData, setTextData] = useState('')
  const [parsedData, setParsedData] = useState<ParsedRecord[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)

  // 텍스트 데이터 파싱
  const parseTextData = () => {
    try {
      const lines = textData.trim().split('\n')
      const parsed: ParsedRecord[] = []
      
      for (const line of lines) {
        if (!line.trim()) continue
        
        // 탭 또는 여러 공백으로 구분된 데이터 파싱
        const columns = line.split(/\t+|\s{2,}/).filter(col => col.trim())
        
        if (columns.length < 13) {
          console.warn('컬럼 수 부족:', line)
          continue
        }
        
        const record: ParsedRecord = {
          name: columns[0].trim(),
          date: columns[1].trim(),
          dayOfWeek: columns[2].trim(),
          status: columns[3].trim(),
          checkIn: columns[4].trim() || undefined,
          checkOut: columns[5].trim() || undefined,
          breakMinutes: parseInt(columns[6]) || 0,
          basicHours: parseFloat(columns[7]) || 0,
          overtimeHours: parseFloat(columns[8]) || 0,
          nightHours: parseFloat(columns[9]) || 0,
          substituteHours: parseFloat(columns[10]) || 0,
          compensatoryHours: parseFloat(columns[11]) || 0,
          note: columns.slice(12).join(' ').trim()
        }
        
        // 유효성 검사
        if (record.name && record.date && /^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
          parsed.push(record)
        }
      }
      
      setParsedData(parsed)
      setUploadResult(null)
      
      if (parsed.length === 0) {
        setUploadResult({
          success: false,
          message: '파싱된 데이터가 없습니다. 데이터 형식을 확인해주세요.'
        })
      }
      
    } catch (error) {
      console.error('데이터 파싱 오류:', error)
      setUploadResult({
        success: false,
        message: '데이터 파싱 중 오류가 발생했습니다.'
      })
    }
  }

  // Supabase에 데이터 업로드
  const uploadToSupabase = async () => {
    if (parsedData.length === 0) {
      setUploadResult({
        success: false,
        message: '업로드할 데이터가 없습니다.'
      })
      return
    }

    try {
      setUploading(true)
      
      // 권한 확인
      const currentUser = await getCurrentUser()
      if (!currentUser || currentUser.role !== 'admin') {
        setUploadResult({
          success: false,
          message: '관리자 권한이 필요합니다.'
        })
        return
      }

      // 사용자 ID 매핑
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name')
      
      if (usersError) {
        throw new Error(`사용자 정보 조회 오류: ${usersError.message}`)
      }
      
      const userNameToId = new Map()
      users.forEach(user => {
        userNameToId.set(user.name.replace(/\s/g, ''), user.id)
      })

      let attendanceRecords = []
      let dailySummaries = []
      
      for (const record of parsedData) {
        const userId = userNameToId.get(record.name.replace(/\s/g, ''))
        
        if (!userId) {
          console.warn(`사용자를 찾을 수 없음: ${record.name}`)
          continue
        }

        // attendance_records 생성 (출퇴근 기록이 있는 경우만)
        if (record.checkIn && record.checkOut) {
          // 출근 기록
          attendanceRecords.push({
            user_id: userId,
            record_date: record.date,
            record_time: record.checkIn,
            record_timestamp: `${record.date}T${record.checkIn}`,
            record_type: '출근',
            reason: record.note || '일반근무',
            source: 'bulk_upload',
            is_manual: true,
            approved_by: currentUser.id,
            approved_at: new Date().toISOString()
          })

          // 퇴근 기록
          let checkOutDate = record.date
          let checkOutTime = record.checkOut
          
          // 익일 퇴근 처리 (25:16:00 -> 다음날 01:16:00)
          if (checkOutTime.startsWith('2') && parseInt(checkOutTime.substring(0, 2)) >= 24) {
            const hours = parseInt(checkOutTime.substring(0, 2)) - 24
            checkOutTime = `${hours.toString().padStart(2, '0')}${checkOutTime.substring(2)}`
            const nextDay = new Date(record.date)
            nextDay.setDate(nextDay.getDate() + 1)
            checkOutDate = nextDay.toISOString().split('T')[0]
          }

          attendanceRecords.push({
            user_id: userId,
            record_date: checkOutDate,
            record_time: checkOutTime,
            record_timestamp: `${checkOutDate}T${checkOutTime}`,
            record_type: '퇴근',
            reason: record.note || '일반근무',
            source: 'bulk_upload',
            is_manual: true,
            approved_by: currentUser.id,
            approved_at: new Date().toISOString(),
            had_dinner: record.status.includes('+저녁') || record.status.includes('저녁')
          })
        }

        // daily_work_summary 생성
        dailySummaries.push({
          user_id: userId,
          work_date: record.date,
          check_in_time: record.checkIn ? `${record.date}T${record.checkIn}` : null,
          check_out_time: record.checkOut ? (() => {
            let checkOutDate = record.date
            let checkOutTime = record.checkOut
            
            if (checkOutTime.startsWith('2') && parseInt(checkOutTime.substring(0, 2)) >= 24) {
              const hours = parseInt(checkOutTime.substring(0, 2)) - 24
              checkOutTime = `${hours.toString().padStart(2, '0')}${checkOutTime.substring(2)}`
              const nextDay = new Date(record.date)
              nextDay.setDate(nextDay.getDate() + 1)
              checkOutDate = nextDay.toISOString().split('T')[0]
            }
            
            return `${checkOutDate}T${checkOutTime}`
          })() : null,
          basic_hours: record.basicHours,
          overtime_hours: record.overtimeHours,
          night_hours: record.nightHours,
          substitute_hours: record.substituteHours,
          compensatory_hours: record.compensatoryHours,
          work_status: record.status,
          had_dinner: record.status.includes('+저녁') || record.status.includes('저녁'),
          auto_calculated: false, // 수동 입력 데이터
          calculated_at: new Date().toISOString()
        })
      }

      // 배치 업로드
      let successCount = 0
      let errorCount = 0
      const errors = []

      // attendance_records 업로드
      if (attendanceRecords.length > 0) {
        const { error: attendanceError } = await supabase
          .from('attendance_records')
          .upsert(attendanceRecords, {
            onConflict: 'user_id,record_date,record_type'
          })
        
        if (attendanceError) {
          errors.push(`출퇴근 기록 업로드 오류: ${attendanceError.message}`)
          errorCount += attendanceRecords.length
        } else {
          successCount += attendanceRecords.length
        }
      }

      // daily_work_summary 업로드
      if (dailySummaries.length > 0) {
        const { error: summaryError } = await supabase
          .from('daily_work_summary')
          .upsert(dailySummaries, {
            onConflict: 'user_id,work_date'
          })
        
        if (summaryError) {
          errors.push(`일별 근무 요약 업로드 오류: ${summaryError.message}`)
          errorCount += dailySummaries.length
        } else {
          successCount += dailySummaries.length
        }
      }

      // 결과 설정
      if (errors.length === 0) {
        setUploadResult({
          success: true,
          message: `✅ 업로드 완료: ${parsedData.length}건의 데이터가 성공적으로 업로드되었습니다.`,
          details: {
            totalRecords: parsedData.length,
            attendanceRecords: attendanceRecords.length,
            summaryRecords: dailySummaries.length
          }
        })
        
        // 성공 시 데이터 초기화
        setTextData('')
        setParsedData([])
        
        // 콜백 호출
        if (onUploadComplete) {
          setTimeout(() => {
            onUploadComplete()
          }, 2000) // 2초 후 모달 닫기
        }
      } else {
        setUploadResult({
          success: false,
          message: `일부 오류 발생: ${successCount}건 성공, ${errorCount}건 실패`,
          details: { errors }
        })
      }

    } catch (error) {
      console.error('업로드 오류:', error)
      setUploadResult({
        success: false,
        message: `업로드 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      })
    } finally {
      setUploading(false)
    }
  }

  // 통계 계산
  const getStatistics = () => {
    if (parsedData.length === 0) return null
    
    const employees = new Set(parsedData.map(r => r.name))
    const dateRange = parsedData.reduce((acc, r) => {
      if (!acc.start || r.date < acc.start) acc.start = r.date
      if (!acc.end || r.date > acc.end) acc.end = r.date
      return acc
    }, { start: '', end: '' })
    
    return {
      totalRecords: parsedData.length,
      employeeCount: employees.size,
      dateRange: `${dateRange.start} ~ ${dateRange.end}`,
      employees: Array.from(employees)
    }
  }

  const stats = getStatistics()

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-4">
        <Upload className="h-6 w-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-800">출퇴근 데이터 일괄 업로드</h2>
      </div>

      <div className="space-y-6">
        {/* 입력 영역 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            출퇴근 데이터 붙여넣기
          </label>
          <div className="text-xs text-gray-500 mb-2">
            Google Sheets나 Excel에서 복사한 데이터를 그대로 붙여넣으세요. (탭 구분)<br/>
            <strong>헤더 순서:</strong> 직원명 → 날짜 → 요일 → 근무상태 → 출근시간 → 퇴근시간 → 휴게(분) → 기본(h) → 연장(h) → 야간(h) → 발생대체(h) → 발생보상(h) → 비고
          </div>
          <textarea
            value={textData}
            onChange={(e) => setTextData(e.target.value)}
            placeholder="김경은    2025-07-02    수    정상근무    9:59:00    22:31:00    60    11.5    0.0    0.0    0.0    0.0    출처: 기록"
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
          <div className="flex space-x-2 mt-2">
            <button
              onClick={parseTextData}
              disabled={!textData.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <FileText className="h-4 w-4 inline mr-1" />
              데이터 파싱
            </button>
          </div>
        </div>

        {/* 파싱 결과 미리보기 */}
        {parsedData.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              파싱 결과 미리보기
            </h3>
            
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center text-blue-600">
                    <FileText className="h-4 w-4 mr-1" />
                    총 기록
                  </div>
                  <div className="text-lg font-bold text-blue-900">{stats.totalRecords}건</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center text-green-600">
                    <Users className="h-4 w-4 mr-1" />
                    직원 수
                  </div>
                  <div className="text-lg font-bold text-green-900">{stats.employeeCount}명</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="flex items-center text-purple-600">
                    <Calendar className="h-4 w-4 mr-1" />
                    기간
                  </div>
                  <div className="text-sm font-bold text-purple-900">{stats.dateRange}</div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <div className="flex items-center text-orange-600">
                    <Clock className="h-4 w-4 mr-1" />
                    평균/일
                  </div>
                  <div className="text-lg font-bold text-orange-900">
                    {(stats.totalRecords / stats.employeeCount).toFixed(1)}건
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-gray-600 mb-3">
              <strong>직원:</strong> {stats?.employees.join(', ')}
            </div>

            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left">직원명</th>
                    <th className="px-2 py-1 text-left">날짜</th>
                    <th className="px-2 py-1 text-left">상태</th>
                    <th className="px-2 py-1 text-left">출근</th>
                    <th className="px-2 py-1 text-left">퇴근</th>
                    <th className="px-2 py-1 text-left">기본(h)</th>
                    <th className="px-2 py-1 text-left">연장(h)</th>
                    <th className="px-2 py-1 text-left">야간(h)</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 10).map((record, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="px-2 py-1">{record.name}</td>
                      <td className="px-2 py-1">{record.date}</td>
                      <td className="px-2 py-1">{record.status}</td>
                      <td className="px-2 py-1">{record.checkIn || '-'}</td>
                      <td className="px-2 py-1">{record.checkOut || '-'}</td>
                      <td className="px-2 py-1">{record.basicHours}</td>
                      <td className="px-2 py-1">{record.overtimeHours}</td>
                      <td className="px-2 py-1">{record.nightHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 10 && (
                <div className="text-center text-gray-500 py-2">
                  ... 외 {parsedData.length - 10}건 더
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                onClick={uploadToSupabase}
                disabled={uploading}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? '업로드 중...' : `${parsedData.length}건 데이터 업로드`}
              </button>
            </div>
          </div>
        )}

        {/* 결과 메시지 */}
        {uploadResult && (
          <div className={`p-4 rounded-lg border ${
            uploadResult.success 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {uploadResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              )}
              <span className="font-medium">{uploadResult.message}</span>
            </div>
            {uploadResult.details && (
              <div className="mt-2 text-sm">
                {uploadResult.details.errors ? (
                  <ul className="list-disc list-inside">
                    {uploadResult.details.errors.map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                ) : (
                  <div>
                    출퇴근 기록: {uploadResult.details.attendanceRecords}건, 
                    일별 요약: {uploadResult.details.summaryRecords}건
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}