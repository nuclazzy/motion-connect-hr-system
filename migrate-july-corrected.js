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

async function migrateJulyWithCorrectLogic() {
  try {
    console.log('📁 7월 데이터 수정된 로직으로 마이그레이션 시작...')
    
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
    
    console.log('👥 사용자 매핑 완료:', userMap.size, '명')
    
    // 데이터 파싱 (수정된 로직 적용)
    const records = []
    let processedCount = 0
    let skipCount = 0
    
    const recordTypeMapping = {
      // 출근 타입
      '출근': '출근',
      '해제': '출근',
      
      // 퇴근 타입
      '퇴근': '퇴근',
      '세트': '퇴근'
      // '출입'은 제외 - 단순 건물 출입 기록
    }
    
    console.log('🔄 수정된 로직 적용:')
    console.log('  출근 타입: 출근, 해제')
    console.log('  퇴근 타입: 퇴근, 세트')
    console.log('  제외: 출입 (단순 건물 출입 기록)')
    
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
        
        const originalMode = rawData.모드
        const mappedRecordType = recordTypeMapping[originalMode]
        
        if (!mappedRecordType) {
          skipCount++
          continue
        }
        
        const userId = userMap.get(rawData.이름)
        if (!userId) {
          skipCount++
          continue
        }
        
        const { date, time, timestamp } = convertDateTime(rawData.발생일자, rawData.발생시각)
        const hadDinner = mappedRecordType === '퇴근' && rawData.저녁식사 === 'O'
        
        records.push({
          user_id: userId,
          record_date: date,
          record_time: time,
          record_timestamp: timestamp,
          record_type: mappedRecordType,
          reason: `7월 데이터 마이그레이션 (${rawData.인증}, 원본: ${originalMode})`,
          source: 'MIGRATION_JULY_CORRECTED',
          is_manual: false,
          had_dinner: hadDinner
        })
        
        processedCount++
        
      } catch (error) {
        console.log(`${i + 1}행 오류:`, error.message)
        skipCount++
      }
    }
    
    console.log(`📊 처리 결과:`)
    console.log(`  ✅ 처리된 기록: ${processedCount}건`)
    console.log(`  ⏭️ 스킵된 기록: ${skipCount}건`)
    console.log(`  📝 총 유효 기록: ${records.length}건`)
    
    // 기록 타입별 통계
    const stats = {
      출근: records.filter(r => r.record_type === '출근').length,
      퇴근: records.filter(r => r.record_type === '퇴근').length
    }
    console.log(`  📈 출근: ${stats.출근}건, 퇴근: ${stats.퇴근}건`)
    
    console.log('\n💾 데이터베이스 삽입은 PostgreSQL 트리거 수정 후 진행 가능합니다.')
    console.log('🔧 Supabase 대시보드에서 fix-trigger.sql 실행 필요')
    
    console.log('🎉 수정된 로직으로 마이그레이션 분석 완료!')
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
  }
}

migrateJulyWithCorrectLogic()