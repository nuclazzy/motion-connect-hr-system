const fs = require('fs');
const csvContent = fs.readFileSync('직원 출퇴근 관리 - 2025-07-기록.csv', 'utf-8');
const lines = csvContent.split('\n');

// 등록된 사용자 (최진아 제외)
const registeredUsers = ['김경은', '김성호', '유희수', '윤서랑', '이재혁', '장현수', '한종운', '허지현'];

// 강력한 CSV 파싱 함수
function robustCSVParse(line) {
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
    const pattern1 = /^(.+)",(.+),(.+),(.+)(.*)$/;
    const match1 = line.match(pattern1);
    if (match1) {
      const reconstructed = [
        '', '', 'WEB', '', '',
        '', '', match1[1].replace(/^"/, ''),
        match1[2], match1[3], match1[4], match1[5]
      ];
      return reconstructed;
    }
  }
  
  return values;
}

console.log('🔍 기타 사용자 미매핑 2건 분석...\n');

const unmappedOthers = [];
const allUsers = new Set();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  try {
    const values = robustCSVParse(line);
    
    if (values.length >= 4) { // 최소한 이름이 있는 위치까지
      const userName = values[4] ? values[4].trim() : '';
      if (userName) {
        allUsers.add(userName);
      }
      
      if (values.length >= 8) {
        const rawData = {
          발생일자: values[0] ? values[0].trim() : '',
          발생시각: values[1] ? values[1].trim() : '',
          이름: userName,
          구분: values[7] ? values[7].trim() : '',
          모드: values[8] ? values[8].trim() : '',
          인증: values[9] ? values[9].trim() : ''
        };
        
        // 최진아가 아니면서, 등록된 사용자가 아닌 경우
        if (rawData.이름 !== '최진아' && 
            rawData.이름 !== '' && 
            !registeredUsers.includes(rawData.이름)) {
          unmappedOthers.push({
            line: i + 1,
            name: rawData.이름,
            date: rawData.발생일자,
            time: rawData.발생시각,
            category: rawData.구분,
            mode: rawData.모드,
            auth: rawData.인증
          });
        }
      }
    }
  } catch (error) {
    // 파싱 오류 무시
  }
}

console.log(`📊 CSV의 모든 사용자: ${Array.from(allUsers).sort().join(', ')}\n`);
console.log(`📊 등록된 사용자: ${registeredUsers.join(', ')}\n`);
console.log(`📊 기타 사용자 미매핑: ${unmappedOthers.length}건\n`);

if (unmappedOthers.length > 0) {
  unmappedOthers.forEach(record => {
    console.log(`👤 ${record.line}행: ${record.name}`);
    console.log(`   날짜: ${record.date} ${record.time}`);
    console.log(`   구분: ${record.category}`);
    console.log(`   모드: ${record.mode}`);
    console.log(`   인증: ${record.auth}`);
    console.log('');
  });
} else {
  console.log('실제로는 기타 사용자 미매핑이 없습니다.');
  console.log('최진아를 제외하면 모든 사용자가 시스템에 등록되어 있습니다.');
}

// 등록되지 않은 모든 사용자 확인
const unregisteredUsers = Array.from(allUsers).filter(user => 
  !registeredUsers.includes(user)
);

console.log(`\n📋 등록되지 않은 사용자: ${unregisteredUsers.join(', ')}`);