const fs = require('fs');

const csvContent = fs.readFileSync('직원 출퇴근 관리 - 2025-07-기록.csv', 'utf-8');
const lines = csvContent.split('\n');

const uniqueUsers = new Set();
const userStats = {};

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const values = line.split(',');
  if (values.length >= 5) {
    const userName = values[4] ? values[4].trim() : '';
    if (userName) {
      uniqueUsers.add(userName);
      userStats[userName] = (userStats[userName] || 0) + 1;
    }
  }
}

console.log('📊 CSV 파일의 모든 사용자:');
const sortedUsers = Array.from(uniqueUsers).sort();
sortedUsers.forEach(user => {
  console.log(`  ${user}: ${userStats[user]}건`);
});

console.log(`\n총 ${uniqueUsers.size}명의 사용자, ${Object.values(userStats).reduce((a,b) => a+b, 0)}건의 기록`);