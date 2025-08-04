const fs = require('fs');
const csvContent = fs.readFileSync('직원 출퇴근 관리 - 2025-07-기록.csv', 'utf-8');
const lines = csvContent.split('\n');

// 실제 마이그레이션에서 사용되는 사용자 맵 시뮬레이션
const registeredUsers = ['김경은', '김성호', '유희수', '윤서랑', '이재혁', '장현수', '한종운', '허지현'];
const userMap = new Map();
registeredUsers.forEach(name => {
  userMap.set(name, 'user-id-' + name);
});

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
  return values;
}

console.log('🔍 실제 마이그레이션 로직으로 사용자 미매핑 확인...\n');

let userMissing = 0;
const missingDetails = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  try {
    const values = robustCSVParse(line);
    
    if (values.length >= 8) {
      const rawData = {
        이름: values[4] ? values[4].trim() : '',
        구분: values[7] ? values[7].trim() : '',
        모드: values[8] ? values[8].trim() : ''
      };
      
      // 최진아 제외 체크
      if (rawData.이름 === '최진아') {
        continue;  // 최진아는 별도 카운트
      }
      
      // 출입 기록 제외
      if (rawData.모드 === '출입') {
        continue;  // 출입은 별도 카운트
      }
      
      // 사용자 매핑 체크
      const userId = userMap.get(rawData.이름);
      if (!userId) {
        userMissing++;
        missingDetails.push({
          line: i + 1,
          name: rawData.이름,
          category: rawData.구분,
          mode: rawData.모드,
          nameLength: rawData.이름.length,
          nameChars: Array.from(rawData.이름).map(c => c.charCodeAt(0)),
          rawLine: line.substring(0, 200)
        });
      }
    }
  } catch (error) {
    // 파싱 오류 무시
  }
}

console.log(`📊 사용자 미매핑: ${userMissing}건\n`);

if (missingDetails.length > 0) {
  missingDetails.forEach(detail => {
    console.log(`👤 ${detail.line}행: '${detail.name}' (길이: ${detail.nameLength})`);
    console.log(`   구분: ${detail.category}`);
    console.log(`   모드: ${detail.mode}`);
    console.log(`   문자코드: [${detail.nameChars.join(', ')}]`);
    console.log(`   원본: ${detail.rawLine}`);
    console.log('');
  });
} else {
  console.log('실제로는 사용자 미매핑이 없습니다.');
  console.log('마이그레이션 스크립트에서 다른 조건으로 스킵된 것 같습니다.');
}