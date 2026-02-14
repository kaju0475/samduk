import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
    // 1. 보안 검사 (Secret Key 확인)
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.error('[Backup] Unauthorized request');
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
// console.log('[Backup] Starting backup dump...');
        
        // ... (Logic)

// console.log('[Backup] Successfully generated backup data');
        
        // 2. 최신 데이터 가져오기 (Supabase 등에서 강제 로딩)
        await db.reload(true);
        
        // 3. 백업 데이터 구성
        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                environment: process.env.NODE_ENV
            },
            data: {
                users: db.users,
                customers: db.customers,
                cylinders: db.cylinders,
                transactions: db.transactions,
                gasItems: db.gasItems,
                dailyLedgerNotes: db.dailyLedgerNotes,
                systemConfig: db.systemConfig,
                companySettings: db.companySettings
            }
        };

        // 4. 저장 대신 데이터 반환 (다운로드 가능하게)
        console.log('[Backup] Successfully generated backup data');
        return NextResponse.json(backupData);
    } catch (error) {
        console.error('[Backup] Error generating backup:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// POST handler (for manual triggers if needed)
export async function POST(request: NextRequest) {
    return GET(request);
}
