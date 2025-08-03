import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest, 
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params
    const { status, action, adminNotes } = await request.json()
    
    // status 또는 action 중 하나를 사용
    const finalAction = status || action
    
    console.log("Admin approval request:", { requestId, status, action, finalAction, adminNotes })
    
    if (!finalAction || !['approved', 'rejected'].includes(finalAction)) {
      return NextResponse.json(
        { error: "유효하지 않은 상태입니다. 'approved' 또는 'rejected'를 사용하세요." },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    const serviceRoleSupabase = await createServiceRoleClient()

    // Supabase 세션에서 현재 사용자 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 관리자 권한 확인
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (userError || userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    // 실제 데이터베이스 업데이트 (Service Role 사용)
    const { error: updateError } = await serviceRoleSupabase
      .from('form_requests')
      .update({ 
        status: finalAction, 
        processed_at: new Date().toISOString(),
        processed_by: session.user.id,
        admin_notes: adminNotes || null
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('❌ 서식 상태 업데이트 실패:', updateError)
      return NextResponse.json(
        { error: '상태 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: finalAction === "approved" ? "승인되었습니다." : "거부되었습니다.",
      data: { requestId, status: finalAction }
    })
  } catch (error) {
    console.error("Approval error:", error)
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." }, 
      { status: 500 }
    )
  }
}