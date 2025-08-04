const fs = require('fs')

// CSV 파일 경로
const csvFilePath = '/Users/lewis/Desktop/HR System/motion-connect/직원 출퇴근 관리 - 2025-07-기록.csv'

function analyzeJulyData() {
  try {
    console.log('📊 7월 CSV 데이터 전체 분석...')
    
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8')
    const lines = csvContent.split('\n')
    
    console.log(`📄 총 ${lines.length}줄 (헤더 포함)`)
    
    // 통계 수집
    const stats = {
      names: new Set(),
      recordTypes: new Set(),
      categories: new Set(),
      dateFormats: new Set(),
      timeFormats: new Set(),
      devices: new Set(),
      auths: new Set()
    }
    
    let validRecords = 0
    let invalidRecords = 0
    const sampleRecords = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      try {
        const values = line.split(',')
        
        if (values.length >= 8) {
          const record = {
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
            결과: values[10]?.trim() || ''
          }
          
          // 통계 수집
          if (record.이름) stats.names.add(record.이름)
          if (record.모드) stats.recordTypes.add(record.모드)
          if (record.구분) stats.categories.add(record.구분)
          if (record.발생일자) stats.dateFormats.add(record.발생일자.substring(0, 10))
          if (record.발생시각) {
            if (record.발생시각.includes('오전') || record.발생시각.includes('오후')) {
              stats.timeFormats.add('한국어(오전/오후)')
            } else if (record.발생시각.includes('AM') || record.발생시각.includes('PM')) {
              stats.timeFormats.add('영어(AM/PM)')
            } else {
              stats.timeFormats.add('기타')
            }
          }
          if (record.단말기ID) stats.devices.add(record.단말기ID)
          if (record.인증) stats.auths.add(record.인증)
          
          validRecords++
          
          // 샘플 수집 (처음 10개)
          if (sampleRecords.length < 10) {
            sampleRecords.push({
              줄번호: i + 1,
              이름: record.이름,
              날짜: record.발생일자,
              시간: record.발생시각,
              구분: record.구분,
              모드: record.모드,
              인증: record.인증
            })
          }
        } else {
          invalidRecords++
          console.log(`❌ ${i + 1}줄: 컬럼 수 부족 (${values.length}개)`)
        }
      } catch (error) {
        invalidRecords++
        console.log(`❌ ${i + 1}줄 파싱 오류:`, error.message)
      }
    }
    
    console.log(`\n📈 전체 통계:`)
    console.log(`  유효한 기록: ${validRecords}건`)
    console.log(`  무효한 기록: ${invalidRecords}건`)
    
    console.log(`\n👥 직원 목록 (${stats.names.size}명):`)
    Array.from(stats.names).sort().forEach(name => {
      console.log(`  - ${name}`)
    })
    
    console.log(`\n📋 모드 종류 (${stats.recordTypes.size}개):`)
    Array.from(stats.recordTypes).sort().forEach(type => {
      console.log(`  - ${type}`)
    })
    
    console.log(`\n🏷️ 구분 종류 (${stats.categories.size}개):`)
    Array.from(stats.categories).sort().forEach(cat => {
      console.log(`  - ${cat}`)
    })
    
    console.log(`\n🕒 시간 형식 (${stats.timeFormats.size}개):`)
    Array.from(stats.timeFormats).sort().forEach(format => {
      console.log(`  - ${format}`)
    })
    
    console.log(`\n📱 단말기 종류 (${stats.devices.size}개):`)
    Array.from(stats.devices).sort().forEach(device => {
      console.log(`  - ${device}`)
    })
    
    console.log(`\n🔐 인증 방식 (${stats.auths.size}개):`)
    Array.from(stats.auths).sort().forEach(auth => {
      console.log(`  - ${auth}`)
    })
    
    console.log(`\n📋 샘플 데이터:`)
    sampleRecords.forEach(sample => {
      console.log(`  ${sample.줄번호}. ${sample.이름} | ${sample.날짜} ${sample.시간} | ${sample.구분}/${sample.모드} | ${sample.인증}`)
    })
    
    // 출퇴근 기록만 카운트
    let attendanceCount = 0
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      try {
        const values = line.split(',')
        if (values.length >= 9) {
          const mode = values[8]?.trim()
          if (mode === '출근' || mode === '퇴근') {
            attendanceCount++
          }
        }
      } catch (error) {
        // 무시
      }
    }
    
    console.log(`\n🎯 실제 출퇴근 기록: ${attendanceCount}건`)
    
  } catch (error) {
    console.error('❌ 분석 실패:', error)
  }
}

analyzeJulyData()