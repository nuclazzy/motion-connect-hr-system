import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { getCurrentUserServer, isAdmin } from '@/lib/auth/server'

// 초과근무 기록 승인/거절
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status, admin_notes } = await request.json()
    const overtimeId = params.id

    // 관리자 권한 확인
    const currentUser = await getCurrentUserServer(request)
    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다.'
      }, { status: 403 })
    }

    // 유효한 상태인지 확인
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 상태입니다.'
      }, { status: 400 })
    }

    // 초과근무 기록 업데이트
    const { data, error } = await supabase
      .from('overtime_records')
      .update({
        status,
        approved_by: currentUser.id,
        approved_at: new Date().toISOString(),
        notes: admin_notes || null
      })
      .eq('id', overtimeId)
      .select(`
        *,
        users(name, department, position)
      `)
      .single()

    if (error) {
      console.error('초과근무 승인/거절 오류:', error)
      return NextResponse.json({
        success: false,
        error: '초과근무 승인/거절에 실패했습니다.'
      }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        error: '해당 초과근무 기록을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    const statusText = status === 'approved' ? '승인' : '거절'
    
    return NextResponse.json({
      success: true,
      data,
      message: `초과근무가 ${statusText}되었습니다.`
    })

  } catch (error) {
    console.error('초과근무 승인/거절 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 초과근무 기록 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const overtimeId = params.id

    // 관리자 권한 확인
    const currentUser = await getCurrentUserServer(request)
    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다.'
      }, { status: 403 })
    }

    const { error } = await supabase
      .from('overtime_records')
      .delete()
      .eq('id', overtimeId)

    if (error) {
      console.error('초과근무 기록 삭제 오류:', error)
      return NextResponse.json({
        success: false,
        error: '초과근무 기록 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '초과근무 기록이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('초과근무 삭제 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}