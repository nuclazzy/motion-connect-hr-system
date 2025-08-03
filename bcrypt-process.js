const bcrypt = require('bcryptjs');

async function explainBcryptProcess() {
  const password = '0000';
  
  console.log('=== 1. 비밀번호 해시 생성 (저장/변경 시) ===');
  console.log('bcrypt.hash(password, 10) 사용');
  console.log('');
  
  const hash = await bcrypt.hash(password, 10);
  console.log('입력 비밀번호:', password);
  console.log('saltRounds:', 10);
  console.log('생성된 해시:', hash);
  console.log('');
  
  // 해시 구조 분석
  const parts = hash.split('$');
  console.log('해시 구조 분석:');
  console.log('- Algorithm:', '$' + parts[1]);
  console.log('- Cost Factor:', parts[2], '(이것이 saltRounds)');
  console.log('- Salt:', parts[3].substring(0, 22));
  console.log('- Hash:', parts[3].substring(22));
  console.log('');
  
  console.log('=== 2. 로그인 검증 (bcrypt.compare) ===');
  console.log('bcrypt.compare(password, hash) 사용');
  console.log('');
  
  console.log('입력 비밀번호:', password);
  console.log('저장된 해시:', hash);
  console.log('');
  
  console.log('bcrypt.compare 내부 과정:');
  console.log('1. 해시에서 saltRounds 추출 → 10');
  console.log('2. 해시에서 salt 추출 → ', parts[3].substring(0, 22));
  console.log('3. 입력 비밀번호를 같은 salt와 saltRounds로 해시');
  console.log('4. 결과 해시와 저장된 해시 비교');
  console.log('');
  
  const isValid = await bcrypt.compare(password, hash);
  console.log('검증 결과:', isValid ? '✅ 일치' : '❌ 불일치');
  console.log('');
  
  console.log('=== 다른 saltRounds로 생성된 해시와 비교 ===');
  const hash15 = await bcrypt.hash(password, 15);
  console.log('saltRounds 15로 생성:', hash15);
  console.log('검증 결과:', await bcrypt.compare(password, hash15) ? '✅ 일치' : '❌ 불일치');
  console.log('→ saltRounds가 달라도 검증 가능 (해시에 정보 포함)');
}

explainBcryptProcess().catch(console.error);