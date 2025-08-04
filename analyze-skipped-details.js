const fs = require('fs');

const csvContent = fs.readFileSync('직원 출퇴근 관리 - 2025-07-기록.csv', 'utf-8');
const lines = csvContent.split('\n');

// 시스템에 등록된 사용자 (마이그레이션 결과 기준)
const registeredUsers = ['김경은', '김성호', '유희수', '윤서랑', '이재혁', '장현수', '한종운', '허지현'];

// 기존 매핑 로직
const recordTypeMapping = {
  '출근': '출근',
  '해제': '출근',
  '퇴근': '퇴근', 
  '세트': '퇴근'
};

const unregisteredUsers = [];
const parsingErrors = [];
const columnIssues = [];
const modeIssues = [];

console.log('🔍 스킵된 기록 상세 분석...\n');

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  try {
    // CSV 파싱 개선 (따옴표 내 쉼표 처리)
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
    
    if (values.length < 8) {
      columnIssues.push({
        line: i + 1,
        columns: values.length,
        data: line.substring(0, 100) + '...'
      });
      continue;
    }
    
    const rawData = {
      발생일자: values[0] ? values[0].trim() : '',
      발생시각: values[1] ? values[1].trim() : '',
      이름: values[4] ? values[4].trim() : '',
      구분: values[7] ? values[7].trim() : '',
      모드: values[8] ? values[8].trim() : '',
      인증: values[9] ? values[9].trim() : ''
    };
    
    // 미등록 사용자 체크
    if (!registeredUsers.includes(rawData.이름)) {
      unregisteredUsers.push({
        line: i + 1,
        name: rawData.이름,
        category: rawData.구분,
        mode: rawData.모드,
        auth: rawData.인증,
        date: rawData.발생일자,
        time: rawData.발생시각
      });
      continue;
    }
    
    // 모드 매핑 문제 체크
    if (rawData.모드 !== '출입' && !recordTypeMapping[rawData.모드]) {
      modeIssues.push({
        line: i + 1,
        name: rawData.이름,
        mode: rawData.모드,
        category: rawData.구분,
        data: rawData
      });
    }
    
  } catch (error) {
    parsingErrors.push({
      line: i + 1,
      error: error.message,
      data: line.substring(0, 100) + '...'
    });
  }
}

console.log('📊 미등록 사용자 상세 (15건):');
console.log(`총 ${unregisteredUsers.length}건의 미등록 사용자 기록\n`);

// 미등록 사용자별 통계
const userStats = {};
unregisteredUsers.forEach(record => {
  if (!userStats[record.name]) {
    userStats[record.name] = [];
  }
  userStats[record.name].push(record);
});

Object.keys(userStats).forEach(userName => {
  const records = userStats[userName];
  console.log(`👤 ${userName}: ${records.length}건`);
  
  // 처음 3개 예시
  records.slice(0, 3).forEach(record => {
    console.log(`  ${record.line}행: ${record.date} ${record.time} | ${record.category} | ${record.mode} | ${record.auth}`);
  });
  
  if (records.length > 3) {
    console.log(`  ... 및 ${records.length - 3}건 더`);
  }
  console.log('');
});

console.log('🔧 파싱 오류 상세:');
if (parsingErrors.length > 0) {
  console.log(`총 ${parsingErrors.length}건의 파싱 오류\n`);
  parsingErrors.forEach(error => {
    console.log(`❌ ${error.line}행: ${error.error}`);
    console.log(`   데이터: ${error.data}\n`);
  });
} else {
  console.log('파싱 오류 없음\n');
}

console.log('📋 컬럼 수 부족 상세:');
if (columnIssues.length > 0) {
  console.log(`총 ${columnIssues.length}건의 컬럼 수 부족\n`);
  columnIssues.forEach(issue => {
    console.log(`❌ ${issue.line}행: ${issue.columns}개 컬럼 (8개 필요)`);
    console.log(`   데이터: ${issue.data}\n`);
  });
} else {
  console.log('컬럼 수 부족 없음\n');
}

console.log('🔄 모드 미매핑 상세:');
if (modeIssues.length > 0) {
  console.log(`총 ${modeIssues.length}건의 모드 미매핑\n`);
  modeIssues.forEach(issue => {
    console.log(`❌ ${issue.line}행: ${issue.name} | 모드: "${issue.mode}" | 구분: ${issue.category}`);
  });
} else {
  console.log('모드 미매핑 없음\n');
}

console.log('🎯 요약:');
console.log(`- 미등록 사용자: ${Object.keys(userStats).length}명, ${unregisteredUsers.length}건`);
console.log(`- 파싱 오류: ${parsingErrors.length}건`);
console.log(`- 컬럼 수 부족: ${columnIssues.length}건`);
console.log(`- 모드 미매핑: ${modeIssues.length}건`);