// 네이버 공휴일 API 테스트 스크립트
// node test-holiday-api.js 2025

const year = process.argv[2] || new Date().getFullYear()

console.log(`🔄 ${year}년 공휴일 API 테스트 시작...`)

async function testHolidayAPI() {
  try {
    // 로컬 개발 서버용
    const response = await fetch(`http://localhost:3000/api/holidays/naver?year=${year}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    console.log('📊 API 응답 결과:')
    console.log('성공:', data.success)
    console.log('데이터 소스:', data.source)
    console.log('공휴일 개수:', Object.keys(data.holidays || {}).length)
    
    if (data.holidays) {
      console.log('\n📅 공휴일 목록:')
      Object.entries(data.holidays)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, name]) => {
          const dayOfWeek = new Date(date).toLocaleDateString('ko-KR', { weekday: 'short' })
          console.log(`  ${date} (${dayOfWeek}) - ${name}`)
        })
    }
    
    if (data.error) {
      console.log('\n⚠️ 오류 정보:', data.error)
    }
    
  } catch (error) {
    console.error('❌ API 테스트 실패:', error.message)
    
    // 프로덕션 서버도 테스트
    try {
      console.log('\n🌐 프로덕션 서버 테스트...')
      const prodResponse = await fetch(`https://motion-connect-hxr9zyo25-motionsenses-projects.vercel.app/api/holidays/naver?year=${year}`)
      const prodData = await prodResponse.json()
      
      console.log('프로덕션 응답:', prodData.success ? '✅ 성공' : '❌ 실패')
      console.log('공휴일 개수:', Object.keys(prodData.holidays || {}).length)
      
    } catch (prodError) {
      console.error('❌ 프로덕션 테스트도 실패:', prodError.message)
    }
  }
}

testHolidayAPI()