
import fs from 'fs';
import path from 'path';

/**
 * Audit Logger Service
 * Records critical system transactions to a daily append-only log file.
 * Purpose: Provide a recovery trail ('Write-Ahead Log' style) and audit history
 * without the performance overhead of full DB backups on every request.
 */
export class AuditLogger {
    private static logDir = path.join(process.cwd(), 'logs');

    private static ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            try {
                fs.mkdirSync(this.logDir, { recursive: true });
            } catch (e) {
                console.error('[AuditLogger] Failed to create log directory', e);
            }
        }
    }

    public static async log(action: string, details: object, user: string = 'SYSTEM') {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
        const logFile = path.join(this.logDir, `audit-${dateStr}.log`);
        const timestamp = today.toISOString();

        const entry = JSON.stringify({
            timestamp,
            action,
            user,
            details
        }) + '\n';

        this.ensureLogDir();

        try {
            await fs.promises.appendFile(logFile, entry, 'utf8');
        } catch (error) {
            console.error('[AuditLogger] Failed to write log', error);
        }
    }

    public static async pruneOldLogs(daysToKeep: number = 7) {
        try {
            if (!fs.existsSync(this.logDir)) return;

            const files = await fs.promises.readdir(this.logDir);
            const now = new Date();
            const threshold = new Date(now.setDate(now.getDate() - daysToKeep));

            for (const file of files) {
                 if (!file.startsWith('audit-') || !file.endsWith('.log')) continue;

                 const filePath = path.join(this.logDir, file);
                 const stats = await fs.promises.stat(filePath);
                 
                 // Prune if older than threshold
                 if (stats.mtime < threshold) {
                     await fs.promises.unlink(filePath);
                     console.log(`[AuditLogger] Pruned old log: ${file}`);
                 }
            }
        } catch (error) {
            console.error('[AuditLogger] Prune failed:', error);
        }
    }
}
