require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateFormTemplates() {
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
    
    // fields 배열에서 휴가형태 필드 찾기
    const fields = currentTemplate.fields
    const updatedFields = fields.map(field => {
      if (field.name === '휴가형태') {
        console.log('🔧 휴가형태 필드 업데이트 중...')
        console.log('이전 옵션:', field.options)
        
        // 새로운 옵션 배열 (기존 + 반차 옵션)
        const newOptions = [
          "연차", 
          "오전 반차", 
          "오후 반차", 
          "병가", 
          "경조사", 
          "공가", 
          "대체휴가", 
          "대체휴가 반차", 
          "보상휴가", 
          "보상휴가 반차", 
          "기타"
        ]
        
        console.log('새로운 옵션:', newOptions)
        
        return {
          ...field,
          options: newOptions
        }
      }
      return field
    })
    
    // 템플릿 업데이트
    const { error: updateError } = await supabase
      .from('form_templates')
      .update({
        fields: updatedFields,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentTemplate.id)
    
    if (updateError) {
      console.error('❌ 템플릿 업데이트 실패:', updateError)
      return
    }
    
    console.log('✅ 휴가 신청서 템플릿 업데이트 완료!')
    
    // 업데이트 확인
    const { data: updatedTemplate, error: verifyError } = await supabase
      .from('form_templates')
      .select('*')
      .eq('name', '휴가 신청서')
      .single()
    
    if (verifyError) {
      console.error('❌ 업데이트 확인 실패:', verifyError)
      return
    }
    
    const leaveTypeField = updatedTemplate.fields.find(f => f.name === '휴가형태')
    console.log('🎉 최종 휴가형태 옵션:', leaveTypeField.options)
    
  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error)
  }
}

updateFormTemplates()