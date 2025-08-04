const fs = require('fs');

// CSV 파일 읽기
const csvContent = fs.readFileSync('직원 출퇴근 관리 - 2025-07-기록.csv', 'utf-8');
const lines = csvContent.split('\n');

// 현재 매핑 로직
const recordTypeMapping = {
  '출근': '출근',
  '해제': '출근',
  '퇴근': '퇴근', 
  '세트': '퇴근'
};

// 분석 데이터
const skippedRecords = [];
const processedRecords = [];
let totalRecords = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  totalRecords++;
  
  try {
    const values = line.split(',');
    if (values.length < 8) {
      skippedRecords.push({
        line: i + 1,
        reason: '컬럼 수 부족',
        data: line
      });
      continue;
    }
    
    const rawData = {
      발생일자: values[0]?.trim(),
      발생시각: values[1]?.trim(),
      이름: values[4]?.trim(),
      구분: values[7]?.trim(),
      모드: values[8]?.trim() || '',
      인증: values[9]?.trim() || ''
    };
    
    // 모드가 매핑에 없는 경우
    if (\!recordTypeMapping[rawData.모드]) {
      skippedRecords.push({
        line: i + 1,
        reason: `모드 미매핑: '${rawData.모드}'`,
        data: rawData
      });
      continue;
    }
    
    processedRecords.push({
      line: i + 1,
      data: rawData
    });
    
  } catch (error) {
    skippedRecords.push({
      line: i + 1,
      reason: `파싱 오류: ${error.message}`,
      data: line
    });
  }
}

console.log(`📈 전체 분석 결과:`);
console.log(`  총 레코드: ${totalRecords}건`);
console.log(`  처리 예정: ${processedRecords.length}건`);
console.log(`  스킵: ${skippedRecords.length}건\n`);

// 스킵된 레코드 중 일부 예시
console.log('🔍 스킵된 레코드 예시 (처음 10개):');
skippedRecords.slice(0, 10).forEach(record => {
  if (typeof record.data === 'object') {
    console.log(`  ${record.line}행: ${record.data.이름} | ${record.data.구분} | ${record.data.모드} | ${record.data.인증}`);
  } else {
    console.log(`  ${record.line}행: ${record.data}`);
  }
});

// 모드별 통계
console.log('\n📊 모드별 통계:');
const modeStats = {};
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const values = line.split(',');
  if (values.length >= 9) {
    const mode = values[8]?.trim() || '없음';
    modeStats[mode] = (modeStats[mode] || 0) + 1;
  }
}

Object.keys(modeStats).sort((a,b) => modeStats[b] - modeStats[a]).forEach(mode => {
  const count = modeStats[mode];
  const isSupported = recordTypeMapping[mode] ? '✅' : '❌';
  console.log(`  ${isSupported} ${mode}: ${count}건`);
});

// 구분별 통계
console.log('\n📊 구분별 통계:');
const categoryStats = {};
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const values = line.split(',');
  if (values.length >= 8) {
    const category = values[7]?.trim() || '미분류';
    categoryStats[category] = (categoryStats[category] || 0) + 1;
  }
}

Object.keys(categoryStats).sort((a,b) => categoryStats[b] - categoryStats[a]).forEach(category => {
  const count = categoryStats[category];
  console.log(`  ${category}: ${count}건`);
});
EOF < /dev/null