#!/bin/bash

# Supabase Edge Functions 배포 스크립트
# 사용법: ./deploy-edge-functions.sh

echo "🚀 Supabase Edge Functions 배포 시작..."

# Supabase CLI 설치 확인
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI가 설치되어 있지 않습니다."
    echo "다음 명령어로 설치해주세요:"
    echo "brew install supabase/tap/supabase"
    exit 1
fi

# 프로젝트 ID 확인 (환경변수 또는 직접 입력)
PROJECT_ID=${SUPABASE_PROJECT_ID:-""}

if [ -z "$PROJECT_ID" ]; then
    echo "Supabase 프로젝트 ID를 입력하세요:"
    read PROJECT_ID
fi

# Supabase 로그인
echo "📝 Supabase 로그인..."
supabase login

# Edge Function 배포
echo "🔄 fetch-holidays Edge Function 배포 중..."
supabase functions deploy fetch-holidays --project-ref $PROJECT_ID

echo "✅ Edge Function 배포 완료!"
echo ""
echo "📌 다음 단계:"
echo "1. Supabase 대시보드에서 Edge Function이 활성화되었는지 확인"
echo "2. /api/proxy/holidays 라우트 파일 삭제 가능"
echo "3. 환경변수 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY 확인"