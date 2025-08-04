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

// 강력한 CSV 파싱 함수
function robustCSVParse(line) {
  // 먼저 기본 파싱 시도
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  // 컬럼 수가 부족한 경우 특별 처리
  if (values.length < 8) {
    // 특정 패턴 감지 및 복구 시도
    
    // 패턴 1: "(텍스트)",출근,WEB,O 형태
    const pattern1 = /^(.+)",(.+),(.+),(.+)(.*)$/;
    const match1 = line.match(pattern1);
    if (match1) {
      const reconstructed = [
        '', '', 'WEB', '', '',  // 기본값들
        '', '', match1[1].replace(/^"/, ''), // 구분에 텍스트 넣기
        match1[2], match1[3], match1[4], match1[5]
      ];
      return reconstructed;
    }
    
    // 패턴 2: 텍스트",출근,WEB,O 형태  
    const pattern2 = /^(.+)",(.+),(.+),(.+)(.*)$/;
    const match2 = line.match(pattern2);
    if (match2) {
      const reconstructed = [
        '', '', 'WEB', '', '',  // 기본값들
        '', '', match2[1], // 구분에 텍스트 넣기
        match2[2], match2[3], match2[4], match2[5]
      ];
      return reconstructed;
    }
  }
  
  return values;
}

async function migrateJulyRobust() {
  try {
    console.log('📁 7월 데이터 강력한 마이그레이션 시작...')
    
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
    
    // 등록된 사용자만 (최진아 제외)
    const registeredUsers = ['김경은', '김성호', '유희수', '윤서랑', '이재혁', '장현수', '한종운', '허지현']
    
    // Google Apps Script 로직에 따른 매핑
    const recordTypeMapping = {
      // 출근 타입
      '출근': '출근',
      '해제': '출근',
      
      // 퇴근 타입  
      '퇴근': '퇴근',
      '세트': '퇴근'
      // '출입'은 제외, 빈 문자열도 특별 처리
    }
    
    // 데이터 파싱
    const records = []
    let processedCount = 0
    let skipCount = 0
    const skipReasons = {}
    const recoveredRecords = []
    
    console.log('\n🔄 강력한 파싱 로직 적용:')
    console.log('  출근 타입: 출근, 해제')
    console.log('  퇴근 타입: 퇴근, 세트')  
    console.log('  제외: 출입, 최진아')
    console.log('  특별 처리: 컬럼 부족, 모드 빈값')
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      try {
        // 강력한 CSV 파싱
        const values = robustCSVParse(line)
        
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
        
        // 최진아 제외
        if (rawData.이름 === '최진아') {
          skipReasons['최진아 제외'] = (skipReasons['최진아 제외'] || 0) + 1
          skipCount++
          continue
        }
        
        // 등록된 사용자 확인
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
        
        // 모드가 빈 문자열인 경우 특별 처리
        let mappedRecordType = recordTypeMapping[rawData.모드]
        if (!mappedRecordType && rawData.모드 === '') {
          // 구분 정보나 다른 단서로 추론
          if (rawData.구분.includes('출근') || rawData.구분.includes('출발')) {
            mappedRecordType = '출근'
            recoveredRecords.push({
              line: i + 1,
              reason: '빈 모드를 출근으로 추론',
              data: rawData
            })
          } else if (rawData.구분.includes('퇴근') || rawData.구분.includes('도착')) {
            mappedRecordType = '퇴근'
            recoveredRecords.push({
              line: i + 1,
              reason: '빈 모드를 퇴근으로 추론',
              data: rawData
            })
          } else {
            // 시간대로 추론 (오전이면 출근, 오후 늦은 시간이면 퇴근)
            if (rawData.발생시각.includes('오전') || 
                rawData.발생시각.includes('AM') || 
                (rawData.발생시각.includes('오후') && rawData.발생시각.includes('12:'))) {
              mappedRecordType = '출근'
              recoveredRecords.push({
                line: i + 1,
                reason: '시간대로 출근 추론',
                data: rawData
              })
            } else {
              mappedRecordType = '퇴근'
              recoveredRecords.push({
                line: i + 1,
                reason: '시간대로 퇴근 추론',
                data: rawData
              })
            }
          }
        }
        
        if (!mappedRecordType) {
          skipReasons['모드 미매핑'] = (skipReasons['모드 미매핑'] || 0) + 1
          skipCount++
          continue
        }
        
        // 날짜/시간 변환
        const { date, time, timestamp } = convertDateTime(rawData.발생일자, rawData.발생시각)
        const hadDinner = mappedRecordType === '퇴근' && rawData.저녁식사 === 'O'
        
        // 출처 정보 생성
        let source = 'JULY_ROBUST'
        if (rawData.인증 === 'WEB') source += '_WEB'
        else if (rawData.인증 === 'CAPS') source += '_CAPS'
        else if (rawData.인증.includes('지문')) source += '_FP'
        
        records.push({
          user_id: userId,
          record_date: date,
          record_time: time,
          record_timestamp: timestamp,
          record_type: mappedRecordType,
          reason: `7월 강력한 마이그레이션`,
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
    
    console.log(`\n📊 강력한 파싱 결과:`)
    console.log(`  ✅ 처리된 기록: ${processedCount}건`)
    console.log(`  ⏭️ 스킵된 기록: ${skipCount}건`)
    console.log(`  📝 총 유효 기록: ${records.length}건`)
    console.log(`  🔧 복구된 기록: ${recoveredRecords.length}건`)
    
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
    
    // 복구된 기록 상세
    if (recoveredRecords.length > 0) {
      console.log('\n🔧 복구된 기록 상세:')
      recoveredRecords.forEach(record => {
        console.log(`  ${record.line}행: ${record.data.이름} | ${record.reason} | 구분: ${record.data.구분}`)
      })
    }
    
    // 출처별 통계
    const sourceStats = {}
    records.forEach(r => {
      const baseSource = r.source.replace('JULY_ROBUST_', '')
      sourceStats[baseSource] = (sourceStats[baseSource] || 0) + 1
    })
    console.log('\n  📊 출처별 통계:')
    Object.keys(sourceStats).forEach(source => {
      console.log(`    ${source}: ${sourceStats[source]}건`)
    })
    
    if (records.length > 0) {
      console.log('\n💾 데이터베이스에 삽입 중...')
      
      // 기존 7월 마이그레이션 데이터 삭제
      const { error: deleteError } = await supabase
        .from('attendance_records')
        .delete()
        .or('source.like.MIGRATION_JULY%,source.like.JULY_MIG%,source.like.JULY_ROBUST%')
      
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
    
    console.log('\n🎉 7월 데이터 강력한 마이그레이션 완료!')
    console.log(`💡 이전 마이그레이션 대비 ${recoveredRecords.length}건 추가 복구!`)
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
  }
}

migrateJulyRobust()