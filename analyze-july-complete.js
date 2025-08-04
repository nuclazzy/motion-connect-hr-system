const fs = require('fs')

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

function analyzeJulyComplete() {
  try {
    console.log('📁 7월 데이터 완전 분석 시작...')
    
    // CSV 파일 읽기
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8')
    const lines = csvContent.split('\n')
    
    // 사용자 목록 (실제 시스템에 있는 사용자들)
    const validUsers = ['김경은', '최동현', '조상훈', '박승연', '김성호', '유희수', '윤서랑'] // 확장된 목록
    
    // 확장된 매핑 로직 (출입 분석)
    const recordTypeMapping = {
      // 출근 타입
      '출근': '출근',
      '해제': '출근',
      
      // 퇴근 타입  
      '퇴근': '퇴근',
      '세트': '퇴근'
      // '출입'은 별도 분석 - Google Apps Script에서는 퇴근으로 처리했지만 사용자 요청으로 제외
    }
    
    // 데이터 파싱
    const records = []
    const skippedRecords = []
    let processedCount = 0
    let skipCount = 0
    
    console.log('🔄 확장된 로직 적용:')
    console.log('  출근 타입: 출근, 해제')
    console.log('  퇴근 타입: 퇴근, 세트')  
    console.log('  출입: 사용자 요청에 따라 제외 (단순 건물 출입)')
    
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
          skippedRecords.push({
            line: i + 1,
            reason: `컬럼 수 부족 (${values.length}개)`,
            data: line.substring(0, 100) + '...'
          })
          skipCount++
          continue
        }
        
        const rawData = {
          발생일자: values[0] ? values[0].trim() : '',
          발생시각: values[1] ? values[1].trim() : '',
          단말기ID: values[2] ? values[2].trim() : '',
          사용자ID: values[3] ? values[3].trim() : '',
          이름: values[4] ? values[4].trim() : '',
          사원번호: values[5] ? values[5].trim() : '',
          직급: values[6] ? values[6].trim() : '',
          구분: values[7] ? values[7].trim() : '',
          모드: values[8] ? values[8].trim() : '',
          인증: values[9] ? values[9].trim() : '',
          결과: values[10] ? values[10].trim() : '',
          저녁식사: values[11] ? values[11].trim() : (values[12] ? values[12].trim() : '')
        }
        
        // 사용자 확인
        if (!validUsers.includes(rawData.이름)) {
          skippedRecords.push({
            line: i + 1,
            reason: `사용자 미매핑 (${rawData.이름})`,
            data: rawData
          })
          skipCount++
          continue
        }
        
        // 출입 기록 처리 - 사용자 요청에 따라 제외
        if (rawData.모드 === '출입') {
          skippedRecords.push({
            line: i + 1,
            reason: '출입 기록 (단순 건물 출입)',
            data: rawData
          })
          skipCount++
          continue
        }
        
        // 모드 매핑 확인
        const mappedRecordType = recordTypeMapping[rawData.모드]
        if (!mappedRecordType) {
          skippedRecords.push({
            line: i + 1,
            reason: `모드 미매핑 (${rawData.모드})`,
            data: rawData
          })
          skipCount++
          continue
        }
        
        // 날짜/시간 변환 시도
        try {
          const { date, time, timestamp } = convertDateTime(rawData.발생일자, rawData.발생시각)
          const hadDinner = mappedRecordType === '퇴근' && rawData.저녁식사 === 'O'
          
          records.push({
            line: i + 1,
            user_name: rawData.이름,
            record_date: date,
            record_time: time,
            record_type: mappedRecordType,
            category: rawData.구분,
            source: rawData.인증,
            had_dinner: hadDinner,
            original_mode: rawData.모드
          })
          
          processedCount++
        } catch (timeError) {
          skippedRecords.push({
            line: i + 1,
            reason: `시간 변환 오류: ${timeError.message}`,
            data: rawData
          })
          skipCount++
        }
        
      } catch (error) {
        skippedRecords.push({
          line: i + 1,
          reason: `파싱 오류: ${error.message}`,
          data: line.substring(0, 100) + '...'
        })
        skipCount++
      }
    }
    
    console.log(`\n📊 처리 결과:`)
    console.log(`  ✅ 처리된 기록: ${processedCount}건`)
    console.log(`  ⏭️ 스킵된 기록: ${skipCount}건`)
    console.log(`  📝 총 라인: ${lines.length - 1}건`)
    
    // 기록 타입별 통계
    const stats = {
      출근: records.filter(r => r.record_type === '출근').length,
      퇴근: records.filter(r => r.record_type === '퇴근').length
    }
    console.log(`  📈 출근: ${stats.출근}건, 퇴근: ${stats.퇴근}건`)
    
    // 출처별 통계
    const sourceStats = {}
    records.forEach(r => {
      sourceStats[r.source] = (sourceStats[r.source] || 0) + 1
    })
    console.log('  📊 출처별 통계:')
    Object.keys(sourceStats).forEach(source => {
      console.log(`    ${source}: ${sourceStats[source]}건`)
    })
    
    // 스킵 이유별 분석
    console.log('\n🔍 스킵 이유별 분석:')
    const skipReasons = {}
    skippedRecords.forEach(record => {
      const reason = record.reason.split(':')[0].split('(')[0].trim()
      if (!skipReasons[reason]) {
        skipReasons[reason] = []
      }
      skipReasons[reason].push(record)
    })
    
    Object.keys(skipReasons).forEach(reason => {
      const count = skipReasons[reason].length
      console.log(`  📌 ${reason}: ${count}건`)
      
      // 처음 3개 예시
      skipReasons[reason].slice(0, 3).forEach(record => {
        if (typeof record.data === 'object') {
          console.log(`    ${record.line}행: ${record.data.이름} | ${record.data.구분} | ${record.data.모드}`)
        } else {
          console.log(`    ${record.line}행: ${record.data}`)
        }
      })
      if (skipReasons[reason].length > 3) {
        console.log(`    ... 및 ${skipReasons[reason].length - 3}건 더`)
      }
    })
    
    console.log('\n🎯 결론:')
    console.log(`총 ${processedCount}건의 유효한 출퇴근 기록을 처리할 수 있습니다.`)
    console.log('주요 개선사항:')
    console.log('  - 개선된 CSV 파싱 (따옴표 내 쉼표 처리)')
    console.log('  - 출입 기록 분석 완료 (사용자 요청에 따라 제외)')
    console.log('  - 다양한 데이터 출처 지원 (WEB, CAPS, 지문인식)')
    
  } catch (error) {
    console.error('❌ 분석 실패:', error)
  }
}

analyzeJulyComplete()