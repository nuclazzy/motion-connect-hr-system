'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { calculateCrossDateWork, isCrossDateWork } from '@/lib/cross-date-work-calculator'

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
  reason: string
  is_manual: boolean
  had_dinner?: boolean
}

// 시간 반올림 표준화 함수 (소수점 1자리)
const roundToOneDecimal = (value: number): number => {
  return Math.round(value * 10) / 10
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

  // 3개월 탄력근무제 정산 처리 함수
  const processFlexibleWorkSettlement = async (
    processedRecords: ProcessedRecord[],
    userMap: Map<string, any>
  ) => {
    try {
      const { getCurrentFlexibleWorkSettingsSync, calculateQuarterlyOvertimeAllowance } = await import('@/lib/flexible-work-utils')
      
      // 탄력근무제 설정 가져오기
      const flexSettings = getCurrentFlexibleWorkSettingsSync()
      if (!flexSettings || flexSettings.length === 0) return
      
      const currentDate = new Date().toISOString().split('T')[0]
      
      // 종료된 탄력근무제 기간 확인
      for (const setting of flexSettings) {
        if (currentDate > setting.end) {
          console.log(`📊 탄력근무제 정산 시작: ${setting.start} ~ ${setting.end}`)
          
          // 해당 기간의 모든 직원별 근무 데이터 조회
          for (const [userId, user] of userMap) {
            const { data: quarterlyData, error } = await supabase
              .from('daily_work_summary')
              .select('*')
              .eq('user_id', userId)
              .gte('work_date', setting.start)
              .lte('work_date', setting.end)
            
            if (error || !quarterlyData) continue
            
            // 3개월 총 근무시간 계산
            const totalWorkHours = quarterlyData.reduce((sum, d) => 
              sum + (d.basic_hours || 0) + (d.overtime_hours || 0), 0
            )
            const totalNightHours = quarterlyData.reduce((sum, d) => 
              sum + (d.night_hours || 0), 0
            )
            const totalSubstituteHours = quarterlyData.reduce((sum, d) => 
              sum + (d.substitute_hours || 0), 0
            )
            const totalCompensatoryHours = quarterlyData.reduce((sum, d) => 
              sum + (d.compensatory_hours || 0), 0
            )
            
            // 초과근무 수당 계산
            const overtimeAllowance = calculateQuarterlyOvertimeAllowance(
              totalWorkHours,
              setting.standard_weekly_hours,
              totalNightHours,
              totalSubstituteHours,
              totalCompensatoryHours,
              user.hourly_rate || 0
            )
            
            if (overtimeAllowance > 0) {
              console.log(`✅ ${user.name} 3개월 탄력근무제 정산: ${overtimeAllowance.toLocaleString()}원`)
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ 탄력근무제 정산 오류:', error)
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
          // 모드: 출근/퇴근/해제/세트 (CAPS 모드 기준)
          // 구분: 해제=출근, 세트=퇴근, 출입=무시, 일반=모드 따름 (CAPS 전용)
          let recordType: '출근' | '퇴근' | null = null
          
          // 1단계: 모드 컬럼 우선 확인 (CAPS 핵심 정보)
          if (record.모드 === '출근' || record.모드 === '해제') {
            recordType = '출근'
          } else if (record.모드 === '퇴근' || record.모드 === '세트') {
            recordType = '퇴근'
          }
          // 2단계: 구분 컬럼 확인 (모드가 명확하지 않을 때만)
          else if (record.구분 === '출근' || record.구분 === '해제') {
            recordType = '출근'
          } else if (record.구분 === '퇴근' || record.구분 === '세트') {
            recordType = '퇴근'
          } else if (record.구분 === '출입') {
            // 출입은 무시
            continue
          } else if (record.구분 === '일반') {
            // 일반 구분은 무시 (애매한 기록)
            console.log(`⚠️ 일반 구분 스킵: ${record.구분} / 모드: ${record.모드} (${i + 1}행)`)
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
          
          // 웹앱 데이터 처리 (GPS 정보 파싱 포함)
          let gpsLat: number | null = null
          let gpsLng: number | null = null
          
          if (record.단말기ID === '웹앱') {
            // GPS 정보 파싱 (예: "GPS: 37.559775,127.077181")
            if (record.직급 && record.직급.includes('GPS:')) {
              const gpsMatch = record.직급.match(/GPS:\s*([\d.-]+),([\d.-]+)/)
              if (gpsMatch) {
                gpsLat = parseFloat(gpsMatch[1])
                gpsLng = parseFloat(gpsMatch[2])
                console.log(`📍 GPS 정보 파싱: lat=${gpsLat}, lng=${gpsLng}`)
              }
            }
            console.log(`✅ 웹앱 데이터 처리: ${record.이름} ${record.발생일자} ${record.발생시각} ${recordType}`)
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

          // 데이터베이스 중복 체크 (날짜 기반 조회 후 메모리 체크)
          const { data: dayRecords } = await supabase
            .from('attendance_records')
            .select('id, record_timestamp, record_type')
            .eq('user_id', userId)
            .eq('record_date', recordDate)

          // JavaScript에서 중복 체크 (한글 인코딩 이슈 회피)
          const existingRecord = dayRecords?.find(r => 
            r.record_timestamp === recordTimestamp.toISOString() && 
            r.record_type === recordType
          )

          if (existingRecord) {
            duplicateCount++
            console.log(`⚠️ DB 중복 발견: ${record.이름} ${recordDate} ${recordTime} ${recordType} (원본: ${record.구분})`)
            continue
          }

          // 처리된 기록 추가 (웹앱/CAPS 구분)
          const isWebApp = record.단말기ID === '웹앱'
          const source = isWebApp ? 'WEB' : 'CAPS'
          
          // reason 설정 (웹앱과 CAPS 구분)
          let reasonText = ''
          if (isWebApp) {
            // 웹앱 데이터 reason
            if (record.구분 && record.구분.includes('누락')) {
              reasonText = `웹앱 ${recordType} - 누락 기록 보충`
            } else if (gpsLat && gpsLng) {
              reasonText = `웹앱 ${recordType} - GPS: ${gpsLat.toFixed(6)}, ${gpsLng.toFixed(6)}`
            } else {
              reasonText = `웹앱 ${recordType} 기록`
            }
          } else {
            // CAPS 데이터 reason
            reasonText = `CAPS 지문인식 (${record.인증}) - ${matchMethod} - 단말기: ${record.단말기ID}${record.구분 === '해제' || record.구분 === '세트' ? ` - 원본: ${record.구분}` : ''}`
          }
          
          processedRecords.push({
            user_id: userId,
            employee_number: record.사원번호 || undefined,
            record_date: recordDate,
            record_time: recordTime,
            record_timestamp: recordTimestamp.toISOString(),
            record_type: recordType,
            source: source,
            reason: reasonText,
            is_manual: isWebApp,  // 웹앱 데이터는 수동 입력으로 간주
            had_dinner: recordType === '퇴근' ? hasDinner : false
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
              // 1. 중복 체크 (날짜와 시간 기반으로 먼저 조회)
              const { data: dayRecords, error: checkError } = await supabase
                .from('attendance_records')
                .select('id, record_type, record_timestamp')
                .eq('user_id', record.user_id)
                .eq('record_date', record.record_date)
                
              if (checkError) {
                console.error('❌ 중복 체크 오류:', checkError)
                return { success: false, error: checkError }
              }

              // JavaScript에서 중복 체크 (한글 인코딩 이슈 회피)
              const existingRecord = dayRecords?.find(r => 
                r.record_timestamp === record.record_timestamp && 
                r.record_type === record.record_type
              )

              if (existingRecord) {
                console.log(`⚠️ 중복 기록 스킵: ${record.record_date} ${record.record_time} ${record.record_type}`)
                return { success: true, action: 'duplicate_skipped' }
              }

              // 2. 새 기록 삽입 (웹앱/CAPS 구분하여 처리)
              const isWebSource = record.source === 'WEB'
              
              // GPS 정보 파싱 (웹앱 reason에서 추출)
              let locationLat = null
              let locationLng = null
              if (isWebSource && record.reason && record.reason.includes('GPS:')) {
                const gpsMatch = record.reason.match(/GPS:\s*([\d.-]+),\s*([\d.-]+)/)
                if (gpsMatch) {
                  locationLat = parseFloat(gpsMatch[1])
                  locationLng = parseFloat(gpsMatch[2])
                }
              }
              
              const insertData: any = {
                user_id: record.user_id,
                employee_number: record.employee_number,
                record_date: record.record_date,
                record_time: record.record_time,
                record_timestamp: record.record_timestamp,
                record_type: record.record_type,
                reason: record.reason,
                location_lat: locationLat,
                location_lng: locationLng,
                location_accuracy: isWebSource && locationLat ? 10 : null, // 웹앱 GPS는 기본 정확도 10m
                source: record.source,
                had_dinner: record.had_dinner || false,
                is_manual: record.is_manual || false,
                notes: isWebSource 
                  ? `웹앱 기록 - 사원번호: ${record.employee_number || 'N/A'}`
                  : `CAPS 지문인식 기록 - 사원번호: ${record.employee_number || 'N/A'}`
                // 🔄 임시 컬럼 제거: check_in_time, check_out_time은 daily_work_summary에서만 관리
              }

              console.log('🔍 INSERT 시도할 데이터:', insertData)

              const { data: insertResult, error: insertError } = await supabase
                .from('attendance_records')
                .insert(insertData)
                .select('id, record_date, record_time, record_type')

              if (insertError) {
                // 409 Conflict는 중복 데이터이므로 경고 레벨로 처리
                if (insertError.code === '23505') {
                  console.log(`⚠️ 중복 기록 (DB 제약조건): ${record.record_date} ${record.record_time} ${record.record_type}`)
                  return { success: true, action: 'duplicate_constraint' }
                }
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
              if (result.value.action === 'inserted') {
                insertedCount++
              } else if (result.value.action === 'duplicate_skipped' || result.value.action === 'duplicate_constraint') {
                duplicateCount++
              }
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

      // 업로드된 데이터의 일자별 통계 재계산
      console.log('📊 일별/월별 통계 재계산 시작...')
      
      // 처리된 날짜와 사용자 목록 수집
      const processedDates = new Set<string>()
      const processedMonths = new Set<string>()
      const processedUserIds = new Set<string>()
      
      processedRecords.forEach(record => {
        processedDates.add(record.record_date)
        const [year, month] = record.record_date.split('-')
        processedMonths.add(`${year}-${month}`)
        if (record.user_id) {
          processedUserIds.add(record.user_id)
        }
      })
      
      // 일별 근무시간 재계산
      for (const date of processedDates) {
        for (const userId of processedUserIds) {
          // 해당일의 출퇴근 기록 조회
          const { data: dayRecords, error: dayError } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', userId)
            .eq('record_date', date)
            .order('record_timestamp')
          
          if (dayError) {
            console.error(`❌ ${date} 기록 조회 오류:`, dayError)
            continue
          }
          
          if (!dayRecords || dayRecords.length === 0) continue
          
          // 출근/퇴근 시간 찾기
          // 출근: 첫 번째 출근 기록
          const checkIn = dayRecords.find(r => r.record_type === '출근')
          // 퇴근: 마지막 퇴근 기록
          const checkOut = dayRecords.filter(r => r.record_type === '퇴근').pop()
          
          if (checkIn) {
            // 근무시간 계산
            let basicHours = 0
            let overtimeHours = 0
            let hadDinner = false
            let workStatus = ''
            
            if (checkIn && checkOut) {
              const startTime = new Date(checkIn.record_timestamp)
              const endTime = new Date(checkOut.record_timestamp)
              
              // 🔄 자정 넘김 근무시간 계산 시스템 통합
              let totalHours: number
              let crossDateCalculation: any = null
              
              if (isCrossDateWork(checkIn.record_time, checkOut.record_time)) {
                console.log(`🌙 자정 넘김 근무 감지: ${date} ${checkIn.record_time} → ${checkOut.record_time}`)
                
                try {
                  crossDateCalculation = await calculateCrossDateWork(
                    date, 
                    checkIn.record_time, 
                    checkOut.record_time,
                    60 // 점심시간 60분
                  )
                  totalHours = crossDateCalculation.totalHours
                  
                  console.log(`🌙 자정 넘김 계산 결과:`, {
                    firstDate: crossDateCalculation.firstDate,
                    secondDate: crossDateCalculation.secondDate,
                    totalHours: totalHours.toFixed(2),
                    basicHours: crossDateCalculation.basicHours,
                    overtimeHours: crossDateCalculation.overtimeHours,
                    warnings: crossDateCalculation.warnings
                  })
                } catch (error) {
                  console.error('❌ 자정 넘김 계산 오류, 기본 계산으로 fallback:', error)
                  const diffMs = endTime.getTime() - startTime.getTime()
                  totalHours = diffMs / (1000 * 60 * 60)
                }
              } else {
                // 일반적인 단일 날짜 근무
                const diffMs = endTime.getTime() - startTime.getTime()
                totalHours = diffMs / (1000 * 60 * 60)
              }
              
              console.log(`📊 ${date} 근무시간 계산:`, {
                checkIn: checkIn.record_time,
                checkOut: checkOut.record_time,
                totalHours: totalHours.toFixed(2),
                isCrossDate: !!crossDateCalculation,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
              })
              
              // 🔄 자정 넘김 계산 결과 활용 또는 기존 로직 사용
              let workHours: number
              
              if (crossDateCalculation) {
                // 자정 넘김 계산 시스템의 결과 사용 (이미 휴게시간 차감 완료)
                workHours = crossDateCalculation.totalHours
                basicHours = crossDateCalculation.basicHours
                overtimeHours = crossDateCalculation.overtimeHours
                
                // 저녁식사 여부는 기존 로직으로 판단 (자정 넘김과 별개)
                const webAppDinnerRecord = dayRecords.find(r => 
                  r.source === 'web' && r.had_dinner === true
                )
                const shouldHaveDinner = endTime.getHours() >= 19 || 
                  (endTime.getHours() === 18 && endTime.getMinutes() >= 30)
                
                if (shouldHaveDinner && webAppDinnerRecord) {
                  hadDinner = true
                  console.log(`✅ 자정 넘김: 웹앱 저녁식사 기록 확인됨`)
                } else if (shouldHaveDinner) {
                  hadDinner = true
                  console.log(`✅ 자정 넘김: 저녁식사 시간 자동 적용`)
                }
                
                console.log(`🌙 자정 넘김 최종 결과: 기본 ${basicHours}h, 연장 ${overtimeHours}h`)
              } else {
                // 기존 GAS 로직과 동일하게 휴게시간 계산
                const workMinutes = totalHours * 60
                let breakMinutes = 0
                
                // 점심시간 차감 (4시간 이상 근무 시 60분) - GAS 라인 94-95
                if (workMinutes >= 240) {
                  breakMinutes += 60
                }
                
                // 저녁식사 시간 차감 (GAS와 동일하게 60분) - GAS 라인 966
                // 중복 차감 방지를 위한 로직 개선
                
                // 1. 웹앱에서 이미 저녁식사를 체크했는지 확인
                const webAppDinnerRecord = dayRecords.find(r => 
                  r.source === 'web' && r.had_dinner === true
                )
                
                // 2. CAPS 기록에서 저녁식사 해당 시간대인지 확인
                const shouldHaveDinner = endTime.getHours() >= 19 || 
                  (endTime.getHours() === 18 && endTime.getMinutes() >= 30)
                
                // 3. 저녁식사 차감 결정 (중복 방지)
                if (shouldHaveDinner) {
                  // 웹앱에서 이미 체크했다면 그대로 사용
                  if (webAppDinnerRecord) {
                    hadDinner = true
                    breakMinutes += 60
                    console.log(`✅ 웹앱 저녁식사 기록 확인됨 (중복 차감 방지)`)
                  } 
                // CAPS에서 처리하는 경우 (웹앱 기록 없음)
                else if (checkOut && checkOut.source === 'caps') {
                  hadDinner = true  // CAPS는 자동으로 저녁식사 시간 적용
                  breakMinutes += 60
                  console.log(`✅ CAPS 저녁식사 시간 자동 적용`)
                }
              }
              
              // 실제 근무시간 계산
              workHours = (workMinutes - breakMinutes) / 60
              
              // 기본시간/연장시간 계산 (탄력근무제 고려)
              const { getOvertimeThreshold, getCurrentFlexibleWorkSettings } = await import('@/lib/flexible-work-utils')
              const flexSettings = await getCurrentFlexibleWorkSettings()
              const overtimeThreshold = getOvertimeThreshold(date, flexSettings)
              
              basicHours = Math.min(workHours, overtimeThreshold)
              overtimeHours = Math.max(0, workHours - overtimeThreshold)
            }
              
              // 야간근무 시간 계산 (22시-06시) - GAS 라인 100-106, 971-977
              let nightHours = 0
              let nightPayHours = 0  // 야간근무 수당 시간 (1.5배)
              const tempTime = new Date(startTime.getTime())
              while (tempTime < endTime) {
                const currentHour = tempTime.getHours()
                if (currentHour >= 22 || currentHour < 6) {
                  nightHours++
                }
                tempTime.setHours(tempTime.getHours() + 1)
              }
              
              // 야간근무 수당은 1.5배 지급
              nightPayHours = nightHours * 1.5
              
              // 요일 및 공휴일 확인
              const dayOfWeek = new Date(date).getDay()
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
              
              // 공휴일 데이터 연동 (holidays.ts 활용)
              const { isHolidaySync, getHolidayInfoSync } = await import('@/lib/holidays')
              const holidayInfo = getHolidayInfoSync(new Date(date))
              const isHoliday = holidayInfo.isHoliday
              
              // 휴가 캘린더와 공휴일 매칭 (텍스트 기준)
              if (isHoliday) {
                console.log(`📅 공휴일 감지: ${date} - ${holidayInfo.name}`)
              }
              
              // 대체휴가, 보상휴가 시간 계산 (토요일/일요일/공휴일 구분)
              let substituteHours = 0  // 대체휴가 (토요일)
              let compensatoryHours = 0  // 보상휴가 (일요일/공휴일)
              
              if (isWeekend || isHoliday) {
                if (dayOfWeek === 6) {  // 토요일
                  substituteHours = workHours
                  basicHours = workHours
                  overtimeHours = 0
                  nightHours = 0  // 휴일근무는 야간수당 별도 계산 안함
                } else if (dayOfWeek === 0 || isHoliday) {  // 일요일 또는 공휴일
                  // GAS 로직: 8시간까지 1.5배, 초과분 2.0배, 야간 0.5배 추가
                  const holidayExtension = Math.max(0, workHours - 8)
                  compensatoryHours = ((workHours - holidayExtension) * 1.5) + (holidayExtension * 2.0) + (nightHours * 0.5)
                  basicHours = workHours
                  overtimeHours = 0
                  nightHours = 0  // 보상 계산에 포함됨
                }
              } else {
                // 평일: 탄력근로제 기간 확인
                const { getOvertimeThreshold, getCurrentFlexibleWorkSettings } = await import('@/lib/flexible-work-utils')
                
                // 탄력근로제 설정 조회 (DB나 설정 파일에서)
                const flexSettings = await getCurrentFlexibleWorkSettings()
                const overtimeThreshold = getOvertimeThreshold(date, flexSettings)
                
                // 기본근무와 연장근무 계산
                basicHours = Math.min(workHours, overtimeThreshold)
                overtimeHours = Math.max(0, workHours - overtimeThreshold)
                
                // 주휴수당 계산 (주 40시간 이상 근무 시 일요일 유급)
                if (dayOfWeek === 0 && !isHoliday) {  // 일요일이면서 공휴일이 아닌 경우
                  // 이전 주 (월-토) 근무시간 확인
                  const weekStart = new Date(date)
                  weekStart.setDate(weekStart.getDate() - 6)  // 월요일
                  const weekEnd = new Date(date)
                  weekEnd.setDate(weekEnd.getDate() - 1)  // 토요일
                  
                  // 주간 근무시간 조회
                  const { data: weekRecords } = await supabase
                    .from('daily_work_summary')
                    .select('basic_hours, overtime_hours')
                    .eq('user_id', userId)
                    .gte('work_date', weekStart.toISOString().split('T')[0])
                    .lte('work_date', weekEnd.toISOString().split('T')[0])
                  
                  // 주간 총 근무시간 계산
                  let weeklyWorkHours = 0
                  if (weekRecords) {
                    weekRecords.forEach(record => {
                      weeklyWorkHours += (record.basic_hours || 0) + (record.overtime_hours || 0)
                    })
                  }
                  
                  // 주 40시간 이상 근무 시 일요일 주휴수당 지급
                  if (weeklyWorkHours >= 40) {
                    if (!checkIn && !checkOut) {
                      // 일요일 미출근: 8시간 주휴수당
                      basicHours = 8
                      workStatus = '주휴(유급)'
                      console.log(`📅 주휴수당 적용: ${date} (주 ${Math.round(weeklyWorkHours)}시간 근무)`)
                    } else {
                      // 일요일 출근: 기본 근무 + 8시간 주휴수당은 별도 계산 필요
                      console.log(`📅 일요일 근무 + 주휴수당 대상: ${date} (주 ${Math.round(weeklyWorkHours)}시간 근무)`)
                    }
                  }
                }
              }
              
              // 근무 상태 판별
              if (basicHours < 4) {
                workStatus = '조기퇴근'
              } else if (basicHours < 8) {
                workStatus = '조정근무'  // "단축근무"보다 부드러운 표현
              } else {
                workStatus = '정상근무'
              }
            } else if (checkIn && !checkOut) {
              // 출근만 있고 퇴근 없음
              workStatus = '퇴근누락'
            } else if (!checkIn && checkOut) {
              // 퇴근만 있고 출근 없음
              workStatus = '출근누락'
            } else {
              // 둘 다 없음
              workStatus = '기록없음'
            }
            
            // daily_work_summary 업데이트
            const { error: summaryError } = await supabase
              .from('daily_work_summary')
              .upsert({
                user_id: userId,
                work_date: date,
                check_in_time: checkIn?.record_timestamp || null,
                check_out_time: checkOut?.record_timestamp || null,
                basic_hours: roundToOneDecimal(basicHours),
                overtime_hours: roundToOneDecimal(overtimeHours),
                night_hours: 0,  // 야간근무 시간 (현재 미구현)
                substitute_hours: 0,  // 대체휴가 시간 (현재 미구현)
                compensatory_hours: 0,  // 보상휴가 시간 (현재 미구현)
                work_status: workStatus,
                had_dinner: hadDinner,
                auto_calculated: true,
                calculated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id,work_date'
              })
            
            if (summaryError) {
              console.error(`❌ ${date} daily_work_summary 업데이트 오류:`, summaryError)
            } else {
              console.log(`✅ ${date} daily_work_summary 업데이트 완료`)
            }
          }
        }
      }
      
      // 월별 통계 재계산
      for (const yearMonth of processedMonths) {
        const [year, month] = yearMonth.split('-').map(Number)
        const workMonth = `${year}-${String(month).padStart(2, '0')}-01`
        
        // 해당 월의 마지막 날 계산 (다음 달 1일의 하루 전)
        const lastDay = new Date(year, month, 0).getDate()
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
        const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        
        for (const userId of processedUserIds) {
          // 해당 월의 일별 요약 조회
          const { data: monthSummaries, error: monthError } = await supabase
            .from('daily_work_summary')
            .select('*')
            .eq('user_id', userId)
            .gte('work_date', monthStart)
            .lte('work_date', monthEnd)
          
          if (monthError) {
            console.error(`❌ ${yearMonth} 월별 요약 조회 오류:`, monthError)
            continue
          }
          
          if (!monthSummaries || monthSummaries.length === 0) continue
          
          // 통계 계산
          const stats = {
            total_work_days: monthSummaries.length,
            total_basic_hours: monthSummaries.reduce((sum, d) => sum + (d.basic_hours || 0), 0),
            total_overtime_hours: monthSummaries.reduce((sum, d) => sum + (d.overtime_hours || 0), 0),
            total_night_hours: monthSummaries.reduce((sum, d) => sum + (d.night_hours || 0), 0),
            dinner_count: monthSummaries.filter(d => d.had_dinner).length,
            late_count: 0, // TODO: 지각 계산
            early_leave_count: 0, // TODO: 조퇴 계산
            absent_count: 0 // TODO: 결근 계산
          }
          
          const avgDailyHours = stats.total_work_days > 0 
            ? (stats.total_basic_hours + stats.total_overtime_hours) / stats.total_work_days 
            : 0
          
          // monthly_work_stats 업데이트
          const { error: statsError } = await supabase
            .from('monthly_work_stats')
            .upsert({
              user_id: userId,
              work_month: workMonth,
              ...stats,
              average_daily_hours: roundToOneDecimal(avgDailyHours)
            }, {
              onConflict: 'user_id,work_month'
            })
          
          if (statsError) {
            console.error(`❌ ${yearMonth} monthly_work_stats 업데이트 오류:`, statsError)
          } else {
            console.log(`✅ ${yearMonth} monthly_work_stats 업데이트 완료`)
          }
        }
      }
      
      console.log('✅ 일별/월별 통계 재계산 완료')
      
      // 3개월 탄력근무제 정산 처리
      // await processFlexibleWorkSettlement(processedRecords, userMap) // 현재 미구현
      
      // 업로드 후 데이터 검증 (7월 데이터 확인)
      if (file.name.includes('7월')) {
        const { data: julyData, error: checkError } = await supabase
          .from('attendance_records')
          .select('*')
          .gte('record_date', '2025-07-01')
          .lte('record_date', '2025-07-31')
          .limit(5)
        
        console.log('📊 7월 attendance_records 확인:', {
          count: julyData?.length || 0,
          sample: julyData?.slice(0, 2),
          error: checkError
        })
        
        // daily_work_summary도 확인
        const { data: julySummary, error: summaryError } = await supabase
          .from('daily_work_summary')
          .select('*')
          .gte('work_date', '2025-07-01')
          .lt('work_date', '2025-08-01')
          .limit(5)
        
        console.log('📊 7월 daily_work_summary 확인:', {
          count: julySummary?.length || 0,
          sample: julySummary?.slice(0, 2),
          error: summaryError
        })
        
        // monthly_work_stats도 확인
        const { data: julyStats, error: statsError } = await supabase
          .from('monthly_work_stats')
          .select('*')
          .eq('work_month', '2025-07-01')
        
        console.log('📊 7월 monthly_work_stats 확인:', {
          count: julyStats?.length || 0,
          data: julyStats,
          error: statsError
        })
      }

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
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* 헤더 - 모바일 반응형 */}
      <div className="text-center px-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          CAPS CSV 데이터 업로드
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          CAPS 지문인식 시스템 출퇴근 데이터를 일괄 업로드하세요
        </p>
      </div>

      {/* 업로드 영역 - 모바일 최적화 */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${
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
            <RefreshCw className="h-10 w-10 sm:h-12 sm:w-12 text-blue-500 animate-spin mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-medium text-blue-600">업로드 중...</p>
            <p className="text-xs sm:text-sm text-gray-500">데이터를 처리하고 있습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              <span className="hidden sm:inline">CAPS CSV 파일을 드래그하거나 클릭하여 업로드</span>
              <span className="sm:hidden">CSV 파일 업로드</span>
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 px-4">
              지원 형식: CAPS 지문인식 시스템 .csv 파일
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
              <span className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base">
                파일 선택
              </span>
            </label>
          </div>
        )}
      </div>

      {/* 에러 표시 - 모바일 최적화 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center">
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mr-2 flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-medium text-red-800">업로드 실패</h3>
          </div>
          <p className="text-xs sm:text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* 업로드 결과 - 모바일 최적화 */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
          <div className="flex items-center mb-3 sm:mb-4">
            <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mr-2" />
            <h3 className="text-base sm:text-lg font-medium text-green-800">업로드 완료</h3>
          </div>

          {/* 파일 정보 - 모바일 최적화 */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
              <div className="flex items-center">
                <FileText className="h-4 w-4 text-gray-500 mr-2" />
                <span className="font-medium text-sm sm:text-base truncate">{result.fileName}</span>
              </div>
              <span className="text-xs sm:text-sm text-gray-500 sm:ml-2">
                ({formatFileSize(result.fileSize)})
              </span>
            </div>
          </div>

          {/* 처리 결과 통계 - 모바일 그리드 개선 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4">
            <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">{result.inserted}</div>
              <div className="text-xs sm:text-sm text-blue-800">새로 추가</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-yellow-50 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-yellow-600">{result.duplicates}</div>
              <div className="text-xs sm:text-sm text-yellow-800">중복 스킵</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-gray-600">{result.totalProcessed}</div>
              <div className="text-xs sm:text-sm text-gray-800">총 처리</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-red-50 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-red-600">{result.invalidUsers}</div>
              <div className="text-xs sm:text-sm text-red-800">사용자 오류</div>
            </div>
            <div className="text-center p-2 sm:p-3 bg-purple-50 rounded-lg col-span-2 sm:col-span-1">
              <div className="text-xl sm:text-2xl font-bold text-purple-600">{result.upsertErrors}</div>
              <div className="text-xs sm:text-sm text-purple-800">DB 오류</div>
            </div>
          </div>

          {/* 오류 목록 - 모바일 스크롤 개선 */}
          {result.errors.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                <h4 className="text-xs sm:text-sm font-medium text-orange-800">
                  처리 중 발견된 문제점 ({result.errors.length}개)
                </h4>
              </div>
              <div className="text-xs sm:text-sm text-orange-700 space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((error, index) => (
                  <div key={index} className="font-mono text-xs bg-orange-100 p-1.5 sm:p-2 rounded break-all">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 안내 메시지 - 모바일 패딩 조정 */}
          <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-green-50 rounded-lg">
            <p className="text-xs sm:text-sm text-green-800">
              ✅ 업로드된 데이터는 자동으로 근무시간이 계산되며, 출퇴근 현황에서 확인할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 사용법 안내 - 모바일 최적화 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
        <h4 className="text-xs sm:text-sm font-medium text-blue-800 mb-2">📋 사용법 안내</h4>
        <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
          <li className="break-words">• CAPS 관리 프로그램에서 "데이터 내보내기" → CSV 형식으로 저장</li>
          <li className="break-words">• 파일명 예시: "7월4주차.xls - Sheet1.csv"</li>
          <li className="break-words">• <strong>사용자 인식:</strong> 사원번호 우선, 이름 백업으로 매핑</li>
          <li className="break-words">• 중복 데이터는 자동으로 스킵되므로 안전하게 재업로드 가능</li>
          <li className="break-words">• 시스템에 등록되지 않은 사용자는 무시됩니다</li>
          <li className="break-words">• <strong>해제 → 출근</strong>, <strong>세트 → 퇴근</strong>으로 자동 변환</li>
          <li className="break-words">• "출입" 기록은 무시됩니다</li>
        </ul>
      </div>
    </div>
  )
}