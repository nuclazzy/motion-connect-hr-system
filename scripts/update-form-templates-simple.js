// API를 통해 form template을 업데이트하는 스크립트
const fetch = require('node-fetch')

async function updateFormTemplates() {
  try {
    console.log('🔍 휴가 신청서 템플릿 업데이트 시작...')
    
    // API를 통해 업데이트 (Next.js API 라우트 사용)
    const response = await fetch('http://localhost:3000/api/admin/update-form-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'add_half_day_options'
      })
    })
    
    const result = await response.json()
    
    if (response.ok) {
      console.log('✅ 템플릿 업데이트 성공:', result)
    } else {
      console.error('❌ 템플릿 업데이트 실패:', result)
    }
    
  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error)
  }
}

updateFormTemplates()