const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수를 확인해주세요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// CSV 파일 경로
const csvFilePath = '/Users/lewis/Desktop/HR System/motion-connect/직원 출퇴근 관리 - 2025-07-기록.csv'

// 날짜/시간 변환 함수
function convertDateTime(dateStr, timeStr) {
  // console.log('날짜/시간 변환:', { dateStr, timeStr })
  
  let isoDate, formattedTime
  
  // 날짜 형식 처리
  if (dateStr.includes('. ')) {
    // "2025. 7. 8" -> "2025-07-08"
    const dateParts = dateStr.trim().split('. ')
    const year = dateParts[0]
    const month = dateParts[1].padStart(2, '0')
    const day = dateParts[2].replace('.', '').padStart(2, '0')
    isoDate = `${year}-${month}-${day}`
  } else {
    throw new Error(`지원하지 않는 날짜 형식: ${dateStr}`)
  }
  
  // 시간 형식 처리
  if (timeStr.includes('오전') || timeStr.includes('오후')) {
    // "오전 9:59:23" -> "09:59:23"
    let cleanTime = timeStr.replace('오전 ', '').replace('오후 ', '')
    const isAfternoon = timeStr.includes('오후')
    
    const timeParts = cleanTime.split(':')
    let hour = parseInt(timeParts[0])
    
    // 12시간 -> 24시간 변환
    if (isAfternoon && hour !== 12) {
      hour += 12
    } else if (!isAfternoon && hour === 12) {
      hour = 0
    }
    
    formattedTime = `${hour.toString().padStart(2, '0')}:${timeParts[1]}:${timeParts[2]}`
  } else if (timeStr.includes('AM') || timeStr.includes('PM')) {
    // "AM 10:11:38" -> "10:11:38"
    let cleanTime = timeStr.replace('AM ', '').replace('PM ', '')
    const isAfternoon = timeStr.includes('PM')
    
    const timeParts = cleanTime.split(':')
    let hour = parseInt(timeParts[0])
    
    // 12시간 -> 24시간 변환
    if (isAfternoon && hour !== 12) {
      hour += 12
    } else if (!isAfternoon && hour === 12) {
      hour = 0
    }
    
    formattedTime = `${hour.toString().padStart(2, '0')}:${timeParts[1]}:${timeParts[2]}`
  } else {
    throw new Error(`지원하지 않는 시간 형식: ${timeStr}`)
  }
  
  const result = {
    date: isoDate,
    time: formattedTime,
    timestamp: new Date(`${isoDate}T${formattedTime}+09:00`).toISOString()
  }
  
  // console.log('변환 결과:', result)
  return result
}

async function migrateJulyData() {
  try {
    console.log('📁 7월 출퇴근 데이터 마이그레이션 시작...')
    
    // CSV 파일 읽기
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8')
    const lines = csvContent.split('\n')
    
    if (lines.length < 2) {
      throw new Error('CSV 파일에 데이터가 없습니다.')
    }
    
    // 헤더 확인
    const header = lines[0].trim()
    console.log('📋 헤더:', header)
    
    // 모든 사용자 정보 조회
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
    
    if (usersError) {
      throw new Error(`사용자 조회 실패: ${usersError.message}`)
    }
    
    // 이름 -> user_id 매핑 생성
    const userMap = new Map()
    users.forEach(user => {
      userMap.set(user.name, user.id)
    })
    
    console.log('👥 사용자 매핑:', Array.from(userMap.entries()))
    
    // 데이터 파싱
    const records = []
    const errors = []
    let processedCount = 0
    let duplicateCount = 0
    let invalidUserCount = 0
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      try {
        const values = line.split(',')
        // console.log(`${i + 1}행 처리:`, values.slice(0, 8)) // 디버깅용
        
        if (values.length < 8) continue // 최소 8개 컬럼 필요
        
        const rawData = {
          발생일자: values[0]?.trim(),
          발생시각: values[1]?.trim(),
          단말기ID: values[2]?.trim(),
          사용자ID: values[3]?.trim(),
          이름: values[4]?.trim(),
          사원번호: values[5]?.trim(),
          직급: values[6]?.trim(),
          구분: values[7]?.trim(),
          모드: values[8]?.trim() || '',
          인증: values[9]?.trim() || '',
          결과: values[10]?.trim() || '',
          저녁식사: values[11]?.trim() || (values[12]?.trim() || '') // 가변 위치
        }
        
        // 실제 출퇴근 타입은 모드 컬럼에 있음
        const recordType = rawData.모드
        
        // console.log(`${i + 1}행 파싱 결과:`, {이름: rawData.이름, 모드: recordType, 발생일자: rawData.발생일자})
        
        // 출퇴근 기록만 처리
        if (recordType !== '출근' && recordType !== '퇴근') {
          // console.log(`${i + 1}행 스킵: 모드가 "${recordType}"`)
          continue
        }
        
        // 사용자 매핑 확인
        const userId = userMap.get(rawData.이름)
        if (!userId) {
          invalidUserCount++
          errors.push(`${i + 1}행: 사용자 "${rawData.이름}"을 찾을 수 없습니다.`)
          continue
        }
        
        // 날짜/시간 변환
        const { date, time, timestamp } = convertDateTime(rawData.발생일자, rawData.발생시각)
        
        // 중복 체크
        const { data: existingRecord } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('user_id', userId)
          .eq('record_date', date)
          .eq('record_time', time)
          .eq('record_type', recordType)
          .single()
        
        if (existingRecord) {
          duplicateCount++
          continue
        }
        
        // 저녁식사 여부 확인 (퇴근 시에만)
        const hadDinner = recordType === '퇴근' && rawData.저녁식사 === 'O'
        
        records.push({
          user_id: userId,
          record_date: date,
          record_time: time,
          record_timestamp: timestamp,
          record_type: recordType,
          reason: `7월 데이터 마이그레이션 (${rawData.인증})`,
          source: 'MIGRATION_JULY',
          is_manual: false,
          had_dinner: hadDinner
        })
        
        processedCount++
        
      } catch (error) {
        errors.push(`${i + 1}행: 파싱 오류 - ${error.message}`)
      }
    }
    
    console.log('📊 파싱 결과:', {
      processedCount,
      duplicateCount,
      invalidUserCount,
      errorCount: errors.length
    })
    
    if (errors.length > 0) {
      console.log('⚠️ 오류 목록:', errors.slice(0, 10))
    }
    
    // 데이터베이스에 삽입
    let insertedCount = 0
    if (records.length > 0) {
      console.log(`💾 ${records.length}건의 데이터를 데이터베이스에 삽입 중...`)
      
      // 배치 단위로 삽입 (1000건씩)
      const batchSize = 1000
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        
        const { data: insertedRecords, error: insertError } = await supabase
          .from('attendance_records')
          .insert(batch)
          .select('id')
        
        if (insertError) {
          console.error(`❌ 배치 ${Math.floor(i/batchSize) + 1} 삽입 오류:`, insertError)
          throw insertError
        }
        
        insertedCount += insertedRecords?.length || 0
        console.log(`✅ 배치 ${Math.floor(i/batchSize) + 1} 완료: ${insertedRecords?.length || 0}건`)
      }
    }
    
    console.log('🎉 7월 데이터 마이그레이션 완료!')
    console.log({
      총처리건수: processedCount,
      삽입건수: insertedCount,
      중복스킵: duplicateCount,
      사용자오류: invalidUserCount,
      오류건수: errors.length
    })
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
    process.exit(1)
  }
}

// 실행
migrateJulyData()