/**
 * 한국천문연구원 API 테스트 - 2025년 6,7,8월 공휴일 추출
 */

const API_KEY = 'VP255KCShsGZZNThSWhAt2qS05vMjkWlRbd1ebmhbizf7D7qLOEO4fu+sehXFLEAs97lyd8FlFjB3oVyNWzNjw==';
const API_BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';

async function fetchHolidaysForMonth(year, month) {
  try {
    const params = new URLSearchParams({
      ServiceKey: API_KEY,
      pageNo: '1',
      numOfRows: '100',
      solYear: year.toString(),
      solMonth: month.toString().padStart(2, '0')
    });

    const url = `${API_BASE}/getRestDeInfo?${params.toString()}`;
    console.log(`\n📅 Fetching holidays for ${year}년 ${month}월...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`API failed with status ${response.status}`);
    }

    const xml = await response.text();
    
    // XML 파싱
    const holidays = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const itemMatches = xml.match(itemRegex) || [];
    
    for (const itemMatch of itemMatches) {
      const dateNameMatch = itemMatch.match(/<dateName>([^<]+)<\/dateName>/);
      const isHolidayMatch = itemMatch.match(/<isHoliday>([^<]+)<\/isHoliday>/);
      const locdateMatch = itemMatch.match(/<locdate>([^<]+)<\/locdate>/);
      
      if (dateNameMatch && isHolidayMatch && locdateMatch) {
        const dateStr = locdateMatch[1];
        const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
        
        holidays.push({
          date: formattedDate,
          name: dateNameMatch[1],
          isHoliday: isHolidayMatch[1] === 'Y'
        });
      }
    }
    
    return holidays;
  } catch (error) {
    console.error(`Error fetching holidays for ${year}/${month}:`, error.message);
    return [];
  }
}

async function fetchHolidaysForYear(year) {
  try {
    const params = new URLSearchParams({
      ServiceKey: API_KEY,
      pageNo: '1',
      numOfRows: '100',
      solYear: year.toString()
    });

    const url = `${API_BASE}/getRestDeInfo?${params.toString()}`;
    console.log(`\n📅 Fetching all holidays for ${year}년...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`API failed with status ${response.status}`);
    }

    const xml = await response.text();
    
    // XML 파싱
    const holidays = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const itemMatches = xml.match(itemRegex) || [];
    
    for (const itemMatch of itemMatches) {
      const dateNameMatch = itemMatch.match(/<dateName>([^<]+)<\/dateName>/);
      const isHolidayMatch = itemMatch.match(/<isHoliday>([^<]+)<\/isHoliday>/);
      const locdateMatch = itemMatch.match(/<locdate>([^<]+)<\/locdate>/);
      
      if (dateNameMatch && isHolidayMatch && locdateMatch) {
        const dateStr = locdateMatch[1];
        const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
        
        holidays.push({
          date: formattedDate,
          name: dateNameMatch[1],
          isHoliday: isHolidayMatch[1] === 'Y'
        });
      }
    }
    
    return holidays;
  } catch (error) {
    console.error(`Error fetching holidays for ${year}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('한국천문연구원 API - 2025년 공휴일 조회');
  console.log('='.repeat(60));

  // 전체 연도 조회
  const yearHolidays = await fetchHolidaysForYear(2025);
  
  // 6, 7, 8월 공휴일만 필터링
  const summerMonths = ['06', '07', '08'];
  const summerHolidays = yearHolidays.filter(holiday => {
    const month = holiday.date.split('-')[1];
    return summerMonths.includes(month) && holiday.isHoliday;
  });

  console.log('\n' + '='.repeat(60));
  console.log('📌 2025년 6월, 7월, 8월 공휴일');
  console.log('='.repeat(60));
  
  if (summerHolidays.length === 0) {
    console.log('⚠️ 6-8월 중 공휴일이 없습니다.');
  } else {
    summerHolidays.forEach(holiday => {
      const month = parseInt(holiday.date.split('-')[1]);
      console.log(`${month}월: ${holiday.date} - ${holiday.name}`);
    });
  }

  // 월별 상세 조회 (대체 방법)
  console.log('\n' + '='.repeat(60));
  console.log('📌 월별 상세 조회');
  console.log('='.repeat(60));

  for (const month of [6, 7, 8]) {
    const monthHolidays = await fetchHolidaysForMonth(2025, month);
    
    console.log(`\n[${month}월 결과]`);
    const holidays = monthHolidays.filter(h => h.isHoliday);
    
    if (holidays.length === 0) {
      console.log(`  ⚠️ ${month}월에는 공휴일이 없습니다.`);
    } else {
      holidays.forEach(holiday => {
        console.log(`  • ${holiday.date}: ${holiday.name}`);
      });
    }
    
    // 공휴일이 아닌 기념일도 표시
    const memorialDays = monthHolidays.filter(h => !h.isHoliday);
    if (memorialDays.length > 0) {
      console.log(`  [기념일]`);
      memorialDays.forEach(day => {
        console.log(`    - ${day.date}: ${day.name}`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 조회 완료');
  console.log('='.repeat(60));
}

// Node.js 환경에서 실행
if (typeof window === 'undefined') {
  main().catch(console.error);
} else {
  console.log('This script should be run in Node.js environment');
}