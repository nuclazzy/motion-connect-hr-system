'use client'

import { useState, useEffect } from 'react'
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

interface CapsRecord {
  date: string          // 발생일자 (2025. 6. 19.)
  time: string          // 발생시각 (PM 4:30:33)
  terminalId: string    // 단말기ID
  userId: string        // 사용자ID
  name: string          // 이름
  employeeNo: string    // 사원번호
  position: string      // 직급
  category: string      // 구분
  mode: string          // 모드 (출근/퇴근/해제/세트/출입)
  auth: string          // 인증 (CAPS/WEB)
  result: string        // 결과 (O)
  timestamp: Date       // 계산된 실제 타임스탬프
}

interface ProcessedAttendance {
  name: string
  date: string
  records: CapsRecord[]
  checkIn?: Date
  checkOut?: Date
}

interface BulkAttendanceUploadProps {
  onUploadComplete?: () => void
}

export default function BulkAttendanceUpload({ onUploadComplete }: BulkAttendanceUploadProps) {
  const { supabase } = useSupabase()
  const [textData, setTextData] = useState('')
  const [parsedData, setParsedData] = useState<CapsRecord[]>([])
  const [processedData, setProcessedData] = useState<ProcessedAttendance[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)

  // 디버그: 상태 변경 감지
  useEffect(() => {
    console.log('🎨 UI 상태 변경:', { parsedDataLength: parsedData.length, processedDataLength: processedData.length })
  }, [parsedData, processedData])

  // CAPS 원본 데이터 파싱
  const parseTextData = () => {
    console.log('🔍 CAPS 데이터 파싱 시작', { textDataLength: textData.length })
    try {
      const lines = textData.trim().split('\n')
      console.log('📝 파싱할 라인 수:', lines.length)
      const parsed: CapsRecord[] = []
      
      for (const line of lines) {
        if (!line.trim()) continue
        
        // 탭으로 구분된 CAPS 데이터 파싱
        const columns = line.split('\t')
        
        // WEB 형식 (8컬럼) vs CAPS 형식 (10컬럼) 구분
        if (columns.length < 8) {
          console.warn('CAPS 데이터 컬럼 부족:', line, 'columns:', columns.length)
          continue
        }
        
        // 날짜 파싱 (2025. 6. 19. -> 2025-06-19)
        const dateStr = columns[0].trim()
        const formattedDate = parseCapsDate(dateStr)
        if (!formattedDate) {
          console.warn('날짜 파싱 실패:', dateStr)
          continue
        }
        
        // 시간 파싱 및 실제 타임스탬프 계산
        const timeStr = columns[1].trim() // PM 4:30:33
        const timestamp = parseCapsDateTime(formattedDate, timeStr)
        
        let record: CapsRecord
        
        if (columns.length >= 10) {
          // CAPS 형식 (10컬럼)
          record = {
            date: formattedDate,
            time: timeStr,
            terminalId: columns[2].trim(),
            userId: columns[3].trim(),
            name: columns[4].trim(),
            employeeNo: columns[5].trim(),
            position: columns[6].trim(),
            category: columns[7].trim(),
            mode: columns[8].trim(), // 출근/퇴근/해제/세트/출입
            auth: columns[9].trim(), // CAPS/WEB
            result: columns.length > 10 ? columns[10].trim() : 'O',
            timestamp: timestamp
          }
        } else {
          // WEB 형식 (8컬럼) - 단말기ID와 사용자ID가 없음
          record = {
            date: formattedDate,
            time: timeStr,
            terminalId: columns[2].trim() || '웹앱',
            userId: '',
            name: columns[3].trim(),
            employeeNo: columns[4].trim(),
            position: columns[5] ? columns[5].trim() : '',
            category: columns[6] ? columns[6].trim() : '',
            mode: columns[7] ? columns[7].trim() : (columns[6] ? columns[6].trim() : ''), // 출근/퇴근
            auth: 'WEB',
            result: 'O',
            timestamp: timestamp
          }
        }
        
        // 유효성 검사
        if (record.name && record.mode && ['출근', '퇴근', '해제', '세트', '출입'].includes(record.mode)) {
          parsed.push(record)
        }
      }
      
      console.log('✅ 파싱 완료:', { parsedCount: parsed.length })
      setParsedData(parsed)
      console.log('📊 parsedData 상태 업데이트:', { newParsedDataLength: parsed.length })
      
      // CAPS 기록을 일별 출퇴근으로 처리
      const processed = processCapsRecords(parsed)
      console.log('🔄 처리된 출퇴근 기록:', { processedCount: processed.length })
      setProcessedData(processed)
      console.log('📋 processedData 상태 업데이트:', { newProcessedDataLength: processed.length })
      
      setUploadResult({
        success: true,
        message: `✅ CAPS 데이터 파싱 완료! ${parsed.length}개 레코드를 ${processed.length}개 출퇴근 기록으로 처리했습니다.`
      })

      // 사용자에게 즉시 피드백 제공
      alert(`🎉 파싱 완료!\n\n📊 ${parsed.length}개 CAPS 레코드\n📅 ${processed.length}개 출퇴근 기록으로 변환\n\n아래로 스크롤하여 "업로드" 버튼을 클릭하세요!`)
      
      if (parsed.length === 0) {
        setUploadResult({
          success: false,
          message: 'CAPS 데이터가 파싱되지 않았습니다. 데이터 형식을 확인해주세요.'
        })
      }
      
    } catch (error) {
      console.error('CAPS 데이터 파싱 오류:', error)
      setUploadResult({
        success: false,
        message: `CAPS 데이터 파싱 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      })
    }
  }
  
  // 날짜 형식 변환 (2025. 6. 19. -> 2025-06-19)
  const parseCapsDate = (dateStr: string): string | null => {
    try {
      // "2025. 6. 19." 형식 파싱
      const match = dateStr.match(/(\d{4})\. (\d{1,2})\. (\d{1,2})\.?/)
      if (match) {
        const year = match[1]
        const month = match[2].padStart(2, '0')
        const day = match[3].padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      return null
    } catch {
      return null
    }
  }
  
  // 날짜+시간을 실제 타임스탬프로 변환 (개선된 버전)
  const parseCapsDateTime = (dateStr: string, timeStr: string): Date => {
    try {
      let normalizedTimeStr = timeStr.trim()
      
      // 한국어 시간 형식 처리
      if (normalizedTimeStr.includes('오전')) {
        normalizedTimeStr = normalizedTimeStr.replace('오전 ', 'AM ')
      } else if (normalizedTimeStr.includes('오후')) {
        normalizedTimeStr = normalizedTimeStr.replace('오후 ', 'PM ')
      }
      
      // 시간 파싱 패턴들
      let match = normalizedTimeStr.match(/(AM|PM)\s+(\d{1,2}):(\d{2}):(\d{2})/)
      
      if (!match) {
        // 24시간 형식도 시도 (HH:MM:SS)
        const timeOnlyMatch = normalizedTimeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
        if (timeOnlyMatch) {
          const hours = parseInt(timeOnlyMatch[1])
          const minutes = parseInt(timeOnlyMatch[2])
          const seconds = parseInt(timeOnlyMatch[3])
          
          const date = new Date(dateStr + 'T00:00:00')
          date.setHours(hours, minutes, seconds, 0)
          return date
        }
        throw new Error(`지원하지 않는 시간 형식: ${timeStr}`)
      }
      
      const isPM = match[1] === 'PM'
      let hours = parseInt(match[2])
      const minutes = parseInt(match[3])
      const seconds = parseInt(match[4])
      
      // 12시간 -> 24시간 변환
      if (isPM && hours !== 12) hours += 12
      if (!isPM && hours === 12) hours = 0
      
      const date = new Date(dateStr + 'T00:00:00')
      date.setHours(hours, minutes, seconds, 0)
      
      // 🚨 다음날 새벽 기록 감지 및 처리
      // 새벽 6시 이전 기록은 이전 근무일의 연장으로 간주
      if (!isPM && hours < 6 && hours >= 0) {
        date.setDate(date.getDate() + 1)
      }
      
      return date
      
    } catch (error) {
      console.error(`시간 파싱 오류 [${timeStr}]:`, error)
      // 기본값으로 현재 날짜 반환
      return new Date(dateStr + 'T09:00:00')
    }
  }
  
  // CAPS 기록을 일별 출퇴근으로 그룹화 및 처리
  const processCapsRecords = (records: CapsRecord[]): ProcessedAttendance[] => {
    // 직원별, 날짜별로 그룹화
    const groupedByEmployee = new Map<string, Map<string, CapsRecord[]>>()
    
    for (const record of records) {
      if (!groupedByEmployee.has(record.name)) {
        groupedByEmployee.set(record.name, new Map())
      }
      
      const employeeRecords = groupedByEmployee.get(record.name)!
      const recordDate = record.timestamp.toISOString().split('T')[0] // 실제 근무일 기준
      
      if (!employeeRecords.has(recordDate)) {
        employeeRecords.set(recordDate, [])
      }
      
      employeeRecords.get(recordDate)!.push(record)
    }
    
    // 각 직원의 일별 기록을 출퇴근 시간으로 처리
    const processed: ProcessedAttendance[] = []
    
    for (const [employeeName, dateRecords] of groupedByEmployee) {
      for (const [date, dayRecords] of dateRecords) {
        // 시간순 정렬
        dayRecords.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        
        // 출근/퇴근 시간 계산 (caps-record-processor 로직 적용)
        const checkInRecords = dayRecords.filter(r => ['출근', '해제'].includes(r.mode))
        const checkOutRecords = dayRecords.filter(r => ['퇴근', '세트'].includes(r.mode))
        
        // 마지막 출입 기록 처리
        const lastEntryRecord = dayRecords.filter(r => r.mode === '출입').pop()
        if (lastEntryRecord && checkOutRecords.length === dayRecords.filter(r => r.mode === '세트').length) {
          // 마지막이 출입이고 그 전에 세트가 있다면, 그 세트를 퇴근으로 사용
          const previousSet = dayRecords.filter(r => r.mode === '세트' && r.timestamp < lastEntryRecord.timestamp).pop()
          if (previousSet) {
            checkOutRecords.push(previousSet)
          }
        }
        
        const attendance: ProcessedAttendance = {
          name: employeeName,
          date: date,
          records: dayRecords,
          checkIn: checkInRecords.length > 0 ? checkInRecords[0].timestamp : undefined,
          checkOut: checkOutRecords.length > 0 ? checkOutRecords[checkOutRecords.length - 1].timestamp : undefined
        }
        
        processed.push(attendance)
      }
    }
    
    return processed.sort((a, b) => a.date.localeCompare(b.date))
  }

  // CAPS 데이터를 Supabase에 업로드
  const uploadToSupabase = async () => {
    if (processedData.length === 0) {
      setUploadResult({
        success: false,
        message: '업로드할 출퇴근 데이터가 없습니다.'
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
      let uploadedDays = 0
      
      // 처리된 출퇴근 데이터를 attendance_records에 저장
      for (const attendance of processedData) {
        const userId = userNameToId.get(attendance.name.replace(/\s/g, ''))
        
        if (!userId) {
          console.warn(`사용자를 찾을 수 없음: ${attendance.name}`)
          continue
        }

        // 출근/퇴근 기록만 저장 (데이터베이스 CHECK 제약조건에 맞게)
        if (attendance.checkIn) {
          const checkInDate = attendance.checkIn.toISOString().split('T')[0]
          const checkInTime = attendance.checkIn.toTimeString().split(' ')[0]
          
          attendanceRecords.push({
            user_id: userId,
            record_date: checkInDate,
            record_time: checkInTime,
            record_timestamp: attendance.checkIn.toISOString(),
            record_type: '출근',
            reason: `CAPS 일괄 업로드`,
            source: 'caps_bulk_upload',
            is_manual: true,
            approved_by: currentUser.id,
            approved_at: new Date().toISOString(),
            location_lat: null,
            location_lng: null,
            location_accuracy: null,
            notes: `${attendance.records.length}개 CAPS 기록 중 첫 출근 기록`
          })
        }
        
        if (attendance.checkOut) {
          const checkOutDate = attendance.checkOut.toISOString().split('T')[0]
          const checkOutTime = attendance.checkOut.toTimeString().split(' ')[0]
          
          attendanceRecords.push({
            user_id: userId,
            record_date: checkOutDate,
            record_time: checkOutTime,
            record_timestamp: attendance.checkOut.toISOString(),
            record_type: '퇴근',
            reason: `CAPS 일괄 업로드`,
            source: 'caps_bulk_upload',
            is_manual: true,
            approved_by: currentUser.id,
            approved_at: new Date().toISOString(),
            location_lat: null,
            location_lng: null,
            location_accuracy: null,
            notes: `${attendance.records.length}개 CAPS 기록 중 마지막 퇴근 기록`
          })
        }
        
        uploadedDays++
      }

      // 배치 업로드
      let successCount = 0
      let errorCount = 0
      const errors = []

      // attendance_records 업로드 (ON CONFLICT를 사용한 효율적인 upsert)
      if (attendanceRecords.length > 0) {
        const { data, error: attendanceError } = await supabase
          .from('attendance_records')
          .upsert(attendanceRecords, {
            onConflict: 'user_id,record_timestamp,record_type'
          })
          .select()
        
        if (attendanceError) {
          errors.push(`CAPS 기록 업로드 오류: ${attendanceError.message}`)
          errorCount += attendanceRecords.length
        } else {
          successCount += data?.length || attendanceRecords.length
        }
      }

      // 결과 설정
      if (errors.length === 0) {
        setUploadResult({
          success: true,
          message: `✅ CAPS 데이터 업로드 완료!\n- ${uploadedDays}일간의 출퇴근 기록\n- ${successCount}건의 개별 CAPS 기록\n\n⚡ 근무시간은 데이터베이스 트리거가 자동 계산합니다.`,
          details: {
            processedDays: uploadedDays,
            totalCapsRecords: successCount,
            employeeCount: new Set(processedData.map(a => a.name)).size
          }
        })
        
        // 성공 시 데이터 초기화
        setTextData('')
        setParsedData([])
        setProcessedData([])
        
        // 콜백 호출
        if (onUploadComplete) {
          setTimeout(() => {
            onUploadComplete()
          }, 3000) // 3초 후 모달 닫기 (결과 확인 시간)
        }
      } else {
        setUploadResult({
          success: false,
          message: `CAPS 데이터 업로드 중 오류 발생:\n성공: ${successCount}건, 실패: ${errorCount}건`,
          details: { errors }
        })
      }

    } catch (error) {
      console.error('CAPS 업로드 오류:', error)
      setUploadResult({
        success: false,
        message: `CAPS 업로드 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      })
    } finally {
      setUploading(false)
    }
  }

  // CAPS 통계 계산은 렌더링에서 직접 처리

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-4">
        <Upload className="h-6 w-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-800">CAPS 출퇴근 기록 일괄 업로드</h2>
      </div>

      <div className="space-y-6">
        {/* 입력 영역 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CAPS 원본 기록 붙여넣기
          </label>
          <div className="text-xs text-gray-500 mb-2">
            CAPS 시스템에서 내보낸 원본 데이터를 그대로 붙여넣으세요. (탭 구분)<br/>
<strong>CAPS 데이터 헤더:</strong> 발생일자 → 발생시각 → 단말기ID → 사용자ID → 이름 → 사원번호 → 직급 → 구분 → 모드 → 인증 → 결과
          </div>
          <textarea
            value={textData}
            onChange={(e) => setTextData(e.target.value)}
placeholder="2025. 6. 19.	PM 4:30:33	2	7	이재혁	23		일반	퇴근	CAPS	O
2025. 6. 19.	PM 4:30:36	2	12	유희수	25		일반	퇴근	CAPS	O
2025. 6. 20.	AM 6:59:11	3	12	유희수	25		일반	세트	CAPS	O"
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
          <div className="flex space-x-2 mt-2">
            <button
              onClick={() => {
                console.log('🖱️ CAPS 데이터 파싱 버튼 클릭됨', { textDataLength: textData.length, isEmpty: !textData.trim() })
                parseTextData()
              }}
              disabled={!textData.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <FileText className="h-4 w-4 inline mr-1" />
              CAPS 데이터 파싱
            </button>
          </div>
        </div>

        {/* CAPS 원본 기록 미리보기 - 강제 표시로 디버깅 */}
        {(parsedData.length > 0 || processedData.length > 0) && (
          <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50 mt-4">
            <h3 className="text-lg font-medium text-green-800 mb-3 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ✅ CAPS 기록 파싱 결과 (CAPS: {parsedData.length}개, 출퇴근: {processedData.length}개)
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center text-blue-600">
                  <FileText className="h-4 w-4 mr-1" />
                  총 CAPS 기록
                </div>
                <div className="text-lg font-bold text-blue-900">{parsedData.length}건</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center text-green-600">
                  <Users className="h-4 w-4 mr-1" />
                  처리된 근무일
                </div>
                <div className="text-lg font-bold text-green-900">{processedData.length}일</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="flex items-center text-purple-600">
                  <Calendar className="h-4 w-4 mr-1" />
                  직원 수
                </div>
                <div className="text-lg font-bold text-purple-900">
                  {new Set(parsedData.map(r => r.name)).size}명
                </div>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center text-orange-600">
                  <Clock className="h-4 w-4 mr-1" />
                  익일 기록
                </div>
                <div className="text-lg font-bold text-orange-900">
                  {parsedData.filter(r => r.time.startsWith('AM') && parseInt(r.time.split(' ')[1].split(':')[0]) < 6).length}건
                </div>
              </div>
            </div>

            {/* 처리된 출퇴근 기록 미리보기 */}
            <div className="mb-4">
              <h4 className="text-md font-medium text-gray-700 mb-2">📋 처리된 출퇴근 기록</h4>
              <div className="max-h-48 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">직원명</th>
                      <th className="px-2 py-1 text-left">날짜</th>
                      <th className="px-2 py-1 text-left">출근시간</th>
                      <th className="px-2 py-1 text-left">퇴근시간</th>
                      <th className="px-2 py-1 text-left">기록수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedData.slice(0, 10).map((attendance, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="px-2 py-1">{attendance.name}</td>
                        <td className="px-2 py-1">{attendance.date}</td>
                        <td className="px-2 py-1">
                          {attendance.checkIn ? attendance.checkIn.toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-2 py-1">
                          {attendance.checkOut ? attendance.checkOut.toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-2 py-1">{attendance.records.length}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {processedData.length > 10 && (
                  <div className="text-center text-gray-500 py-2">
                    ... 외 {processedData.length - 10}일 더
                  </div>
                )}
              </div>
            </div>

            {/* 원본 CAPS 기록 미리보기 */}
            <div className="mb-4">
              <h4 className="text-md font-medium text-gray-700 mb-2">🔍 원본 CAPS 기록 (최근 10건)</h4>
              <div className="max-h-32 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">날짜</th>
                      <th className="px-2 py-1 text-left">시간</th>
                      <th className="px-2 py-1 text-left">이름</th>
                      <th className="px-2 py-1 text-left">모드</th>
                      <th className="px-2 py-1 text-left">인증</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((record, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="px-2 py-1">{record.date}</td>
                        <td className={`px-2 py-1 ${record.time.startsWith('AM') && parseInt(record.time.split(' ')[1].split(':')[0]) < 6 ? 'text-red-600 font-bold' : ''}`}>
                          {record.time}
                        </td>
                        <td className="px-2 py-1">{record.name}</td>
                        <td className="px-2 py-1">
                          <span className={`px-1 py-0.5 rounded text-xs ${
                            ['출근', '해제'].includes(record.mode) ? 'bg-green-100 text-green-800' :
                            ['퇴근', '세트'].includes(record.mode) ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {record.mode}
                          </span>
                        </td>
                        <td className="px-2 py-1">{record.auth}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={uploadToSupabase}
                disabled={uploading || processedData.length === 0}
                className="px-8 py-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                {uploading ? '📤 업로드 중...' : `🚀 ${processedData.length}일 출퇴근 데이터 업로드하기`}
              </button>
              <p className="text-sm text-gray-600 mt-2">
                💡 클릭하면 데이터베이스에 저장되고 근무시간이 자동 계산됩니다
              </p>
            </div>
          </div>
        )}

        {/* 결과 메시지 */}
        {uploadResult && (
          <div className={`p-4 rounded-lg border-2 ${
            uploadResult.success 
              ? 'bg-green-100 border-green-400 text-green-900' 
              : 'bg-red-100 border-red-400 text-red-900'
          } mb-4`} style={{ position: 'sticky', top: 0, zIndex: 10 }}>
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
                    처리된 근무일: {uploadResult.details.processedDays}일,<br/>
                    CAPS 기록: {uploadResult.details.totalCapsRecords}건,<br/>
                    대상 직원: {uploadResult.details.employeeCount}명
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