import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Supabase 세션에서 현재 사용자 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 사용자 정보 및 권한 확인
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (userError || userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    // 3. Fetch all form requests with user info
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter')

  console.log('🔍 관리자 서식 신청 내역 조회:', { filter })

  let query = supabase
    .from('form_requests')
    .select(`
      *,
      users!form_requests_user_id_fkey(name, department, position)
    `)
    .order('created_at', { ascending: false })

  if (filter && filter !== 'all' && filter !== 'undefined') {
    query = query.eq('status', filter)
  }

  const { data: requests, error } = await query

  if (error) {
    console.error('❌ 서식 신청 내역 조회 실패:', error)
    return NextResponse.json({ error: '서식 신청 내역을 불러오는데 실패했습니다.' }, { status: 500 })
  }

  // 데이터 포맷팅
  const formattedRequests = requests?.map(request => ({
    ...request,
    user: {
      name: request.users?.name || '알 수 없음',
      department: request.users?.department || '알 수 없음',
      position: request.users?.position || '알 수 없음'
    }
  })) || []

    console.log('✅ 관리자 서식 신청 내역 조회 완료:', formattedRequests.length, '건')

    return NextResponse.json({ success: true, requests: formattedRequests })
  } catch (error) {
    console.error('서식 신청 내역 조회 오류:', error)
    return NextResponse.json({ error: '서식 신청 내역 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}