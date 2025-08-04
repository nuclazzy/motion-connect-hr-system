const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수를 확인해주세요')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// CSV 파일 경로
const csvFilePath = '/Users/lewis/Desktop/HR System/motion-connect/직원 출퇴근 관리 - 2025-07-기록.csv'

// 날짜/시간 변환 함수
function convertDateTime(dateStr, timeStr) {
  let isoDate, formattedTime
  
  if (dateStr.includes('. ')) {
    const dateParts = dateStr.trim().split('. ')
    const year = dateParts[0]
    const month = dateParts[1].padStart(2, '0')
    const day = dateParts[2].replace('.', '').padStart(2, '0')
    isoDate = `${year}-${month}-${day}`
  } else {
    throw new Error(`지원하지 않는 날짜 형식: ${dateStr}`)
  }
  
  if (timeStr.includes('오전') || timeStr.includes('오후')) {
    let cleanTime = timeStr.replace('오전 ', '').replace('오후 ', '')
    const isAfternoon = timeStr.includes('오후')
    
    const timeParts = cleanTime.split(':')
    let hour = parseInt(timeParts[0])
    
    if (isAfternoon && hour !== 12) {
      hour += 12
    } else if (!isAfternoon && hour === 12) {
      hour = 0
    }
    
    formattedTime = `${hour.toString().padStart(2, '0')}:${timeParts[1]}:${timeParts[2]}`
  } else if (timeStr.includes('AM') || timeStr.includes('PM')) {
    let cleanTime = timeStr.replace('AM ', '').replace('PM ', '')
    const isAfternoon = timeStr.includes('PM')
    
    const timeParts = cleanTime.split(':')
    let hour = parseInt(timeParts[0])
    
    if (isAfternoon && hour !== 12) {
      hour += 12
    } else if (!isAfternoon && hour === 12) {
      hour = 0
    }
    
    formattedTime = `${hour.toString().padStart(2, '0')}:${timeParts[1]}:${timeParts[2]}`
  } else {
    throw new Error(`지원하지 않는 시간 형식: ${timeStr}`)
  }
  
  return {
    date: isoDate,
    time: formattedTime,
    timestamp: new Date(`${isoDate}T${formattedTime}+09:00`).toISOString()
  }
}

async function migrateJulyMinimal() {
  try {
    console.log('📁 7월 데이터 최소 마이그레이션 시작...')
    
    // CSV 파일 읽기
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8')
    const lines = csvContent.split('\n')
    
    // 모든 사용자 정보 조회
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
    
    if (usersError) {
      throw new Error(`사용자 조회 실패: ${usersError.message}`)
    }
    
    const userMap = new Map()
    users.forEach(user => {
      userMap.set(user.name, user.id)
    })
    
    console.log('👥 김경은 사용자 ID:', userMap.get('김경은'))
    
    // 김경은 데이터만 우선 테스트
    const records = []
    let processedCount = 0
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      try {
        const values = line.split(',')
        if (values.length < 8) continue
        
        const rawData = {
          발생일자: values[0]?.trim(),
          발생시각: values[1]?.trim(),
          이름: values[4]?.trim(),
          모드: values[8]?.trim() || '',
          인증: values[9]?.trim() || '',
          저녁식사: values[11]?.trim() || (values[12]?.trim() || '')
        }
        
        const recordType = rawData.모드
        
        if (recordType !== '출근' && recordType !== '퇴근') {
          continue
        }
        
        // 김경은 데이터만 처리
        if (rawData.이름 !== '김경은') {
          continue
        }
        
        const userId = userMap.get(rawData.이름)
        if (!userId) {
          continue
        }
        
        const { date, time, timestamp } = convertDateTime(rawData.발생일자, rawData.발생시각)
        const hadDinner = recordType === '퇴근' && rawData.저녁식사 === 'O'
        
        records.push({
          user_id: userId,
          record_date: date,
          record_time: time,
          record_timestamp: timestamp,
          record_type: recordType,
          reason: `7월 데이터 마이그레이션 (${rawData.인증})`,
          source: 'MIGRATION_JULY_TEST',
          is_manual: false,
          had_dinner: hadDinner
        })
        
        processedCount++
        
      } catch (error) {
        console.log(`${i + 1}행 오류:`, error.message)
      }
    }
    
    console.log(`📊 김경은 ${processedCount}건의 출퇴근 기록 준비됨`)
    
    // 작은 배치로 테스트 삽입
    if (records.length > 0) {
      console.log('💾 테스트 데이터 삽입 중...')
      
      let successCount = 0
      let errorCount = 0
      
      for (const record of records.slice(0, 5)) { // 처음 5건만 테스트
        try {
          const { error: insertError } = await supabase
            .from('attendance_records')
            .insert([record])
          
          if (insertError) {
            console.error('❌ 삽입 오류:', insertError.message)
            errorCount++
          } else {
            console.log('✅ 삽입 성공:', record.record_date, record.record_time, record.record_type)
            successCount++
          }
        } catch (err) {
          console.log('❌ 예외 오류:', err.message)
          errorCount++
        }
      }
      
      console.log(`\n📊 결과: 성공 ${successCount}건, 실패 ${errorCount}건`)
    }
    
    console.log('🎉 테스트 완료!')
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
  }
}

migrateJulyMinimal()