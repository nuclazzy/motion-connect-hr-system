#!/usr/bin/env node

/**
 * Motion Connect 백업 실행 스크립트
 * 실제 데이터베이스 백업을 수행하고 파일 시스템에 저장
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// 환경 설정
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  backupDir: process.env.BACKUP_DIR || './backups',
  databaseUrl: process.env.DATABASE_URL, // PostgreSQL 연결 URL
  maxBackupAge: 30, // 일
  compressionEnabled: true,
  encryptionEnabled: false // 필요시 활성화
};

class BackupManager {
  constructor() {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
  }

  /**
   * 백업 디렉토리 초기화
   */
  async initializeBackupDir() {
    try {
      await fs.mkdir(config.backupDir, { recursive: true });
      console.log(`✅ 백업 디렉토리 준비: ${config.backupDir}`);
    } catch (error) {
      console.error('❌ 백업 디렉토리 생성 실패:', error);
      throw error;
    }
  }

  /**
   * PostgreSQL 덤프 생성
   */
  async createDatabaseDump(backupId, backupType = 'FULL') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `motionconnect_${backupType.toLowerCase()}_${timestamp}.sql`;
    const filepath = path.join(config.backupDir, filename);

    try {
      console.log(`📦 데이터베이스 덤프 생성 중: ${filename}`);
      
      // pg_dump 명령 구성
      let dumpCommand = `pg_dump "${config.databaseUrl}"`;
      
      if (backupType === 'SCHEMA_ONLY') {
        dumpCommand += ' --schema-only';
      } else if (backupType === 'DATA_ONLY') {
        dumpCommand += ' --data-only';
      }
      
      dumpCommand += ` --no-password --verbose --file="${filepath}"`;

      // 덤프 실행
      await this.executeCommand(dumpCommand);

      // 파일 크기 확인
      const stats = await fs.stat(filepath);
      const fileSize = stats.size;

      console.log(`✅ 덤프 생성 완료: ${filename} (${this.formatFileSize(fileSize)})`);

      // 압축 (옵션)
      let finalPath = filepath;
      if (config.compressionEnabled) {
        finalPath = await this.compressFile(filepath);
        await fs.unlink(filepath); // 원본 삭제
      }

      // 체크섬 생성
      const checksum = await this.generateChecksum(finalPath);

      return {
        filename: path.basename(finalPath),
        filepath: finalPath,
        size: fileSize,
        checksum
      };

    } catch (error) {
      console.error('❌ 데이터베이스 덤프 실패:', error);
      throw error;
    }
  }

  /**
   * 파일 압축
   */
  async compressFile(filepath) {
    const compressedPath = `${filepath}.gz`;
    
    try {
      await this.executeCommand(`gzip "${filepath}"`);
      console.log(`🗜️ 파일 압축 완료: ${path.basename(compressedPath)}`);
      return compressedPath;
    } catch (error) {
      console.error('❌ 파일 압축 실패:', error);
      throw error;
    }
  }

  /**
   * 파일 체크섬 생성
   */
  async generateChecksum(filepath) {
    try {
      const fileBuffer = await fs.readFile(filepath);
      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      console.error('❌ 체크섬 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 명령 실행 헬퍼
   */
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  /**
   * 파일 크기 포맷팅
   */
  formatFileSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 백업 메타데이터 업데이트
   */
  async updateBackupMetadata(backupId, backupData, status = 'COMPLETED') {
    try {
      const { error } = await this.supabase
        .from('backup_metadata')
        .update({
          backup_status: status,
          backup_location: backupData.filepath,
          backup_size_bytes: backupData.size,
          backup_checksum: backupData.checksum,
          end_time: new Date().toISOString(),
          notes: `백업 파일: ${backupData.filename}`
        })
        .eq('id', backupId);

      if (error) {
        throw error;
      }

      console.log(`✅ 백업 메타데이터 업데이트 완료: ${backupId}`);
    } catch (error) {
      console.error('❌ 백업 메타데이터 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 만료된 백업 파일 정리
   */
  async cleanupExpiredBackups() {
    try {
      console.log('🧹 만료된 백업 파일 정리 시작...');

      // 데이터베이스에서 만료된 백업 조회
      const { data: expiredBackups, error } = await this.supabase
        .from('backup_metadata')
        .select('id, backup_location')
        .lt('expires_at', new Date().toISOString())
        .eq('is_archived', false);

      if (error) {
        throw error;
      }

      let deletedCount = 0;
      for (const backup of expiredBackups) {
        try {
          // 파일 삭제
          if (backup.backup_location && await fs.access(backup.backup_location).then(() => true).catch(() => false)) {
            await fs.unlink(backup.backup_location);
            console.log(`🗑️ 파일 삭제: ${backup.backup_location}`);
          }

          // 메타데이터 아카이브 처리
          await this.supabase
            .from('backup_metadata')
            .update({ is_archived: true })
            .eq('id', backup.id);

          deletedCount++;
        } catch (fileError) {
          console.warn(`⚠️ 파일 삭제 실패: ${backup.backup_location}`, fileError.message);
        }
      }

      console.log(`✅ 만료된 백업 ${deletedCount}개 정리 완료`);
      return deletedCount;
    } catch (error) {
      console.error('❌ 백업 정리 실패:', error);
      throw error;
    }
  }

  /**
   * 백업 무결성 검증
   */
  async verifyBackupIntegrity(backupId) {
    try {
      console.log(`🔍 백업 무결성 검증 시작: ${backupId}`);

      // 백업 메타데이터 조회
      const { data: backup, error } = await this.supabase
        .from('backup_metadata')
        .select('*')
        .eq('id', backupId)
        .single();

      if (error || !backup) {
        throw new Error(`백업을 찾을 수 없습니다: ${backupId}`);
      }

      // 파일 존재 확인
      const fileExists = await fs.access(backup.backup_location).then(() => true).catch(() => false);
      if (!fileExists) {
        throw new Error(`백업 파일이 존재하지 않습니다: ${backup.backup_location}`);
      }

      // 체크섬 검증
      const currentChecksum = await this.generateChecksum(backup.backup_location);
      if (currentChecksum !== backup.backup_checksum) {
        throw new Error('백업 파일 체크섬이 일치하지 않습니다');
      }

      // 파일 크기 검증
      const stats = await fs.stat(backup.backup_location);
      if (Math.abs(stats.size - backup.backup_size_bytes) > 1024) { // 1KB 차이 허용
        console.warn(`⚠️ 파일 크기 차이 발견: 예상 ${backup.backup_size_bytes}, 실제 ${stats.size}`);
      }

      console.log(`✅ 백업 무결성 검증 완료: ${backupId}`);
      return true;
    } catch (error) {
      console.error(`❌ 백업 무결성 검증 실패: ${backupId}`, error.message);
      return false;
    }
  }

  /**
   * 전체 백업 실행
   */
  async runFullBackup() {
    let backupId = null;
    
    try {
      console.log('🚀 전체 백업 시작...');
      
      // 백업 디렉토리 초기화
      await this.initializeBackupDir();

      // 백업 메타데이터 생성
      const { data, error } = await this.supabase.rpc('create_backup', {
        p_backup_type: 'FULL',
        p_include_tables: null,
        p_exclude_tables: [],
        p_created_by: null
      });

      if (error) {
        throw error;
      }

      backupId = data;
      console.log(`📋 백업 ID: ${backupId}`);

      // 실제 데이터베이스 덤프 생성
      const backupData = await this.createDatabaseDump(backupId, 'FULL');

      // 메타데이터 업데이트
      await this.updateBackupMetadata(backupId, backupData);

      // 무결성 검증
      const verificationPassed = await this.verifyBackupIntegrity(backupId);
      
      // 만료된 백업 정리
      await this.cleanupExpiredBackups();

      console.log(`🎉 전체 백업 완료! ID: ${backupId}`);
      console.log(`📁 파일: ${backupData.filename}`);
      console.log(`📊 크기: ${this.formatFileSize(backupData.size)}`);
      console.log(`🔒 체크섬: ${backupData.checksum}`);
      console.log(`✅ 검증: ${verificationPassed ? '성공' : '실패'}`);

      return {
        success: true,
        backupId,
        filename: backupData.filename,
        size: backupData.size,
        verified: verificationPassed
      };

    } catch (error) {
      console.error('❌ 백업 실패:', error);
      
      // 실패한 백업 메타데이터 업데이트
      if (backupId) {
        await this.supabase
          .from('backup_metadata')
          .update({
            backup_status: 'FAILED',
            end_time: new Date().toISOString(),
            notes: `백업 실패: ${error.message}`
          })
          .eq('id', backupId);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 스크립트 실행
async function main() {
  const backupManager = new BackupManager();
  
  // 명령행 인수 처리
  const command = process.argv[2] || 'full';
  
  switch (command) {
    case 'full':
      await backupManager.runFullBackup();
      break;
    case 'cleanup':
      await backupManager.cleanupExpiredBackups();
      break;
    case 'verify':
      const backupId = process.argv[3];
      if (!backupId) {
        console.error('백업 ID가 필요합니다: node backup-runner.js verify <backup-id>');
        process.exit(1);
      }
      await backupManager.verifyBackupIntegrity(backupId);
      break;
    default:
      console.error('지원되지 않는 명령:', command);
      console.log('사용법: node backup-runner.js [full|cleanup|verify <backup-id>]');
      process.exit(1);
  }
}

// 스크립트가 직접 실행된 경우에만 main 함수 호출
if (require.main === module) {
  main().catch(error => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = { BackupManager };