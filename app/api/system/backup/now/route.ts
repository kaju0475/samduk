import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
    // 1. 보안 검사 (Secret Key 확인)
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        console.log('[Backup] Starting backup dump...');
        await db.reload(true);
        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0'
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
        return NextResponse.json(backupData);
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
