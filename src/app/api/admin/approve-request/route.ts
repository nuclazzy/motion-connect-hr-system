import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// Simple test GET endpoint
export async function GET() {
  try {
    return NextResponse.json({ 
      message: 'approve-request API is working',
      timestamp: new Date().toISOString(),
      status: 'ready'
    })
  } catch (error) {
    console.error('❌ GET endpoint error:', error)
    return NextResponse.json({
      error: 'GET endpoint failed',
      details: (error as Error).message
    }, { status: 500 })
  }
}

// Simplified POST handler - 기본 승인/거절 기능만
export async function POST(request: NextRequest) {
  console.log('🔍 approve-request POST 요청 수신:', {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString()
  })
  
  try {
    const requestBody = await request.json()
    const { requestId, action, adminNote } = requestBody
    
    console.log('📋 요청 파라미터:', { requestId, action, adminNote })
    
    // Basic validation
    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'Missing required parameters: requestId and action' }, 
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' }, 
        { status: 400 }
      )
    }

    // Authorization header validation
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const adminUserId = authorization.replace('Bearer ', '')

    const supabase = await createServiceRoleClient()

    // Check admin permissions
    const { data: adminUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (adminUser?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get form request
    const { data: formRequest, error: requestError } = await supabase
      .from('form_requests')
      .select(`
        *,
        users!inner(id, name, department, position)
      `)
      .eq('id', requestId)
      .single()

    if (requestError || !formRequest) {
      return NextResponse.json({ error: '서식 요청을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (formRequest.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 })
    }

    // Simple approval/rejection logic - 복잡한 로직 없이 기본만
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    
    const { error: updateError } = await supabase
      .from('form_requests')
      .update({
        status: newStatus,
        processed_at: new Date().toISOString(),
        processed_by: adminUserId,
        admin_note: adminNote
      })
      .eq('id', requestId)

    if (updateError) {
      throw new Error('처리에 실패했습니다.')
    }

    // Send simple notification
    await supabase.from('notifications').insert({
      user_id: formRequest.user_id,
      message: `${formRequest.form_type} 신청이 ${action === 'approve' ? '승인' : '거절'}되었습니다.`,
      link: '/user',
      is_read: false
    })

    console.log(`✅ ${formRequest.form_type} ${action} 완료`)

    return NextResponse.json({ 
      success: true, 
      message: `${formRequest.form_type} ${action === 'approve' ? '승인' : '거절'} 완료`
    })

  } catch (error) {
    console.error('❌ POST handler error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}