import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    
    // 권한 확인을 위해 요청한 사용자 확인
    const userId = request.cookies.get('motion-connect-user-id')?.value
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 관리자 권한 확인
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError || userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    // 실제 데이터베이스 업데이트
    const { error: updateError } = await supabase
      .from('form_requests')
      .update({ 
        status: finalAction, 
        processed_at: new Date().toISOString(),
        processed_by: userId,
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