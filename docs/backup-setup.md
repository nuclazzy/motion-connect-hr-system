# Motion Connect 백업 및 재해복구 시스템 설정 가이드

## 1. 시스템 개요

이 백업 시스템은 다음 기능들을 제공합니다:
- 자동화된 일일/주간 백업
- 백업 무결성 검증
- 복구 테스트
- 만료된 백업 자동 정리
- 감사 로깅 및 알림

## 2. 환경 설정

### 환경 변수 설정 (.env.local)
```bash
# 데이터베이스 연결
DATABASE_URL="postgresql://user:password@host:port/database"

# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# 백업 설정
BACKUP_DIR="/var/backups/motionconnect"
BACKUP_RETENTION_DAYS=30
```

### 의존성 설치
```bash
npm install @supabase/supabase-js
```

### 시스템 의존성
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client gzip

# macOS
brew install postgresql gzip
```

## 3. 백업 스크립트 권한 설정

```bash
chmod +x scripts/backup-runner.js
```

## 4. 수동 백업 실행

### 전체 백업
```bash
node scripts/backup-runner.js full
```

### 백업 검증
```bash
node scripts/backup-runner.js verify <backup-id>
```

### 만료된 백업 정리
```bash
node scripts/backup-runner.js cleanup
```

## 5. 자동화 설정 (Cron)

### crontab 편집
```bash
crontab -e
```

### Cron 작업 추가
```bash
# 매일 오전 2시 전체 백업
0 2 * * * cd /path/to/motionconnect && node scripts/backup-runner.js full >> /var/log/motionconnect-backup.log 2>&1

# 매주 일요일 오전 3시 백업 검증
0 3 * * 0 cd /path/to/motionconnect && node scripts/backup-runner.js cleanup >> /var/log/motionconnect-backup.log 2>&1

# 매달 1일 오전 4시 정리 작업
0 4 1 * * cd /path/to/motionconnect && node scripts/backup-runner.js cleanup >> /var/log/motionconnect-backup.log 2>&1
```

## 6. 백업 디렉토리 구조

```
/var/backups/motionconnect/
├── motionconnect_full_2025-08-03T02-00-00-000Z.sql.gz
├── motionconnect_full_2025-08-02T02-00-00-000Z.sql.gz
└── motionconnect_full_2025-08-01T02-00-00-000Z.sql.gz
```

## 7. 복구 절차

### 1. 백업 파일 확인
```sql
SELECT * FROM backup_status_summary 
WHERE backup_status = 'COMPLETED' 
AND integrity_check_passed = true
ORDER BY created_at DESC;
```

### 2. 데이터베이스 복구
```bash
# 압축 해제
gunzip backup_file.sql.gz

# 데이터베이스 복구 (주의: 기존 데이터 삭제됨)
dropdb motionconnect_db
createdb motionconnect_db
psql motionconnect_db < backup_file.sql
```

### 3. 복구 후 검증
```bash
# 데이터 무결성 확인
node scripts/backup-runner.js verify <backup-id>
```

## 8. 모니터링 및 알림

### 백업 상태 확인 쿼리
```sql
-- 최근 백업 상태
SELECT 
  backup_type,
  backup_status,
  start_time,
  duration_seconds,
  backup_size,
  integrity_check_passed
FROM backup_status_summary 
ORDER BY start_time DESC 
LIMIT 10;

-- 실패한 백업 조회
SELECT * FROM backup_status_summary 
WHERE backup_status = 'FAILED' 
OR integrity_check_passed = false;
```

### 감사 로그 확인
```sql
SELECT * FROM audit_logs 
WHERE category = 'SYSTEM' 
AND description LIKE '%백업%'
ORDER BY created_at DESC;
```

## 9. 보안 권장사항

### 백업 파일 암호화 (선택사항)
```bash
# 백업 파일 암호화
gpg --symmetric --cipher-algo AES256 backup_file.sql.gz

# 복호화
gpg --decrypt backup_file.sql.gz.gpg > backup_file.sql.gz
```

### 백업 디렉토리 권한 설정
```bash
# 소유자만 읽기/쓰기 권한
chmod 700 /var/backups/motionconnect
chown backup_user:backup_group /var/backups/motionconnect
```

## 10. 장애 대응 절차

### 백업 실패 시
1. 로그 파일 확인: `/var/log/motionconnect-backup.log`
2. 디스크 용량 확인: `df -h`
3. 데이터베이스 연결 확인
4. 수동 백업 실행으로 문제 재현

### 복구 시나리오별 대응

#### 부분 데이터 손실
```sql
-- 특정 테이블만 복구
pg_restore --table=specific_table backup_file.sql
```

#### 전체 시스템 장애
1. 최신 백업 파일 확인
2. 새 서버/데이터베이스 준비
3. 전체 백업 복구
4. 애플리케이션 연결 설정 업데이트

## 11. 성능 최적화

### 백업 성능 향상
```bash
# 병렬 백업 (큰 데이터베이스용)
pg_dump --jobs=4 --format=directory --file=backup_dir/ database_name
```

### 압축 최적화
```bash
# 더 높은 압축률 (시간 더 소요)
gzip -9 backup_file.sql

# 빠른 압축
gzip -1 backup_file.sql
```

## 12. 백업 테스트 체크리스트

- [ ] 자동 백업 스케줄 작동 확인
- [ ] 백업 파일 생성 및 크기 확인
- [ ] 체크섬 검증 통과 확인
- [ ] 만료된 백업 자동 정리 확인
- [ ] 복구 테스트 수행
- [ ] 알림 시스템 작동 확인
- [ ] 로그 파일 기록 확인

## 13. 주기적 유지보수

### 월간 작업
- 백업 시스템 상태 점검
- 디스크 용량 모니터링
- 복구 테스트 실행

### 분기별 작업
- 전체 시스템 복구 테스트
- 백업 정책 검토
- 성능 최적화 검토

이 가이드를 따라 설정하면 안정적이고 자동화된 백업 시스템을 구축할 수 있습니다.