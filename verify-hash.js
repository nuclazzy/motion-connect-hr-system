const bcrypt = require('bcryptjs');

async function verifyHash() {
  const password = '0000';
  const hashes = [
    '$2b$10$Prdk9PrJNctVXIbd3F/TFOYsF3y1MXKRj2jb4PD1hqEUJtO6HxXEK',
    '$2b$10$h/S4oz.hRPcZpoIuMHvoGO4qVz27hfAbKreOndh4HELuzhxxdYZRG',
    '$2b$10$AsLSHsOmA1cmAlJzfIRic.M5rsV64zPgQxKmCWpoLujmdB2c5kFJC'
  ];
  
  console.log(`비밀번호 '${password}' 검증 테스트:`);
  console.log('');
  
  for (let i = 0; i < hashes.length; i++) {
    const isValid = await bcrypt.compare(password, hashes[i]);
    console.log(`해시 ${i + 1}: ${isValid ? '✅ 일치' : '❌ 불일치'}`);
    console.log(`값: ${hashes[i]}`);
    console.log('');
  }
}

verifyHash().catch(console.error);