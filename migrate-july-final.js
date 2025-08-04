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

async function migrateJulyFinal() {
  try {
    console.log('📁 7월 데이터 최종 마이그레이션 시작...')
    
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
    
    console.log('👥 시스템 사용자 매핑 완료:', userMap.size, '명')
    
    // CSV에서 발견된 9명의 사용자
    const csvUsers = ['김경은', '김성호', '유희수', '윤서랑', '이재혁', '장현수', '최진아', '한종운', '허지현']
    
    console.log('📊 CSV 사용자 목록:')
    csvUsers.forEach(name => {
      const hasMapping = userMap.has(name)
      console.log(`  ${hasMapping ? '✅' : '❌'} ${name}`)
    })
    
    // 매핑되지 않은 사용자 확인
    const unmappedUsers = csvUsers.filter(name => !userMap.has(name))
    if (unmappedUsers.length > 0) {
      console.log(`\n⚠️  시스템에 등록되지 않은 사용자 ${unmappedUsers.length}명:`)
      unmappedUsers.forEach(name => console.log(`  - ${name}`))
      console.log('이 사용자들의 기록은 스킵됩니다.')
    }
    
    // Google Apps Script 로직에 따른 매핑
    const recordTypeMapping = {
      // 출근 타입
      '출근': '출근',
      '해제': '출근',
      
      // 퇴근 타입  
      '퇴근': '퇴근',
      '세트': '퇴근'
      // '출입'은 제외 - 단순 건물 출입 기록
    }
    
    // 데이터 파싱
    const records = []
    let processedCount = 0
    let skipCount = 0
    const skipReasons = {}
    
    console.log('\n🔄 최종 로직 적용:')
    console.log('  출근 타입: 출근, 해제')
    console.log('  퇴근 타입: 퇴근, 세트')  
    console.log('  제외: 출입 (단순 건물 출입)')
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      try {
        // CSV 파싱 개선 (따옴표 내 쉼표 처리)
        const values = []
        let current = ''
        let inQuotes = false
        
        for (let char of line) {
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        values.push(current.trim()) // 마지막 값 추가
        
        if (values.length < 8) {
          skipReasons['컬럼 수 부족'] = (skipReasons['컬럼 수 부족'] || 0) + 1
          skipCount++
          continue
        }
        
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
          저녁식사: values[11]?.trim() || (values[12]?.trim() || '')
        }
        
        // 사용자 확인
        const userId = userMap.get(rawData.이름)
        if (!userId) {
          skipReasons['사용자 미매핑'] = (skipReasons['사용자 미매핑'] || 0) + 1
          skipCount++
          continue
        }
        
        // 출입 기록 처리 - 제외
        if (rawData.모드 === '출입') {
          skipReasons['출입 기록'] = (skipReasons['출입 기록'] || 0) + 1
          skipCount++
          continue
        }
        
        // 모드 매핑 확인
        const mappedRecordType = recordTypeMapping[rawData.모드]
        if (!mappedRecordType) {
          skipReasons['모드 미매핑'] = (skipReasons['모드 미매핑'] || 0) + 1
          skipCount++
          continue
        }
        
        // 날짜/시간 변환
        const { date, time, timestamp } = convertDateTime(rawData.발생일자, rawData.발생시각)
        const hadDinner = mappedRecordType === '퇴근' && rawData.저녁식사 === 'O'
        
        // 출처 정보 생성
        let source = 'JULY_MIG'
        if (rawData.인증 === 'WEB') source += '_WEB'
        else if (rawData.인증 === 'CAPS') source += '_CAPS'
        else if (rawData.인증.includes('지문')) source += '_FP'
        
        records.push({
          user_id: userId,
          record_date: date,
          record_time: time,
          record_timestamp: timestamp,
          record_type: mappedRecordType,
          reason: `7월 마이그레이션`,
          source: source,
          is_manual: false,
          had_dinner: hadDinner
        })
        
        processedCount++
        
      } catch (error) {
        skipReasons['파싱 오류'] = (skipReasons['파싱 오류'] || 0) + 1
        skipCount++
      }
    }
    
    console.log(`\n📊 최종 처리 결과:`)
    console.log(`  ✅ 처리된 기록: ${processedCount}건`)
    console.log(`  ⏭️ 스킵된 기록: ${skipCount}건`)
    console.log(`  📝 총 유효 기록: ${records.length}건`)
    
    // 기록 타입별 통계
    const stats = {
      출근: records.filter(r => r.record_type === '출근').length,
      퇴근: records.filter(r => r.record_type === '퇴근').length
    }
    console.log(`  📈 출근: ${stats.출근}건, 퇴근: ${stats.퇴근}건`)
    
    // 스킵 이유별 통계
    console.log('  📊 스킵 이유별 통계:')
    Object.keys(skipReasons).forEach(reason => {
      console.log(`    ${reason}: ${skipReasons[reason]}건`)
    })
    
    // 출처별 통계
    const sourceStats = {}
    records.forEach(r => {
      const baseSource = r.source.replace('JULY_MIG_', '')
      sourceStats[baseSource] = (sourceStats[baseSource] || 0) + 1
    })
    console.log('  📊 출처별 통계:')
    Object.keys(sourceStats).forEach(source => {
      console.log(`    ${source}: ${sourceStats[source]}건`)
    })
    
    if (records.length > 0) {
      console.log('\n💾 데이터베이스에 삽입 중...')
      
      // 기존 7월 마이그레이션 데이터 삭제
      const { error: deleteError } = await supabase
        .from('attendance_records')
        .delete()
        .or('source.like.MIGRATION_JULY%,source.like.JULY_MIG%')
      
      if (deleteError) {
        console.log('⚠️ 기존 마이그레이션 데이터 삭제 실패:', deleteError.message)
      } else {
        console.log('🗑️ 기존 7월 마이그레이션 데이터 삭제 완료')
      }
      
      // 새 데이터 삽입
      const { data, error } = await supabase
        .from('attendance_records')
        .insert(records)
      
      if (error) {
        throw new Error(`삽입 실패: ${error.message}`)
      }
      
      console.log('✅ 데이터베이스 삽입 완료!')
    }
    
    console.log('\n🎉 7월 데이터 최종 마이그레이션 완료!')
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
  }
}

migrateJulyFinal()