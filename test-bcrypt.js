const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = '0000';
  const saltRounds = 10;
  
  console.log('원본 비밀번호:', password);
  console.log('Salt Rounds:', saltRounds);
  console.log('');
  
  // 해시 생성 (매번 다른 결과)
  for (let i = 1; i <= 3; i++) {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(`해시 ${i}:`, hash);
    
    // 검증 테스트
    const isValid = await bcrypt.compare(password, hash);
    console.log(`검증 ${i}:`, isValid ? '✅ 일치' : '❌ 불일치');
    console.log('');
  }
}

generateHash().catch(console.error);