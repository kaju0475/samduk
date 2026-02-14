
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { filename } = body;

        if (!filename) {
            return NextResponse.json({ success: false, message: 'Filename required' }, { status: 400 });
        }

        const configPath = db.systemConfig?.backupPath || 'backups';
        const backupDir = path.resolve(process.cwd(), configPath);
        const backupFile = path.join(backupDir, filename);
        const dbPath = path.join(process.cwd(), 'db.json');

        if (!fs.existsSync(backupFile)) {
            return NextResponse.json({ success: false, message: 'Backup file not found' }, { status: 404 });
        }

        // Perform Restore
        // 1. Safety Backup of current state? (Maybe 'db.json.pre-restore')
        // const safetyPath = path.join(process.cwd(), 'db.json.pre-restore');
        // await fs.promises.copyFile(dbPath, safetyPath);

        // 2. Overwrite
        await fs.promises.copyFile(backupFile, dbPath);

        // 3. Reload DB Memory
        db.reload();

        return NextResponse.json({ success: true, message: 'Database restored successfully.' });
    } catch (error) {
        console.error('Restore Error:', error);
        return NextResponse.json({ success: false, message: 'Restore Failed' }, { status: 500 });
    }
}
