import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// GET: 테스트용 엔드포인트
export async function GET() {
  return NextResponse.json({ 
    message: 'Minimal approve-request API is working',
    timestamp: new Date().toISOString(),
    status: 'ready'
  })
}

// POST: 최소 기능 승인/거절 처리
export async function POST(request: NextRequest) {
  console.log('🔍 Minimal approve-request API called')
  
  try {
    // 1. 기본 파라미터 파싱
    const body = await request.json()
    const { requestId, action } = body
    
    console.log('📋 Parameters:', { requestId, action })
    
    // 2. 기본 검증
    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'Missing requestId or action' }, 
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' }, 
        { status: 400 }
      )
    }

    // 3. Authorization 검증 (간단하게)
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const adminUserId = authorization.replace('Bearer ', '')
    console.log('👤 Admin User ID:', adminUserId)

    // 4. Supabase 연결
    const supabase = await createServiceRoleClient()
    
    // 5. 요청 조회
    const { data: formRequest, error: requestError } = await supabase
      .from('form_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (requestError || !formRequest) {
      console.error('❌ Request not found:', requestError)
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    console.log('📄 Form request found:', formRequest.form_type)

    // 6. 상태 업데이트 (가장 기본적인 처리)
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    
    const { error: updateError } = await supabase
      .from('form_requests')
      .update({
        status: newStatus,
        processed_at: new Date().toISOString(),
        processed_by: adminUserId
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('❌ Update failed:', updateError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    console.log(`✅ Request ${action}d successfully`)

    return NextResponse.json({ 
      success: true,
      message: `Request ${action}d successfully`,
      requestId,
      newStatus
    })

  } catch (error) {
    console.error('❌ API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}