
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { restartBackupService } from '@/lib/backup-scheduler';

export async function GET() {
    return NextResponse.json({
        success: true,
        data: db.systemConfig
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { backupSchedule, backupPath } = body;

        // Validation
        if (!backupSchedule || !backupPath) {
            return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
        }

        // Update DB
        db.systemConfig = {
            backupSchedule,
            backupPath
        };
        await db.save();

        // Restart Scheduler
        restartBackupService();

        return NextResponse.json({ success: true, message: 'Configuration saved and scheduler restarted.' });
    } catch (error) {
        console.error('Backup Config Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Error' }, { status: 500 });
    }
}
