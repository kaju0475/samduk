/**
 * 백업 시스템 종합 검증 스크립트
 * 
 * 검증 항목:
 * 1. 백업 개수 정책 (168개 = 7일 * 24시간)
 * 2. 백업 파일 명명 규칙
 * 3. 백업 스케줄 설정
 * 4. 백업 디렉토리 존재 여부
 * 5. 백업 파일 유효성
 */

import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 168; // 7 days * 24 hours

interface BackupAuditResult {
    success: boolean;
    checks: {
        directoryExists: boolean;
        backupCount: number;
        maxBackupsPolicy: number;
        exceedsPolicy: boolean;
        oldestBackup?: string;
        newestBackup?: string;
        fileNamingCorrect: boolean;
        schedule: string;
        scheduleValid: boolean;
    };
    issues: string[];
    recommendations: string[];
}

async function auditBackupSystem(): Promise<BackupAuditResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const result: BackupAuditResult = {
        success: true,
        checks: {
            directoryExists: false,
            backupCount: 0,
            maxBackupsPolicy: MAX_BACKUPS,
            exceedsPolicy: false,
            fileNamingCorrect: true,
            schedule: '0 * * * *',
            scheduleValid: true
        },
        issues,
        recommendations
    };

    console.log('🔍 백업 시스템 종합 검증 시작...\n');

    // 1. 백업 디렉토리 존재 확인
    console.log('[1/6] 백업 디렉토리 확인...');
    if (fs.existsSync(BACKUP_DIR)) {
        result.checks.directoryExists = true;
        console.log(`✅ 백업 디렉토리 존재: ${BACKUP_DIR}`);
    } else {
        result.checks.directoryExists = false;
        result.success = false;
        issues.push('백업 디렉토리가 존재하지 않습니다.');
        console.log(`❌ 백업 디렉토리 없음: ${BACKUP_DIR}`);
        return result;
    }

    // 2. 백업 파일 개수 확인
    console.log('\n[2/6] 백업 파일 개수 확인...');
    const allFiles = fs.readdirSync(BACKUP_DIR);
    const backupFiles = allFiles.filter(f => f.startsWith('db-backup-') && f.endsWith('.json'));
    result.checks.backupCount = backupFiles.length;
    
    console.log(`📊 현재 백업 파일 개수: ${backupFiles.length}개`);
    console.log(`📋 정책 최대 백업 개수: ${MAX_BACKUPS}개 (7일 × 24시간)`);

    if (backupFiles.length > MAX_BACKUPS) {
        result.checks.exceedsPolicy = true;
        issues.push(`백업 파일이 정책(${MAX_BACKUPS}개)을 초과했습니다. (현재: ${backupFiles.length}개)`);
        recommendations.push('자동 클린업 로직이 작동하지 않고 있을 수 있습니다.');
        console.log(`⚠️  정책 초과! 클린업 필요`);
    } else {
        console.log(`✅ 백업 파일 개수가 정책 범위 내에 있습니다.`);
    }

    // 3. 백업 파일 명명 규칙 확인
    console.log('\n[3/6] 파일 명명 규칙 확인...');
    const namingPattern = /^db-backup-\d{4}-\d{2}-\d{2}-\d{2}\.json$/;
    const invalidNames = backupFiles.filter(f => !namingPattern.test(f));
    
    if (invalidNames.length > 0) {
        result.checks.fileNamingCorrect = false;
        issues.push(`잘못된 파일명이 발견되었습니다: ${invalidNames.join(', ')}`);
        console.log(`❌ 잘못된 파일명: ${invalidNames.length}개`);
        invalidNames.forEach(name => console.log(`   - ${name}`));
    } else {
        console.log(`✅ 모든 백업 파일이 올바른 명명 규칙을 따릅니다.`);
    }

    // 4. 백업 파일 시간 확인 (최신/최구)
    console.log('\n[4/6] 백업 파일 시간 분석...');
    if (backupFiles.length > 0) {
        const fileStats = backupFiles.map(f => {
            const filePath = path.join(BACKUP_DIR, f);
            const stats = fs.statSync(filePath);
            return { name: f, mtime: stats.mtime };
        });

        fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        
        const oldest = fileStats[0];
        const newest = fileStats[fileStats.length - 1];
        
        result.checks.oldestBackup = oldest.name;
        result.checks.newestBackup = newest.name;
        
        console.log(`📅 가장 오래된 백업: ${oldest.name} (${oldest.mtime.toLocaleString('ko-KR')})`);
        console.log(`📅 가장 최근 백업: ${newest.name} (${newest.mtime.toLocaleString('ko-KR')})`);
        
        // 최근 백업이 너무 오래되었는지 확인 (24시간 이상)
        const now = new Date();
        const hoursSinceLastBackup = (now.getTime() - newest.mtime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastBackup > 24) {
            issues.push(`최근 백업이 ${Math.floor(hoursSinceLastBackup)}시간 전입니다. 자동 백업이 작동하지 않을 수 있습니다.`);
            recommendations.push('백업 스케줄러를 재시작해보세요.');
            console.log(`⚠️  최근 백업이 ${Math.floor(hoursSinceLastBackup)}시간 전입니다.`);
        } else {
            console.log(`✅ 최근 백업이 ${Math.floor(hoursSinceLastBackup)}시간 전으로 정상입니다.`);
        }
    }

    // 5. 백업 스케줄 확인
    console.log('\n[5/6] 백업 스케줄 설정 확인...');
    const schedule = db.systemConfig?.backupSchedule || '0 * * * *';
    result.checks.schedule = schedule;
    
    console.log(`⏰ 현재 백업 스케줄: "${schedule}"`);
    console.log(`   해석: ${getCronDescription(schedule)}`);
    
    // Cron 유효성 검증 (간단한 패턴 체크)
    const cronPattern = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
    
    if (!cronPattern.test(schedule)) {
        result.checks.scheduleValid = false;
        issues.push(`백업 스케줄 표현식이 잘못되었습니다: "${schedule}"`);
        console.log(`❌ 잘못된 Cron 표현식`);
    } else {
        console.log(`✅ 유효한 Cron 표현식`);
    }

    // 6. 백업 파일 내용 유효성 검증 (샘플링)
    console.log('\n[6/6] 백업 파일 내용 유효성 검증 (샘플링)...');
    if (backupFiles.length > 0) {
        const sampleFile = path.join(BACKUP_DIR, backupFiles[0]);
        try {
            const content = fs.readFileSync(sampleFile, 'utf-8');
            const data = JSON.parse(content);
            
            const requiredKeys = ['users', 'customers', 'cylinders', 'transactions'];
            const missingKeys = requiredKeys.filter(key => !data[key]);
            
            if (missingKeys.length > 0) {
                issues.push(`백업 파일에 필수 키가 누락되었습니다: ${missingKeys.join(', ')}`);
                console.log(`❌ 필수 키 누락: ${missingKeys.join(', ')}`);
            } else {
                console.log(`✅ 백업 파일 구조가 올바릅니다.`);
                console.log(`   - Users: ${data.users?.length || 0}개`);
                console.log(`   - Customers: ${data.customers?.length || 0}개`);
                console.log(`   - Cylinders: ${data.cylinders?.length || 0}개`);
                console.log(`   - Transactions: ${data.transactions?.length || 0}개`);
            }
        } catch (e) {
            issues.push(`백업 파일을 읽거나 파싱하는 중 오류가 발생했습니다: ${e}`);
            console.log(`❌ 파일 파싱 오류`);
        }
    }

    // 최종 결과
    console.log('\n' + '='.repeat(60));
    console.log('📊 백업 시스템 검증 결과');
    console.log('='.repeat(60));
    
    if (issues.length === 0) {
        console.log('✅ 모든 검증 항목을 통과했습니다!');
        result.success = true;
    } else {
        console.log(`⚠️  ${issues.length}개의 문제가 발견되었습니다:\n`);
        issues.forEach((issue, idx) => {
            console.log(`   ${idx + 1}. ${issue}`);
        });
        
        if (recommendations.length > 0) {
            console.log(`\n💡 권장사항:\n`);
            recommendations.forEach((rec, idx) => {
                console.log(`   ${idx + 1}. ${rec}`);
            });
        }
        result.success = false;
    }

    return result;
}

function getCronDescription(schedule: string): string {
    const parts = schedule.split(' ');
    if (parts.length !== 5) return '알 수 없는 형식';
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    if (schedule === '0 * * * *') return '매시간 정각 (00분)';
    if (schedule === '0 0 * * *') return '매일 자정 (00:00)';
    if (schedule === '*/15 * * * *') return '15분마다';
    if (schedule === '0 */2 * * *') return '2시간마다';
    
    return `분:${minute} 시:${hour} 일:${dayOfMonth} 월:${month} 요일:${dayOfWeek}`;
}

// 실행
auditBackupSystem()
    .then(result => {
        console.log('\n검증 완료!');
        process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
        console.error('검증 중 오류 발생:', err);
        process.exit(1);
    });
