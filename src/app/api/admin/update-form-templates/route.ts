import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminUserId = authorization.replace('Bearer ', '')
    const supabase = await createServiceRoleClient()

    // 관리자 권한 확인
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    console.log('🔄 Updating form templates with hourly leave options')

    // Get the current 휴가 신청서 template
    const { data: template, error: fetchError } = await supabase
      .from('form_templates')
      .select('*')
      .eq('name', '휴가 신청서')
      .single()

    if (fetchError || !template) {
      console.error('휴가 신청서 template not found:', fetchError)
      return NextResponse.json({
        success: false,
        error: '휴가 신청서 템플릿을 찾을 수 없습니다.'
      })
    }

    // Update the 휴가형태 field to include substitute and compensatory leave
    const updatedFields = template.fields.map((field: any) => {
      if (field.name === '휴가형태') {
        return {
          ...field,
          options: [
            "연차",
            "오전 반차", 
            "오후 반차",
            "병가",
            "대체휴가", // 토요일 근무 대체휴가 (1일 단위만)
            "보상휴가", // 일요일/공휴일 근무 보상휴가 (0.5일, 1일 단위)
            "경조사",
            "공가",
            "기타"
          ]
        }
      }
      return field
    })

    // Add validation rules for substitute and compensatory leave
    const enhancedFields = [
      ...updatedFields,
      {
        name: "휴가일수",
        type: "number",
        label: "휴가 일수",
        required: true,
        min: 0.5,
        max: 365,
        step: 0.5,
        condition: {
          field: "휴가형태",
          value: ["연차", "대체휴가", "보상휴가", "병가", "경조사", "공가", "기타"],
          operator: "in"
        },
        validation: {
          substitute_leave: {
            min: 1,
            step: 1,
            message: "대체휴가는 1일 단위로만 사용 가능합니다."
          },
          compensatory_leave: {
            min: 0.5,
            step: 0.5,
            message: "보상휴가는 0.5일(반차) 또는 1일 단위로 사용 가능합니다."
          }
        }
      }
    ]

    // Update the template in Supabase
    const { error: updateError } = await supabase
      .from('form_templates')
      .update({
        fields: enhancedFields,
        updated_at: new Date().toISOString()
      })
      .eq('id', template.id)

    if (updateError) {
      console.error('Template update error:', updateError)
      return NextResponse.json({
        success: false,
        error: '템플릿 업데이트에 실패했습니다.'
      })
    }

    console.log('✅ Form template updated with hourly leave options')

    return NextResponse.json({
      success: true,
      message: '휴가 신청서 템플릿이 대체휴가/보상휴가 옵션으로 업데이트되었습니다.',
      updated_options: enhancedFields.find(f => f.name === '휴가형태')?.options
    })

  } catch (error) {
    console.error('Form template update error:', error)
    return NextResponse.json({
      success: false,
      error: '템플릿 업데이트 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}