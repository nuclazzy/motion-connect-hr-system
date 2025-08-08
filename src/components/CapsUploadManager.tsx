'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'

interface UploadResult {
  fileName: string
  fileSize: number
  totalProcessed: number
  inserted: number
  duplicates: number
  invalidUsers: number
  upsertErrors: number
  errors: string[]
}

interface CapsRecord {
  발생일자: string
  발생시각: string
  단말기ID: string
  사용자ID: string
  이름: string
  사원번호: string
  직급: string
  구분: string
  모드: string
  인증: string
  결과: string
}

interface ProcessedRecord {
  user_id: string
  employee_number?: string
  record_date: string
  record_time: string
  record_timestamp: string
  record_type: '출근' | '퇴근'
  source: string
  device_id: string
  reason: string
  is_manual: boolean
  had_dinner?: boolean
}

export default function CapsUploadManager() {
  const { supabase } = useSupabase()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 컴포넌트 마운트 시 사용자 정보 로드
  useEffect(() => {
    loadCurrentUser()
  }, [])

  // 현재 사용자 정보 로드
  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser()
      setCurrentUser(user)
      if (!user || user.role !== 'admin') {
        setError('관리자 권한이 필요합니다.')
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error)
      setError('사용자 인증에 실패했습니다.')
    }
  }

  // CAPS CSV 데이터 직접 처리
  const handleFileUpload = async (file: File) => {
    if (!currentUser) {
      await loadCurrentUser()
      return
    }

    if (currentUser.role !== 'admin') {
      setError('관리자 권한이 필요합니다.')
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('CSV 파일만 업로드 가능합니다.')
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      console.log('📁 CAPS CSV 업로드 시작:', {
        fileName: file.name,
        fileSize: file.size,
        admin: currentUser.name
      })

      // CSV 파일 읽기
      const csvText = await file.text()
      const lines = csvText.split('\n')
      
      if (lines.length < 2) {
        setError('CSV 파일에 데이터가 없습니다.')
        return
      }

      // 헤더 검증 (저녁식사 컬럼 옵션)
      const header = lines[0].trim()
      const expectedHeaders = [
        '발생일자,발생시각,단말기ID,사용자ID,이름,사원번호,직급,구분,모드,인증,결과',
        '발생일자,발생시각,단말기ID,사용자ID,이름,사원번호,직급,구분,모드,인증,결과,저녁식사'
      ]
      
      const hasDinnerColumn = header.includes(',저녁식사')
      
      if (!expectedHeaders.includes(header)) {
        console.log('헤더 불일치:', { expected: expectedHeaders, actual: header })
        setError('CAPS CSV 형식이 올바르지 않습니다. 헤더를 확인해주세요.')
        return
      }

      // 모든 사용자 정보 미리 조회 (employee_number 포함)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, employee_number')

      if (usersError) {
        console.error('사용자 조회 오류:', usersError)
        setError('사용자 정보 조회에 실패했습니다.')
        return
      }

      // 사원번호 우선 → 이름 → user_id 매핑 생성
      const userByEmployeeNumberMap = new Map<string, { id: string, name: string }>()
      const userByNameMap = new Map<string, string>()
      
      users?.forEach(user => {
        // 사원번호가 있으면 사원번호 매핑에 추가
        if (user.employee_number) {
          userByEmployeeNumberMap.set(user.employee_number, { id: user.id, name: user.name })
        }
        // 이름 매핑에도 추가 (백업용)
        userByNameMap.set(user.name, user.id)
      })

      // CSV 데이터 파싱 및 변환
      const processedRecords: ProcessedRecord[] = []
      const errors: string[] = []
      let duplicateCount = 0
      let invalidUserCount = 0
      
      // 같은 배치 내 중복 방지를 위한 Set
      const batchRecordSet = new Set<string>()

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        try {
          const values = line.split(',')
          if (values.length < 11) continue

          const record: CapsRecord = {
            발생일자: values[0]?.trim(),
            발생시각: values[1]?.trim(),
            단말기ID: values[2]?.trim(),
            사용자ID: values[3]?.trim(),
            이름: values[4]?.trim(),
            사원번호: values[5]?.trim(),
            직급: values[6]?.trim(),
            구분: values[7]?.trim(),
            모드: values[8]?.trim(),
            인증: values[9]?.trim(),
            결과: values[10]?.trim()
          }
          
          // 저녁식사 정보 파싱 (있는 경우)
          const hasDinner = hasDinnerColumn && values[11]?.trim()?.toUpperCase() === 'O'

          // 구분을 출퇴근으로 변환
          // 우선순위: 모드 컬럼 → 구분 컬럼 확인
          // 모드: 출근/퇴근 (웹앱, CAPS 공통)
          // 구분: 해제=출근, 세트=퇴근, 출입=무시 (CAPS 전용)
          let recordType: '출근' | '퇴근' | null = null
          
          // 1단계: 모드 컬럼 우선 확인 (웹앱 + CAPS 공통)
          if (record.모드 === '출근') {
            recordType = '출근'
          } else if (record.모드 === '퇴근') {
            recordType = '퇴근'
          }
          // 2단계: 구분 컬럼 확인 (CAPS 전용, 모드가 없을 때)
          else if (record.구분 === '출근' || record.구분 === '해제') {
            recordType = '출근'
          } else if (record.구분 === '퇴근' || record.구분 === '세트') {
            recordType = '퇴근'
          } else if (record.구분 === '출입') {
            // 출입은 무시
            continue
          } else {
            // 기타 알 수 없는 구분도 무시
            console.log(`⚠️ 알 수 없는 구분: ${record.구분} / 모드: ${record.모드} (${i + 1}행)`)
            continue
          }

          // 사용자 매핑 확인 (사원번호 우선, 이름 백업)
          let userId: string | undefined
          let matchMethod = ''
          
          // 1순위: 사원번호 매핑
          if (record.사원번호 && userByEmployeeNumberMap.has(record.사원번호)) {
            const userInfo = userByEmployeeNumberMap.get(record.사원번호)!
            userId = userInfo.id
            matchMethod = `사원번호 ${record.사원번호}`
          }
          // 2순위: 이름 매핑 (백업)
          else if (record.이름 && userByNameMap.has(record.이름)) {
            userId = userByNameMap.get(record.이름)!
            matchMethod = `이름 ${record.이름}`
          }
          
          if (!userId) {
            invalidUserCount++
            errors.push(`${i + 1}행: 사용자를 찾을 수 없습니다 - 사원번호: "${record.사원번호}", 이름: "${record.이름}"`)
            continue
          }

          // 날짜 형식 정규화 (2025. 7. 8 -> 2025-07-08)
          const parseDateString = (dateStr: string): string => {
            // "2025. 7. 8." 또는 "2025. 7. 1." 형식 처리
            const match = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?/)
            if (match) {
              const [_, year, month, day] = match
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            }
            return dateStr // 이미 올바른 형식이면 그대로 반환
          }
          
          // 시간 형식 정규화 (오전 9:59:23 -> 09:59:23, PM 10:31:19 -> 22:31:19)
          const parseTimeString = (timeStr: string): string => {
            // "오전/오후" 한글 형식 처리
            if (timeStr.includes('오전') || timeStr.includes('오후')) {
              const isPM = timeStr.includes('오후')
              const time = timeStr.replace(/오전|오후/g, '').trim()
              const [hour, minute, second] = time.split(':').map(n => parseInt(n))
              let hour24 = hour
              if (isPM && hour !== 12) hour24 += 12
              if (!isPM && hour === 12) hour24 = 0
              return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
            }
            // "AM/PM" 영문 형식 처리
            if (timeStr.includes('AM') || timeStr.includes('PM')) {
              const isPM = timeStr.includes('PM')
              const time = timeStr.replace(/AM|PM/g, '').trim()
              const timeParts = time.split(':').map(n => parseInt(n))
              
              if (timeParts.length < 3) {
                console.warn(`⚠️ 시간 형식 오류: ${timeStr}`)
                return '00:00:00' // 기본값 반환
              }
              
              const [hour, minute, second] = timeParts
              
              // 시간 유효성 검사
              if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
                console.warn(`⚠️ 유효하지 않은 시간: ${timeStr} (${hour}:${minute}:${second})`)
                return '00:00:00' // 기본값 반환
              }
              
              let hour24 = hour
              
              // AM/PM이 있는데 이미 24시간 형식인 경우 (예: PM 13:32:00)
              if (hour >= 13 && isPM) {
                // 이미 24시간 형식으로 보임 - PM 무시
                hour24 = hour
                console.warn(`⚠️ 잘못된 형식 감지: ${timeStr} - PM을 무시하고 24시간 형식으로 처리`)
              } else if (hour >= 13 && !isPM) {
                // AM인데 13시 이상 - 24시간 형식으로 처리
                hour24 = hour
                console.warn(`⚠️ 잘못된 형식 감지: ${timeStr} - AM을 무시하고 24시간 형식으로 처리`)
              } else {
                // 정상적인 12시간 형식
                if (isPM && hour !== 12) hour24 += 12
                if (!isPM && hour === 12) hour24 = 0
              }
              
              return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
            }
            return timeStr // 이미 24시간 형식이면 그대로 반환
          }
          
          // 웹앱 데이터는 건너뛰기 (별도 처리 필요)
          if (record.단말기ID === '웹앱') {
            console.log(`⚠️ 웹앱 데이터는 건너뜁니다: ${record.이름} ${record.발생일자} ${record.발생시각}`)
            continue
          }
          
          // 날짜/시간 파싱
          const recordDate = parseDateString(record.발생일자)
          const recordTime = parseTimeString(record.발생시각)
          
          // 타임스탬프 생성 및 검증
          const recordTimestamp = new Date(`${recordDate}T${recordTime}+09:00`) // KST
          
          // 유효한 날짜인지 검증
          if (isNaN(recordTimestamp.getTime())) {
            errors.push(`${i + 1}행: 유효하지 않은 날짜/시간 - ${record.발생일자} ${record.발생시각}`)
            console.error(`❌ Invalid timestamp: ${recordDate}T${recordTime}+09:00`)
            continue
          }

          // 같은 배치 내 중복 체크 (변환된 recordType 사용)
          const batchKey = `${userId}-${recordTimestamp.toISOString()}-${recordType}`
          if (batchRecordSet.has(batchKey)) {
            duplicateCount++
            console.log(`⚠️ 배치 내 중복 발견: ${record.이름} ${recordDate} ${recordTime} ${recordType} (원본: ${record.구분})`)
            continue
          }
          batchRecordSet.add(batchKey)

          // 데이터베이스 중복 체크
          const { data: existingRecord } = await supabase
            .from('attendance_records')
            .select('id')
            .eq('user_id', userId)
            .eq('record_timestamp', recordTimestamp.toISOString())
            .eq('record_type', recordType)
            .single()

          if (existingRecord) {
            duplicateCount++
            console.log(`⚠️ DB 중복 발견: ${record.이름} ${recordDate} ${recordTime} ${recordType} (원본: ${record.구분})`)
            continue
          }

          // 처리된 기록 추가
          processedRecords.push({
            user_id: userId,
            employee_number: record.사원번호 || undefined,  // 사원번호 추가
            record_date: recordDate,
            record_time: recordTime,
            record_timestamp: recordTimestamp.toISOString(),
            record_type: recordType,
            source: 'CAPS',
            device_id: record.단말기ID,
            reason: `CAPS 지문인식 (${record.인증}) - ${matchMethod}${record.구분 === '해제' || record.구분 === '세트' ? ` - 원본: ${record.구분}` : ''}`,
            is_manual: false,
            had_dinner: recordType === '퇴근' ? hasDinner : false  // 퇴근 시에만 저녁식사 정보 적용
          })

        } catch (error) {
          errors.push(`${i + 1}행: 데이터 파싱 오류 - ${error}`)
        }
      }

      console.log('📊 CSV 파싱 결과:', {
        totalRecords: processedRecords.length,
        duplicateCount,
        invalidUserCount,
        errorCount: errors.length
      })

      // 안전한 UPSERT 방식으로 전환
      let insertedCount = 0
      let upsertErrors = 0
      
      if (processedRecords.length > 0) {
        // 1. 고유한 레코드만 필터링 (같은 배치 내 중복 완전 제거)
        const uniqueRecords = processedRecords.filter((record, index, self) => {
          const key = `${record.user_id}-${record.record_timestamp}-${record.record_type}`
          return index === self.findIndex(r => 
            `${r.user_id}-${r.record_timestamp}-${r.record_type}` === key
          )
        })

        console.log(`🔍 중복 제거 결과: ${processedRecords.length}개 → ${uniqueRecords.length}개`)

        // 2. 배치 처리로 성능 최적화 (기존 Sequential 처리 개선)
        console.log(`🚀 배치 처리 시작: ${uniqueRecords.length}개 레코드`)
        const BATCH_SIZE = 50 // 배치 크기 설정
        
        for (let i = 0; i < uniqueRecords.length; i += BATCH_SIZE) {
          const batch = uniqueRecords.slice(i, i + BATCH_SIZE)
          console.log(`📦 배치 ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(uniqueRecords.length/BATCH_SIZE)} 처리 중...`)
          
          // 배치 내 병렬 처리 (직접 INSERT/UPSERT 방식)
          const batchPromises = batch.map(async (record) => {
            try {
              // 1. 중복 체크
              const { data: existingRecord, error: checkError } = await supabase
                .from('attendance_records')
                .select('id')
                .eq('user_id', record.user_id)
                .eq('record_timestamp', record.record_timestamp)
                .eq('record_type', record.record_type)
                .maybeSingle()

              if (checkError) {
                console.error('❌ 중복 체크 오류:', checkError)
                return { success: false, error: checkError }
              }

              if (existingRecord) {
                console.log(`⚠️ 중복 기록 스킵: ${record.record_date} ${record.record_time} ${record.record_type}`)
                return { success: true, action: 'duplicate_skipped' }
              }

              // 2. 새 기록 삽입
              const { data: insertResult, error: insertError } = await supabase
                .from('attendance_records')
                .insert({
                  user_id: record.user_id,
                  employee_number: record.employee_number,
                  record_date: record.record_date,
                  record_time: record.record_time,
                  record_timestamp: record.record_timestamp,
                  record_type: record.record_type,
                  reason: record.reason,
                  source: record.source,
                  device_id: record.device_id,
                  is_manual: record.is_manual,
                  had_dinner: record.had_dinner,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .select()

              if (insertError) {
                console.error('❌ 직접 INSERT 오류:', insertError, 'Record:', record)
                return { success: false, error: insertError }
              }

              console.log(`✅ 직접 INSERT 완료: ${record.record_date} ${record.record_time} ${record.record_type}`)
              return { success: true, action: 'inserted' }
            } catch (error) {
              console.error('❌ 직접 UPSERT 처리 중 예외:', error, 'Record:', record)
              return { success: false, error }
            }
          })

          // 배치 결과 대기 및 처리
          const batchResults = await Promise.allSettled(batchPromises)
          
          // 결과 집계
          batchResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.success) {
              insertedCount++
            } else {
              upsertErrors++
            }
          })
          
          console.log(`✅ 배치 완료: 성공 ${batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length}/${batch.length}`)
        }
      }

      console.log('✅ CAPS CSV 업로드 완료:', {
        admin: currentUser.name,
        fileName: file.name,
        insertedCount,
        duplicateCount,
        invalidUserCount,
        upsertErrors
      })

      setResult({
        fileName: file.name,
        fileSize: file.size,
        totalProcessed: processedRecords.length,
        inserted: insertedCount,
        duplicates: duplicateCount,
        invalidUsers: invalidUserCount,
        upsertErrors,
        errors: errors.concat(
          upsertErrors > 0 ? [`${upsertErrors}건의 데이터베이스 UPSERT 오류가 발생했습니다.`] : []
        ).slice(0, 10) // 최대 10개 에러만 표시
      })

    } catch (err) {
      console.error('❌ CAPS CSV 업로드 오류:', err)
      setError('업로드 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">관리자 인증 확인 중...</h3>
          <p className="text-gray-600">사용자 정보를 불러오고 있습니다.</p>
        </div>
      </div>
    )
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">접근 권한 없음</h3>
          <p className="text-gray-600">관리자 권한이 필요한 기능입니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          CAPS CSV 데이터 업로드
        </h2>
        <p className="text-gray-600">
          CAPS 지문인식 시스템 출퇴근 데이터를 일괄 업로드하세요
        </p>
      </div>

      {/* 업로드 영역 */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : uploading 
            ? 'border-gray-300 bg-gray-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <RefreshCw className="h-12 w-12 text-blue-500 animate-spin mb-4" />
            <p className="text-lg font-medium text-blue-600">업로드 중...</p>
            <p className="text-sm text-gray-500">데이터를 처리하고 있습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              CAPS CSV 파일을 드래그하거나 클릭하여 업로드
            </p>
            <p className="text-sm text-gray-500 mb-4">
              지원 형식: CAPS 지문인식 시스템에서 추출한 .csv 파일
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
              <span className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                파일 선택
              </span>
            </label>
          </div>
        )}
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-500 mr-2" />
            <h3 className="text-sm font-medium text-red-800">업로드 실패</h3>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* 업로드 결과 */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
            <h3 className="text-lg font-medium text-green-800">업로드 완료</h3>
          </div>

          {/* 파일 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center mb-2">
              <FileText className="h-4 w-4 text-gray-500 mr-2" />
              <span className="font-medium">{result.fileName}</span>
              <span className="text-sm text-gray-500 ml-2">
                ({formatFileSize(result.fileSize)})
              </span>
            </div>
          </div>

          {/* 처리 결과 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{result.inserted}</div>
              <div className="text-sm text-blue-800">새로 추가</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{result.duplicates}</div>
              <div className="text-sm text-yellow-800">중복 스킵</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{result.totalProcessed}</div>
              <div className="text-sm text-gray-800">총 처리</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{result.invalidUsers}</div>
              <div className="text-sm text-red-800">사용자 오류</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{result.upsertErrors}</div>
              <div className="text-sm text-purple-800">DB 오류</div>
            </div>
          </div>

          {/* 오류 목록 */}
          {result.errors.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                <h4 className="text-sm font-medium text-orange-800">
                  처리 중 발견된 문제점 ({result.errors.length}개)
                </h4>
              </div>
              <div className="text-sm text-orange-700 space-y-1">
                {result.errors.map((error, index) => (
                  <div key={index} className="font-mono text-xs bg-orange-100 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 안내 메시지 */}
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              ✅ 업로드된 데이터는 자동으로 근무시간이 계산되며, 출퇴근 현황에서 확인할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 사용법 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">📋 사용법 안내</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• CAPS 관리 프로그램에서 "데이터 내보내기" → CSV 형식으로 저장</li>
          <li>• 파일명 예시: "7월4주차.xls - Sheet1.csv"</li>
          <li>• <strong>사용자 인식:</strong> 사원번호 우선, 이름 백업으로 매핑</li>
          <li>• 중복 데이터는 자동으로 스킵되므로 안전하게 재업로드 가능</li>
          <li>• 시스템에 등록되지 않은 사용자는 무시됩니다</li>
          <li>• <strong>해제 → 출근</strong>, <strong>세트 → 퇴근</strong>으로 자동 변환</li>
          <li>• "출입" 기록은 무시됩니다</li>
        </ul>
      </div>
    </div>
  )
}