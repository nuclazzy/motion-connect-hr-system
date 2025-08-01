import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // 활성화된 폼 템플릿 조회
    const { data: templates, error } = await supabase
      .from('form_templates')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching form templates:', error)
      return NextResponse.json({ error: '폼 템플릿을 조회할 수 없습니다.' }, { status: 500 })
    }

    // fields JSONB를 파싱
    const parsedTemplates = templates.map(template => ({
      ...template,
      fields: typeof template.fields === 'string' ? JSON.parse(template.fields) : template.fields
    }))

    return NextResponse.json({ templates: parsedTemplates })
  } catch (error) {
    console.error('Form templates API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}