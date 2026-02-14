
import fs from 'fs';
import path from 'path';
import cron, { ScheduledTask } from 'node-cron';
import { db } from '@/lib/db';

let currentTask: ScheduledTask | null = null;

// Helpers
const getBackupDir = () => {
    const configPath = db.systemConfig?.backupPath || 'backups';
    return path.resolve(process.cwd(), configPath);
};

export const startBackupService = () => {
    // Stop existing if any (to be safe)
    if (currentTask) {
        currentTask.stop();
        currentTask = null;
    }

    const schedule = db.systemConfig?.backupSchedule || '0 * * * *'; // Default to Hourly
    
    console.log(`[Backup System] Initializing... Schedule: "${schedule}" Path: "${getBackupDir()}"`);

    // Validate Schedule
    if (!cron.validate(schedule)) {
        console.error(`[Backup System] Invalid Cron Expression: ${schedule}. Fallback to default.`);
        return;
    }

    // 1. Database Backup Task (Hourly)
    currentTask = cron.schedule(schedule, async () => {
        await executeBackup();
    });

    // 2. [NEW] Lost Detection (미아용기) Task (07:00, 12:00, 16:00)
    // Runs at the requested times to classify long-term unreturned cylinders
    cron.schedule('0 7,12,16 * * *', async () => {
        console.log('[Maintenance System] Starting scheduled Lost Detection (미아용기)...');
        try {
            const { runLostDetection } = await import('@/lib/maintenance-tasks');
            const result = await runLostDetection();
            console.log(`[Maintenance System] Lost Detection complete: ${result.count} items classified.`);
        } catch (e) {
            console.error('[Maintenance System] Lost Detection failed:', e);
        }
    });

    console.log('[Backup System] Service Started with Automated Maintenance.');
};

const executeBackup = async () => {
    const backupDir = getBackupDir();
    
    // Ensure Backup Directory Exists
    if (!fs.existsSync(backupDir)) {
        try {
            fs.mkdirSync(backupDir, { recursive: true });
        } catch (e) {
            console.error(`[Backup System] Failed to create dir: ${backupDir}`, e);
            return;
        }
    }

    const today = new Date();
    const dateStr = today.getFullYear() + '-' + 
                    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(today.getDate()).padStart(2, '0') + '-' + 
                    String(today.getHours()).padStart(2, '0');
    
    const backupFile = path.join(backupDir, `db-backup-${dateStr}.json`);
    
    console.log(`[Backup System] Starting scheduled backup...`);

    try {
        console.log('[Backup System] Syncing from Supabase...');
        await db.reload(true);
        await db.save();
        
        const sourcePath = path.join(process.cwd(), 'db.json');
        
        if (fs.existsSync(sourcePath)) {
            await fs.promises.copyFile(sourcePath, backupFile);
            console.log(`[Backup System] Backup created: ${backupFile}`);
            
            await cleanOldBackups(backupDir);

            // [ZERO DEFECT] Prune old logs (1 Year policy)
            try {
                const { AuditLogger } = await import('@/lib/audit-logger');
                await AuditLogger.pruneOldLogs(365);
            } catch (e) {
                console.error('[Backup System] Failed to prune logs', e);
            }
        }
    } catch (error) {
        console.error('[Backup System] Backup Failed:', error);
    }
};

export const restartBackupService = () => {
    console.log('[Backup System] Restarting service due to config change...');
    startBackupService();
};

const cleanOldBackups = async (dir: string) => {
    try {
        const files = await fs.promises.readdir(dir);
        // Filter only backup files to avoid deleting other things
        const backupFiles = files.filter(f => f.startsWith('db-backup-') && f.endsWith('.json'));

        // [Rolling Policy] Keep exactly 7 days * 24 hours = 168 files
        const MAX_BACKUPS = 168;

        if (backupFiles.length > MAX_BACKUPS) {
            // Sort by time (Oldest first)
            // We can trust filename sorting for ISO dates: db-backup-YYYY-MM-DD-HH.json
            // Or get stats. Let's use stats for safety.
            const fileStats = await Promise.all(backupFiles.map(async (file) => {
                const filePath = path.join(dir, file);
                const stats = await fs.promises.stat(filePath);
                return { file, filePath, mtime: stats.mtime.getTime() };
            }));

            // Sort: Oldest -> Newest
            fileStats.sort((a, b) => a.mtime - b.mtime);

            // Calculate how many to delete
            const deleteCount = backupFiles.length - MAX_BACKUPS;
            
            // Delete oldest
            for (let i = 0; i < deleteCount; i++) {
                await fs.promises.unlink(fileStats[i].filePath);
                console.log(`[Backup System] Rolling Cleanup: Deleted old backup ${fileStats[i].file}`);
            }
        }
    } catch (error) {
         console.error('[Backup System] Cleanup Failed:', error);
    }
};
