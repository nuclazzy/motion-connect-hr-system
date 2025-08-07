/**
 * Google Calendar 연동 상태 진단
 */

require('dotenv').config({ path: '.env.local' })

console.log('🔍 Google Calendar 환경변수 점검:')
console.log('- GOOGLE_CALENDAR_ID:', process.env.GOOGLE_CALENDAR_ID ? '✅ 설정됨' : '❌ 없음')
console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ 설정됨' : '❌ 없음') 
console.log('- GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✅ 설정됨' : '❌ 없음')
console.log('- GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID ? '✅ 설정됨' : '❌ 없음')
console.log('- GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL ? '✅ 설정됨' : '❌ 없음')

console.log('\n🔍 실제 환경변수 값:')
Object.keys(process.env)
  .filter(key => key.includes('GOOGLE'))
  .forEach(key => {
    const value = process.env[key]
    if (value) {
      console.log(`- ${key}: ${value.substring(0, 50)}...`)
    }
  })

// Google Calendar API 임포트 테스트
try {
  const { google } = require('googleapis')
  console.log('\n✅ googleapis 라이브러리 로드 성공')
  
  // Service Account 설정 테스트
  const serviceAccountKey = {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
  }
  
  console.log('\n🔑 Service Account 설정:')
  console.log('- project_id:', serviceAccountKey.project_id ? '✅' : '❌')
  console.log('- private_key:', serviceAccountKey.private_key ? '✅' : '❌')
  console.log('- client_email:', serviceAccountKey.client_email ? '✅' : '❌')
  
} catch (error) {
  console.error('❌ googleapis 라이브러리 오류:', error.message)
}