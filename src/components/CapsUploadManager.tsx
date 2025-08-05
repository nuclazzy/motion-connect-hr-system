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
  record_date: string
  record_time: string
  record_timestamp: string
  record_type: '출근' | '퇴근'
  source: string
  device_id: string
  reason: string
  is_manual: boolean
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

      // 헤더 검증
      const header = lines[0].trim()
      const expectedHeader = '발생일자,발생시각,단말기ID,사용자ID,이름,사원번호,직급,구분,모드,인증,결과'
      
      if (header !== expectedHeader) {
        console.log('헤더 불일치:', { expected: expectedHeader, actual: header })
        setError('CAPS CSV 형식이 올바르지 않습니다. 헤더를 확인해주세요.')
        return
      }

      // 모든 사용자 정보 미리 조회 (성능 최적화)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name')

      if (usersError) {
        console.error('사용자 조회 오류:', usersError)
        setError('사용자 정보 조회에 실패했습니다.')
        return
      }

      // 이름 → user_id 매핑 생성
      const userMap = new Map<string, string>()
      users?.forEach(user => {
        userMap.set(user.name, user.id)
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

          // 출퇴근 기록만 처리 (출입, 해제, 세트 등은 제외)
          if (record.구분 !== '출근' && record.구분 !== '퇴근') {
            continue
          }

          // 사용자 매핑 확인
          const userId = userMap.get(record.이름)
          if (!userId) {
            invalidUserCount++
            errors.push(`${i + 1}행: 사용자 "${record.이름}"을 찾을 수 없습니다.`)
            continue
          }

          // 날짜/시간 파싱
          const recordDate = record.발생일자
          const recordTime = record.발생시각
          const recordTimestamp = new Date(`${recordDate}T${recordTime}+09:00`) // KST

          // 같은 배치 내 중복 체크 (핵심 수정사항)
          const batchKey = `${userId}-${recordTimestamp.toISOString()}-${record.구분}`
          if (batchRecordSet.has(batchKey)) {
            duplicateCount++
            console.log(`⚠️ 배치 내 중복 발견: ${record.이름} ${recordDate} ${recordTime} ${record.구분}`)
            continue
          }
          batchRecordSet.add(batchKey)

          // 데이터베이스 중복 체크
          const { data: existingRecord } = await supabase
            .from('attendance_records')
            .select('id')
            .eq('user_id', userId)
            .eq('record_timestamp', recordTimestamp.toISOString())
            .eq('record_type', record.구분)
            .single()

          if (existingRecord) {
            duplicateCount++
            console.log(`⚠️ DB 중복 발견: ${record.이름} ${recordDate} ${recordTime} ${record.구분}`)
            continue
          }

          // 처리된 기록 추가
          processedRecords.push({
            user_id: userId,
            record_date: recordDate,
            record_time: recordTime,
            record_timestamp: recordTimestamp.toISOString(),
            record_type: record.구분 as '출근' | '퇴근',
            source: 'CAPS',
            device_id: record.단말기ID,
            reason: `CAPS 지문인식 (${record.인증})`,
            is_manual: false
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

      // 안전한 UPSERT 함수를 사용하여 데이터베이스에 삽입
      let insertedCount = 0
      let upsertErrors = 0
      
      if (processedRecords.length > 0) {
        // 각 레코드를 안전한 UPSERT 함수로 개별 처리
        for (const record of processedRecords) {
          try {
            const { data: resultId, error: upsertError } = await supabase
              .rpc('safe_upsert_attendance_record', {
                p_user_id: record.user_id,
                p_record_date: record.record_date,
                p_record_time: record.record_time,
                p_record_timestamp: record.record_timestamp,
                p_record_type: record.record_type,
                p_reason: record.reason,
                p_source: record.source,
                p_is_manual: record.is_manual
              })

            if (upsertError) {
              console.error('❌ UPSERT 오류:', upsertError, 'Record:', record)
              upsertErrors++
            } else if (resultId) {
              insertedCount++
              console.log(`✅ 기록 처리 완료: ${record.record_date} ${record.record_time} ${record.record_type}`)
            }
          } catch (error) {
            console.error('❌ 개별 레코드 처리 중 예외:', error, 'Record:', record)
            upsertErrors++
          }
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
          <li>• 중복 데이터는 자동으로 스킵되므로 안전하게 재업로드 가능</li>
          <li>• 시스템에 등록되지 않은 사용자는 무시됩니다</li>
          <li>• "출입", "해제", "세트" 등 보안 기록은 제외하고 "출근", "퇴근"만 처리</li>
        </ul>
      </div>
    </div>
  )
}