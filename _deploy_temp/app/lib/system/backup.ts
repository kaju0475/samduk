
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';

const DB_PATH = path.join(process.cwd(), 'db.json');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export interface BackupResult {
  success: boolean;
  message: string;
  localPath?: string;
  cloudSynced?: boolean;
  timestamp: string;
}

export async function performDualBackup(): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
  const backupFilename = `system_backup_${timestamp}.json`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);
  
  const result: BackupResult = {
    success: false,
    message: '',
    timestamp,
    cloudSynced: false
  };

  try {
    // 1. Local Backup
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_PATH)) {
      throw new Error('db.json 파일을 찾을 수 없습니다.');
    }

    // Read data for both copy and cloud sync
    const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
    fs.writeFileSync(backupPath, fileContent);
    result.localPath = backupPath;

    // 2. Cloud Sync (Supabase)
    if (supabase) {
      const data = JSON.parse(fileContent);
      await syncToSupabase(data);
      result.cloudSynced = true;
    }

    result.success = true;
    result.message = `백업이 완료되었습니다. 로컬: ${backupFilename}, 클라우드: ${result.cloudSynced ? '동기화됨' : '건너뜀'}`;

  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    result.message = message;
    console.error('Backup failed:', error);
  }

  return result;
}

export function listLocalBackups(): string[] {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    
    return fs.readdirSync(BACKUP_DIR)
             .filter(file => file.endsWith('.json'))
             .map(file => ({
                 name: file,
                 time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
             }))
             .sort((a, b) => b.time - a.time) // Newest time first
             .map(f => f.name);
}

export interface GitHubBackup {
    id: number;
    name: string;
    size_in_bytes: number;
    created_at: string;
    expired: boolean;
    download_url: string;
}

export async function listGitHubBackups(): Promise<{ backups: GitHubBackup[], status: 'connected' | 'error' | 'auth_required' }> {
    try {
        const repoOwner = 'kaju0475';
        const repoName = 'samduk';
        const url = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/artifacts`;

        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Samduk-System'
        };

        // If a token exists in env, use it (for private repos or higher rate limits)
        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        const res = await fetch(url, { headers });

        if (res.status === 401 || res.status === 403) {
             return { backups: [], status: 'auth_required' };
        }

        if (!res.ok) {
            console.error(`GitHub API Error: ${res.status} ${res.statusText}`);
            return { backups: [], status: 'error' };
        }

        const json = await res.json();
        
        // Filter for our backups (e.g., 'daily-backup' or 'backup-*')
        // And sort by creation date desc
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const artifacts = (json.artifacts || []).filter((a: any) => !a.expired && (a.name === 'daily-backup' || a.name.startsWith('backup-')));
        
        return { 
            backups: artifacts, 
            status: 'connected' 
        };

    } catch (error) {
        console.error('Failed to list GitHub backups:', error);
        return { backups: [], status: 'error' };
    }
}

async function syncToSupabase(data: any) {
    // Reusing logic from scripts/migrate-to-supabase.js
    // Ideally this should be a shared utility, but for now we implement the core sync here.
    
    // 1. Users
    if (data.users?.length) {
        await supabase!.from('users').upsert(data.users);
    }
    
    // 2. Customers (Clean & Batch)
    if (data.customers?.length) {
         const cleanCustomers = data.customers.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || null,
            address: c.address || null,
            manager: c.manager || null,
            tanks: c.tanks || {},
            lastTransactionDate: c.lastTransactionDate || null,
            balance: c.balance || 0
        }));
        
        // Simple batching
        const BATCH_SIZE = 100;
        for (let i = 0; i < cleanCustomers.length; i += BATCH_SIZE) {
            await supabase!.from('customers').upsert(cleanCustomers.slice(i, i + BATCH_SIZE));
        }
    }

    // 3. Cylinders
    if (data.cylinders?.length) {
         const cleanCylinders = data.cylinders.map((c: any) => ({
            id: c.id,
            gas_type: c.gasId || c.gas_type || 'O2-40L', // Simplified mapping
            ownership: (c.ownership === 'SAMDUK' || c.owner === 'SAMDUK' || c.owner === '자사') ? 'SAMDUK' : 'CUSTOMER',
            owner_id: c.ownerId || c.owner_id,
            location: c.location || 'SAMDUK',
            status: c.status || 'Empty',
            lastTransactionDate: c.lastTransactionDate || null,
            returnDate: c.returnDate || null,
            memo: c.memo || null,
            chargingExpiryDate: c.chargingExpiryDate || null, 
            workPressure: c.workPressure || null,
            containerType: c.containerType || 'CYLINDER'
        }));

        const BATCH_SIZE = 100;
        for (let i = 0; i < cleanCylinders.length; i += BATCH_SIZE) {
            await supabase!.from('cylinders').upsert(cleanCylinders.slice(i, i + BATCH_SIZE));
        }
    }

    // 4. Transactions
    if (data.transactions?.length) {
         const cleanTx = data.transactions.map((t: any) => ({
            id: t.id,
            type: t.type,
            date: t.timestamp || t.date,
            customerName: t.customerName,
            gasType: t.gasType,
            quantity: t.quantity,
            workerId: t.workerId,
            customerId: t.customerId,
            cylinderId: t.cylinderId,
            status: t.status,
            is_manual: t.is_manual || false
        }));

        const BATCH_SIZE = 100;
        for (let i = 0; i < cleanTx.length; i += BATCH_SIZE) {
            await supabase!.from('transactions').upsert(cleanTx.slice(i, i + BATCH_SIZE));
        }
    }
}

export async function restoreSystem(filename: string): Promise<BackupResult> {
  const backupPath = path.join(BACKUP_DIR, filename);
  const result: BackupResult = {
    success: false,
    message: '',
    timestamp: new Date().toISOString(),
    localPath: filename
  };

  try {
    if (!fs.existsSync(backupPath)) {
      throw new Error('백업 파일을 찾을 수 없습니다.');
    }

    // Validation
    const fileContent = fs.readFileSync(backupPath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!data.users || !data.customers || !data.transactions) {
      throw new Error('잘못된 백업 파일 형식: 핵심 데이터 테이블이 누락되었습니다.');
    }

    // Restore: Overwrite db.json
    // 1. Create a safety backup of CURRENT state before overwriting
    await performDualBackup(); // Auto-safety backup

    // 2. Overwrite
    fs.writeFileSync(DB_PATH, fileContent);

    result.success = true;
    result.message = `시스템이 ${filename} 시점으로 복구되었습니다. 복구 전 현재 상태가 자동으로 백업되었습니다.`;

  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    result.message = message;
    console.error('Restore failed:', error);
  }

  return result;
}

export async function restoreFromGitHub(downloadUrl: string, token?: string): Promise<BackupResult> {
    const result: BackupResult = {
        success: false,
        message: '',
        timestamp: new Date().toISOString(),
        cloudSynced: true
    };

    try {
        console.log(`[Cloud Restore] Downloading from ${downloadUrl}...`);
        
        const headers: Record<string, string> = {
            'User-Agent': 'Samduk-System'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(downloadUrl, { headers });
        
        if (!response.ok) {
            throw new Error(`Failed to download artifact: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Unzip
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        
        // Find JSON file
        const jsonEntry = zipEntries.find(entry => entry.entryName.endsWith('.json') && !entry.isDirectory);
        
        if (!jsonEntry) {
            throw new Error('No JSON backup file found in the artifact zip.');
        }

        const fileContent = jsonEntry.getData().toString('utf8');
        
        // Validate JSON
        let data;
        try {
            data = JSON.parse(fileContent);
        } catch {
            throw new Error('잘못된 JSON 형식의 백업 파일입니다.');
        }

        if (!data.users || !data.customers) { // Minimal check
             throw new Error('잘못된 백업 구조: 핵심 데이터(사용자/거래처)가 누락되었습니다.');
        }

        // Safety Backup
        console.log('[Cloud Restore] Creating safety backup...');
        await performDualBackup();

        // Overwrite
        fs.writeFileSync(DB_PATH, fileContent);
        
        result.success = true;
        result.message = `클라우드 백업에서 성공적으로 복구되었습니다! (${jsonEntry.entryName})`;

    } catch (error) {
        console.error('[Cloud Restore] Failed:', error);
        result.message = error instanceof Error ? error.message : '알 수 없는 오류';
    }
    
    return result;
}
