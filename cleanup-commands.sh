#!/bin/bash
# Motion Connect HR 프로젝트 정리 스크립트

cd "/Users/lewis/Desktop/HR System/motion-connect"

echo "🧹 Motion Connect HR 프로젝트 정리 시작..."

# 1. 불필요한 SQL 스크립트 제거 (CLEAN-FINAL-schema.sql만 유지)
echo "📁 Scripts 폴더 정리..."
cd scripts
rm -f ACCURATE-complete-migration.sql
rm -f FINAL-optimized-hr-schema.sql
rm -f FRESH-database-setup.sql
rm -f SIMPLE-clean-migration.sql
rm -f check-users.sql
rm -f complete-database-reset-with-real-addresses.sql
rm -f complete-database-reset.sql
rm -f debug-login-issue.sql
rm -f debug-users.sql
rm -f export-local-data.js
rm -f fix-password-hashes.sql
rm -f fix-rls.sql
rm -f generate-password.js
rm -f production-migration-data.sql
rm -f simple-admin-sql.sql
rm -f simple-user-test.sql
rm -f test-api-connection.sql
rm -f test-login.js

cd ..

# 2. 루트 폴더의 불필요한 파일들 제거
echo "🗑️ 루트 폴더 정리..."
rm -f cleanup-database.sql
rm -f insert-statements-2025-07-14T12-39-26-718Z.sql
rm -f insert-statements-2025-07-14T13-06-51-458Z.sql
rm -f local-data-backup-2025-07-14T12-39-26-718Z.json
rm -f local-data-backup-2025-07-14T13-06-51-458Z.json
rm -f supabase-schema.sql

# 3. Supabase 로컬 폴더 제거 (사용하지 않음)
echo "📂 Supabase 로컬 폴더 제거..."
rm -rf supabase

# 4. 사용하지 않는 컴포넌트 제거
echo "🗂️ 불필요한 컴포넌트 제거..."
rm -f src/components/AdminLeavePromotionManagement.tsx

# 5. README 업데이트를 위한 백업
echo "📝 문서 정리..."

echo "✅ 정리 완료!"
echo ""
echo "📊 남은 주요 파일들:"
echo "scripts/"
echo "  ├── CLEAN-FINAL-schema.sql ✅ (유일한 유효 스키마)"
echo "  └── check-promotion-targets.sql ✅ (연차 촉진 확인용)"
echo ""
echo "src/components/ (12개 → 11개)"
echo "  ├── Admin*Management.tsx (4개 관리자 컴포넌트)"
echo "  ├── User*.tsx (3개 사용자 컴포넌트)"
echo "  └── 기타 유틸리티 컴포넌트들"
echo ""
echo "🎯 정리된 프로젝트가 GitHub에 반영되도록 커밋하세요!"