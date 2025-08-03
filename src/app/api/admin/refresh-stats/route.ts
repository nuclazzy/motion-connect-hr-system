import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { AuditLogger, extractRequestContext } from '@/lib/audit/audit-logger'

export async function POST(request: NextRequest) {
  try {
    const requestContext = extractRequestContext(request)
    
    // Authorization 확인
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      await AuditLogger.logSecurityEvent(
        '인증되지 않은 통계 갱신 시도',
        undefined,
        'WARN' as any,
        requestContext
      )
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = authorization.replace('Bearer ', '')
    const supabase = await createServiceRoleClient()

    // 관리자 권한 확인
    const { data: user } = await supabase
      .from('users')
      .select('role, name')
      .eq('id', userId)
      .single()

    if (user?.role !== 'admin') {
      await AuditLogger.logSecurityEvent(
        '권한 없는 사용자의 통계 갱신 시도',
        userId,
        'HIGH' as any,
        { userRole: user?.role, ...requestContext }
      )
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 통계 갱신 시작 로그
    await AuditLogger.logSystemAction(
      'refresh_stats_start',
      '머티리얼라이즈드 뷰 통계 갱신 시작',
      'INFO' as any,
      { requested_by: user.name, ...requestContext }
    )

    try {
      // 머티리얼라이즈드 뷰 갱신
      const { error: refreshError } = await supabase.rpc('refresh_materialized_views')
      
      if (refreshError) {
        throw refreshError
      }

      // 테이블 통계 갱신
      const { error: analyzeError } = await supabase.rpc('analyze_performance_tables')
      
      if (analyzeError) {
        throw analyzeError
      }

      // 성공 로그
      await AuditLogger.logSystemAction(
        'refresh_stats_success',
        '머티리얼라이즈드 뷰 통계 갱신 완료',
        'INFO' as any,
        { 
          completed_by: user.name,
          duration: 'immediate',
          ...requestContext 
        }
      )

      return NextResponse.json({ 
        success: true,
        message: '통계가 성공적으로 갱신되었습니다.',
        timestamp: new Date().toISOString()
      })

    } catch (refreshError) {
      // 갱신 실패 로그
      await AuditLogger.logSystemAction(
        'refresh_stats_failure',
        `머티리얼라이즈드 뷰 통계 갱신 실패: ${refreshError}`,
        'WARN' as any,
        { 
          attempted_by: user.name,
          error: refreshError,
          ...requestContext 
        }
      )

      console.error('통계 갱신 실패:', refreshError)
      return NextResponse.json({ 
        error: '통계 갱신에 실패했습니다.',
        details: refreshError 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('통계 갱신 API 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}