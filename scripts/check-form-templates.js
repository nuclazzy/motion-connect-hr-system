require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkFormTemplates() {
  try {
    console.log('🔍 현재 휴가 신청서 템플릿 확인...')
    
    // 현재 템플릿 조회
    const { data: currentTemplate, error: fetchError } = await supabase
      .from('form_templates')
      .select('*')
      .eq('name', '휴가 신청서')
      .single()
    
    if (fetchError) {
      console.error('❌ 템플릿 조회 실패:', fetchError)
      return
    }
    
    console.log('📋 현재 템플릿:', currentTemplate.name)
    console.log('📅 최종 업데이트:', currentTemplate.updated_at)
    
    // fields 배열에서 휴가형태 필드 찾기
    const fields = currentTemplate.fields
    const leaveTypeField = fields.find(field => field.name === '휴가형태')
    
    if (leaveTypeField) {
      console.log('\n📝 휴가형태 필드 현재 옵션:')
      leaveTypeField.options.forEach((option, index) => {
        console.log(`  ${index + 1}. ${option}`)
      })
      
      console.log('\n✅ 총', leaveTypeField.options.length, '개의 옵션이 있습니다.')
      
      // 대체휴가/보상휴가 관련 옵션 분석
      const substituteOptions = leaveTypeField.options.filter(opt => opt.includes('대체휴가'))
      const compensatoryOptions = leaveTypeField.options.filter(opt => opt.includes('보상휴가'))
      
      console.log('\n🔄 대체휴가 관련 옵션:')
      substituteOptions.forEach(opt => console.log(`  - ${opt}`))
      
      console.log('\n💰 보상휴가 관련 옵션:')
      compensatoryOptions.forEach(opt => console.log(`  - ${opt}`))
      
    } else {
      console.log('❌ 휴가형태 필드를 찾을 수 없습니다.')
    }
    
  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error)
  }
}

checkFormTemplates()