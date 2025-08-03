import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { calculateOvertimeLeave, getLeaveTypeName } from '@/lib/calculateOvertimeLeave'
import { CALENDAR_IDS } from '@/lib/calendarMapping'
import { createServiceRoleGoogleCalendarService } from '@/services/googleCalendarServiceAccount'
import { AuditLogger, extractRequestContext } from '@/lib/audit/audit-logger'
import { approveLeaveRequestWithTransaction } from '@/lib/supabase/leave-transaction'

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

// Main POST handler with lazy loading
export async function POST(request: NextRequest) {
  console.log('🔍 approve-request POST 요청 수신:', {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString()
  })
  
  try {
    // Parse request body first
    let requestBody
    try {
      requestBody = await request.json()
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' }, 
        { status: 400 }
      )
    }

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

    // Use direct imports instead of lazy loading
    console.log('📦 Using direct imports...')
    const serviceRoleSupabase = await createServiceRoleClient()
    console.log('✅ Supabase client created successfully')

    // Check admin permissions
    const { data: adminUser } = await serviceRoleSupabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (adminUser?.role !== 'admin') {
      console.warn('❌ Unauthorized access attempt:', { adminUserId, role: adminUser?.role })
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get form request
    const { data: formRequest, error: requestError } = await serviceRoleSupabase
      .from('form_requests')
      .select(`
        *,
        users!inner(id, name, department, position)
      `)
      .eq('id', requestId)
      .single()

    if (requestError || !formRequest) {
      console.error('❌ Form request not found:', { requestId, error: requestError })
      return NextResponse.json({ error: '서식 요청을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (formRequest.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 })
    }

    console.log('📝 Processing form request:', {
      requestId,
      formType: formRequest.form_type,
      action,
      userId: formRequest.user_id
    })

    // Process the request based on action
    if (action === 'approve') {
      await handleApproval(formRequest, adminUserId, adminNote, serviceRoleSupabase)
    } else if (action === 'reject') {
      await handleRejection(formRequest, adminUserId, adminNote, serviceRoleSupabase)
    }

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

// Separate approval handler
async function handleApproval(formRequest: any, adminUserId: string, adminNote: string | undefined, supabase: any) {
  console.log('✅ Processing approval for:', formRequest.form_type)

  if (formRequest.form_type === '휴가 신청서') {
    // Use transaction function for leave requests
    const approvalResult = await approveLeaveRequestWithTransaction(
      supabase,
      formRequest.id,
      adminUserId,
      adminNote
    )
    
    if (!approvalResult.success) {
      throw new Error('error' in approvalResult ? approvalResult.error : '휴가 승인 처리에 실패했습니다.')
    }
    
    console.log('✅ Leave approval completed via transaction')
    
  } else if (formRequest.form_type === '초과근무 신청서') {
    // Handle overtime approval with compensation leave
    await handleOvertimeApproval(formRequest, supabase)
    
    // Update form request status
    const { error: approveError } = await supabase
      .from('form_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: adminUserId,
        admin_note: adminNote
      })
      .eq('id', formRequest.id)

    if (approveError) {
      throw new Error('승인 처리에 실패했습니다.')
    }
    
  } else {
    // Handle other form types
    const { error: approveError } = await supabase
      .from('form_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: adminUserId,
        admin_note: adminNote
      })
      .eq('id', formRequest.id)

    if (approveError) {
      throw new Error('승인 처리에 실패했습니다.')
    }
  }

  // Send notification
  await sendNotification(
    supabase,
    formRequest.user_id,
    `${formRequest.form_type} 신청이 승인되었습니다.`,
    '/user'
  )

  // Log audit event
  await AuditLogger.logFormApproval(
    'APPROVE',
    adminUserId,
    formRequest,
    adminNote
  )
}

// Separate rejection handler
async function handleRejection(formRequest: any, adminUserId: string, adminNote: string | undefined, supabase: any) {
  console.log('❌ Processing rejection for:', formRequest.form_type)

  const { error: rejectError } = await supabase
    .from('form_requests')
    .update({
      status: 'rejected',
      processed_at: new Date().toISOString(),
      processed_by: adminUserId,
      admin_note: adminNote
    })
    .eq('id', formRequest.id)

  if (rejectError) {
    throw new Error('거절 처리에 실패했습니다.')
  }

  // Send notification  
  await sendNotification(
    supabase,
    formRequest.user_id,
    `${formRequest.form_type} 신청이 거절되었습니다. 사유: ${adminNote || '사유 없음'}`,
    '/user'
  )

  // Log audit event
  await AuditLogger.logFormApproval(
    'REJECT',
    adminUserId,
    formRequest,
    adminNote
  )
}

// Handle overtime approval with compensation leave
async function handleOvertimeApproval(formRequest: any, supabase: any) {
  const requestData = formRequest.request_data
  
  try {
    // Calculate compensation leave
    const overtimeResult = calculateOvertimeLeave(
      requestData.근무일,
      requestData.시작시간,
      requestData.종료시간,
      requestData['저녁식사 여부'] === '예'
    )

    // Get current employee leave data
    const { data: leaveDaysData, error: leaveDaysError } = await supabase
      .from('leave_days')
      .select('leave_types')
      .eq('user_id', formRequest.user_id)
      .single()

    if (leaveDaysError || !leaveDaysData) {
      throw new Error('직원의 휴가 정보를 조회할 수 없습니다.')
    }

    const leaveTypes = leaveDaysData.leave_types as Record<string, any>
    const fieldName = overtimeResult.leaveType === 'substitute' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
    const currentHours = leaveTypes[fieldName] || 0
    const updatedHours = currentHours + overtimeResult.compensationHours

    // Update leave data
    const updatedLeaveTypes = {
      ...leaveTypes,
      [fieldName]: updatedHours
    }

    const { error: updateError } = await supabase
      .from('leave_days')
      .update({ leave_types: updatedLeaveTypes })
      .eq('user_id', formRequest.user_id)

    if (updateError) {
      throw new Error('보상휴가 지급에 실패했습니다.')
    }

    const leaveTypeName = getLeaveTypeName(overtimeResult.leaveType)
    
    // Send compensation leave notification
    await sendNotification(
      supabase,
      formRequest.user_id,
      `초과근무 승인으로 ${leaveTypeName} ${overtimeResult.compensationHours}시간이 지급되었습니다.`,
      '/user'
    )

    console.log(`⏰ [초과근무승인] ${formRequest.users.name}님에게 ${leaveTypeName} ${overtimeResult.compensationHours}시간 지급`)

  } catch (error) {
    console.error('초과근무 보상휴가 지급 실패:', error)
    throw new Error('초과근무 보상휴가 지급에 실패했습니다.')
  }
}

// Helper function to send notifications
async function sendNotification(supabase: any, userId: string, message: string, link?: string) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      message,
      link,
      is_read: false
    })
  } catch (error) {
    console.error('알림 전송 실패:', error)
    // Don't throw - notifications are not critical
  }
}