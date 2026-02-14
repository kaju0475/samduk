
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const customPath = searchParams.get('path');
        
        let targetPath = db.systemConfig?.backupPath || 'backups';
        
        // If Custom Path is provided, use it (and resolve absolute if needed)
        // If custom path is absolute, path.resolve(cwd, custom) behaves correctly? 
        // path.resolve(cwd, "C:/Users") -> "C:/Users". Yes.
        if (customPath) {
            targetPath = customPath;
        }

        const backupDir = path.resolve(process.cwd(), targetPath);

        if (!fs.existsSync(backupDir)) {
             return NextResponse.json({ success: true, data: [] });
        }

        const files = await fs.promises.readdir(backupDir);
        const stats = await Promise.all(files.map(async (file) => {
             // Filter only .json files if standard backup folder?
             // Or allow all? Backup files are usually .json in this system.
             // Let's filter slightly to reduce noise.
             if (!file.endsWith('.json')) return null;

            const filePath = path.join(backupDir, file);
            try {
                const stat = await fs.promises.stat(filePath);
                
                // [Fix] Vercel resets mtime to 2018/1980. Use filename date if possible.
                // Robust Regex: Look for YYYY-MM-DD pattern anywhere in filename
                let created = stat.mtime;
                const match = file.match(/(\d{4})[-.](\d{2})[-.](\d{2})([-T](\d{0,2}))?/); 
                // Matches 2026-01-21, 2026.01.21, optionally 2026-01-21-15 or T15
                
                if (match) {
                    const year = parseInt(match[1]);
                    const month = parseInt(match[2]) - 1;
                    const day = parseInt(match[3]);
                    const hour = match[5] ? parseInt(match[5]) : 0; // Default to 00:00 if no hour
                    
                    // Simple validation
                    if (year > 2000 && month >= 0 && month < 12 && day > 0 && day <= 31) {
                         // [Timezone Fix]
                         // Filename is created in KST (UTC+9) by Local PC.
                         // "16" in filename means 16:00 KST.
                         // But if we do new Date(y, m, d, 16), Vercel (UTC) treats it as 16:00 UTC.
                         // Client (KST) then adds 9h -> 01:00 Next Day. Wrong.
                         // We must create a Date corresponding to 16:00 KST.
                         // 16:00 KST = 07:00 UTC. (Hour - 9).
                         created = new Date(Date.UTC(year, month, day, hour - 9, 0, 0));
                    }
                }

                return {
                    name: file,
                    size: stat.size,
                    created: created
                };
            } catch (e) {
                return null;
            }
        }));

        // Filter nulls
        const validStats = stats.filter((s): s is NonNullable<typeof s> => s !== null);

        // Sort by Newest First
        validStats.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

        return NextResponse.json({ success: true, data: validStats });
    } catch (error) {
        console.error('List Backups Error:', error);
        return NextResponse.json({ success: false, message: 'Failed to list backups' }, { status: 500 });
    }
}
