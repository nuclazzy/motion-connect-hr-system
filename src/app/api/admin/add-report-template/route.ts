import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'
import { createServiceRoleClient } from '@/lib/supabase/server'

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

    console.log('📝 경위서 템플릿 추가 시작')

    // 기존 경위서 템플릿이 있는지 확인
    const { data: existingTemplate, error: checkError } = await supabase
      .from('form_templates')
      .select('id, name')
      .eq('name', '경위서')
      .single()

    if (existingTemplate) {
      return NextResponse.json({
        success: true,
        message: '경위서 템플릿이 이미 존재합니다.',
        template_id: existingTemplate.id
      })
    }

    // 경위서 템플릿 데이터 정의
    const reportTemplate = {
      name: '경위서',
      description: '업무 관련 사항에 대한 경위를 보고하는 서식입니다.',
      fields: [
        {
          name: '제목',
          label: '제목',
          type: 'text',
          required: true,
          placeholder: '경위서 제목을 입력해주세요'
        },
        {
          name: '작성일자',
          label: '작성일자',
          type: 'date',
          required: true,
          defaultValue: 'today'
        },
        {
          name: '보고사유',
          label: '보고사유',
          type: 'select',
          required: true,
          options: [
            '업무진행 상황 보고',
            '문제 발생 보고',
            '개선사항 제안',
            '사고 보고',
            '기타'
          ]
        },
        {
          name: '발생일시',
          label: '발생일시',
          type: 'datetime-local',
          required: true
        },
        {
          name: '발생장소',
          label: '발생장소',
          type: 'text',
          required: false,
          placeholder: '발생한 장소를 입력해주세요'
        },
        {
          name: '관련자',
          label: '관련자',
          type: 'text',
          required: false,
          placeholder: '관련된 인원을 입력해주세요'
        },
        {
          name: '경위내용',
          label: '경위 내용',
          type: 'textarea',
          required: true,
          placeholder: '상황의 경위와 내용을 상세히 기술해주세요'
        },
        {
          name: '원인분석',
          label: '원인 분석',
          type: 'textarea',
          required: false,
          placeholder: '문제의 원인이나 배경을 분석해주세요',
          condition: {
            field: '보고사유',
            operator: 'in',
            value: ['문제 발생 보고', '사고 보고']
          }
        },
        {
          name: '조치사항',
          label: '조치 사항',
          type: 'textarea',
          required: false,
          placeholder: '취한 조치나 해결 방안을 기술해주세요'
        },
        {
          name: '향후계획',
          label: '향후 계획',
          type: 'textarea',
          required: false,
          placeholder: '재발 방지책이나 향후 계획을 기술해주세요'
        },
        {
          name: '첨부파일',
          label: '첨부파일',
          type: 'text',
          required: false,
          placeholder: '관련 첨부파일이 있는 경우 기재해주세요'
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 경위서 템플릿을 데이터베이스에 삽입
    const { data: insertedTemplate, error: insertError } = await supabase
      .from('form_templates')
      .insert([reportTemplate])
      .select()
      .single()

    if (insertError) {
      console.error('❌ 경위서 템플릿 삽입 실패:', insertError)
      return NextResponse.json({
        success: false,
        error: '경위서 템플릿 추가에 실패했습니다.',
        details: insertError
      }, { status: 500 })
    }

    console.log('✅ 경위서 템플릿 추가 완료:', insertedTemplate.id)

    return NextResponse.json({
      success: true,
      message: '경위서 템플릿이 성공적으로 추가되었습니다.',
      template: {
        id: insertedTemplate.id,
        name: insertedTemplate.name,
        description: insertedTemplate.description,
        fields_count: insertedTemplate.fields.length
      }
    })

  } catch (error) {
    console.error('❌ 경위서 템플릿 추가 오류:', error)
    return NextResponse.json({
      success: false,
      error: '경위서 템플릿 추가 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}