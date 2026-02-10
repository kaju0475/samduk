import fs from 'fs';
import path from 'path';
import { Cylinder, Customer, Transaction, User, GasItem, DailyLedgerNote } from './types';

const DB_PATH = path.join(process.cwd(), process.env.DB_FILENAME || 'db.json');

export interface SystemConfig {
  backupSchedule: string; // Cron expression
  backupPath: string;
}

interface Schema {
  users: User[];
  customers: Customer[];
  cylinders: Cylinder[];
  transactions: Transaction[];
  gasItems: GasItem[];
  dailyLedgerNotes: DailyLedgerNote[];
  systemConfig: SystemConfig; // [NEW] backup config
}

// Helper to generate bulk test data
// [REPAIR] Validation Helper
const validateAndRepair = (data: Schema): Schema => {
    let repairedCount = 0;
    const today = new Date();
    const nextYear = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString().substring(0, 7);

    // 1. Repair Cylinders
    const repairedCylinders = data.cylinders.map(c => {
        let modified = false;
        const newC = { ...c };

        // Fix 1: Missing Expiry Date
        if (!newC.chargingExpiryDate) {
            newC.chargingExpiryDate = nextYear;
            modified = true;
        }

        // Fix 2: Missing Holder or Legacy 'SAMDUK' ID
        if (!newC.currentHolderId || newC.currentHolderId === 'SAMDUK') {
            newC.currentHolderId = '삼덕공장';
            modified = true;
        }

        // Fix 3: Legacy Status Normalization
        // Enum: '공병', '실병', '충전중', '납품', '검사대상', '검사중', '폐기'
        const statusMap: Record<string, string> = {
            'Empty': '공병',
            'Full': '실병',
            'Charging': '충전중',
            'Delivered': '납품',
            'Inspection': '검사대상',
            'Scrap': '폐기',
            'EMPTY': '공병',
            'FULL': '실병'
        };
        if (statusMap[newC.status]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            newC.status = statusMap[newC.status] as any;
            modified = true;
        }

        // Fix 4: Ensure Owner
        if (!newC.owner) {
            newC.owner = 'SAMDUK';
            modified = true;
        }

        if (modified) repairedCount++;
        return newC;
    });

    // 2. Repair Customers
    const repairedCustomers = data.customers.map(c => {
        const newC = { ...c };
        if (typeof newC.balance !== 'number') {
            newC.balance = 0;
        }
        return newC;
    });

    if (repairedCount > 0) {
        console.log(`[DB] Auto-Repaired ${repairedCount} records to match strict schema.`);
    }

    return {
        ...data,
        cylinders: repairedCylinders,
        customers: repairedCustomers
    };
};

const initialData: Schema = {
    // [ZERO DEFECT SYSTEM]
    // Clean Slate: No Test Data.
    
    // 1. Users (Essential Admin for System Access)
    users: [
        { id: 'admin', username: 'admin', name: '관리자', role: '관리자', password: 'admin' },
        { id: 'worker1', username: 'worker1', name: '홍길동', role: '사용자', password: '111' },
    ],

    // 2. Customers (Empty)
    customers: [],

    // 3. Cylinders (Empty)
    cylinders: [],

    // 4. Transactions (Empty)
    transactions: [],

    // 5. Gas Items (Standard Master Data)
    gasItems: [
        { id: 'O2-40L', name: '산소', capacity: '40L', color: 'green' },
        { id: 'N2-40L', name: '질소', capacity: '40L', color: 'gray' },
        { id: 'Ar-40L', name: '아르곤', capacity: '40L', color: 'yellow' },
        { id: 'CO2-20K', name: '탄산', capacity: '20kg', color: 'blue' },
    ],

    // 6. Ledger (Empty)
    dailyLedgerNotes: [],

    // 7. System Config (Default)
    systemConfig: {
        backupSchedule: '0 * * * *', // Hourly Backup
        backupPath: 'backups'
    }
};

// Simple Mutex for Concurrency Control
class Mutex {
    private queue: Promise<void> = Promise.resolve();

    public async dispatch<T>(fn: () => Promise<T> | T): Promise<T> {
        const result = this.queue.then(() => fn());
        // Catch errors solely to keep the queue sequence alive for next tasks
        this.queue = result.then(() => {}, () => {});
        return result;
    }
}

// Singleton DB connection (Mock) with Caching
export class Database {
  private data: Schema;
  private dataCache: Schema | null = null;
  private lastModified: number = 0;
  private mutex = new Mutex();
  private hasLoadError: boolean = false; // [Integrity Guard] // [NEW] Mutex Instance

  constructor() {
    this.data = this.load();
  }

  private load(): Schema {
    // [FIX VERIFIED] check file existence
    // Check if file exists
    if (!fs.existsSync(DB_PATH)) {
      // [STRICT MODE]
      // If db.json is missing, WE DO NOT AUTO-CREATE.
      // Providing an empty DB (initialData) causes massive data loss perception if the file was just accidentally moved/deleted.
      // We FORCE the admin to manually place a valid db.json or running a restore script.
      console.error("CRITICAL: 'db.json' NOT FOUND. Auto-initialization is DISABLED to prevent data loss.");
      throw new Error("CRITICAL SAFETY HALT: 'db.json' missing. System will NOT auto-initialize. Please restore 'db.json' from backup manually.");
    }

    // Check cache validity with file modification time
    try {
      const stats = fs.statSync(DB_PATH);
      const currentMTime = stats.mtimeMs;

      // Cache hit: return cached data if file hasn't changed
      if (this.dataCache && currentMTime === this.lastModified) {
        return this.dataCache;
      }

      // Cache miss: reload from disk
      const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
      
      // [Validation] Critical Size Check (Empty file check)
      if (!fileContent || fileContent.trim().length === 0) {
           throw new Error("DB File is empty (0 bytes)");
      }

      const loaded = JSON.parse(fileContent);

      this.hasLoadError = false; // Reset on success
      
      // Migration: Ensure GasItems exists and force '산소' to Green
      let gasItems = loaded.gasItems || initialData.gasItems;
      gasItems = gasItems.map((item: GasItem) => {
          if (['산소', 'Oxygen', 'O2'].some(n => item.name.includes(n))) return { ...item, color: 'green' };
          if (['질소', 'Nitrogen', 'N2'].some(n => item.name.includes(n))) return { ...item, color: 'gray' };
          if (['알곤', 'Argon', 'Ar'].some(n => item.name.includes(n))) return { ...item, color: 'grape' };
          if (['탄산', 'CO2'].some(n => item.name.includes(n))) return { ...item, color: 'blue' };
          if (['수소', 'H2'].some(n => item.name.includes(n))) return { ...item, color: 'orange' };
          if (['아세틸렌'].some(n => item.name.includes(n))) return { ...item, color: 'yellow' }; 
          if (['혼합'].some(n => item.name.includes(n))) return { ...item, color: 'cyan' };
          return item;
      });

      const result = { 
          ...initialData, 
          ...loaded,
          gasItems
      };

      // Repair Data before returning
      const repaired = validateAndRepair(result);
      
      // Update cache
      this.dataCache = repaired;
      this.data = repaired; // [Fix] Update active data reference
      this.lastModified = currentMTime;

      return repaired;
    } catch (error) {
      console.error('DB Load Error:', error);
      this.hasLoadError = true; // Block subsequent saves
      
      // Critical Safety: If we have a cache, use it. 
      if (this.dataCache) {
          console.warn('⚠️ Serving stale data from memory due to disk read failure.');
          return this.dataCache;
      }
      
      throw new Error(`CRITICAL: Failed to load db.json. Halting to prevent data loss. Error: ${error}`);
    }
  }

  public async save(): Promise<void> {
    // [NEW] Use Mutex to serialize writes
    return this.mutex.dispatch(async () => {
        const TEMP_PATH = path.join(process.cwd(), 'db.tmp');
        const BACKUP_PATH = path.join(process.cwd(), 'db.bak');

        if (this.hasLoadError) {
             const msg = "CRITICAL: Saving blocked due to previous load error. Restart server to recover.";
             console.error(msg);
             throw new Error(msg);
        }

        const safeWrite = async () => {
             // 1. Write to Temp File
             await fs.promises.writeFile(TEMP_PATH, JSON.stringify(this.data, null, 2));

             // 2. Backup valid Data if exists
             if (fs.existsSync(DB_PATH)) {
                if (fs.existsSync(BACKUP_PATH)) {
                    await fs.promises.unlink(BACKUP_PATH);
                }
                await fs.promises.rename(DB_PATH, BACKUP_PATH);
             }

             // 3. Swap Temp to Real Path
             await fs.promises.rename(TEMP_PATH, DB_PATH);

             // 4. Update cache
             const stats = fs.statSync(DB_PATH);
             this.dataCache = this.data;
             this.lastModified = stats.mtimeMs;

             // 5. Cleanup Backup (Success)
             if (fs.existsSync(BACKUP_PATH)) {
                await fs.promises.unlink(BACKUP_PATH);
             }
        };

        // [Retry Wrapper] Handle EBUSY/EPERM on Windows
        let lastError;
        for (let i = 0; i < 5; i++) {
            try {
                await safeWrite();
                return; // Success
            } catch (error: unknown) {
                lastError = error;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const err = error as any;
                if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
                    // console.warn(`[DB] Write Locked. Retrying (${i+1}/5)...`);
                    await new Promise(r => setTimeout(r, 200 * (i + 1))); // Backoff
                    continue;
                }
                break; // Non-retryable error
            }
        }

        // If we got here, all retries failed or non-retryable error occurred
        console.error('DB Atomic Save Error (Final):', lastError);

        // Rollback attempt
        try {
            if (fs.existsSync(BACKUP_PATH) && !fs.existsSync(DB_PATH)) {
                await fs.promises.rename(BACKUP_PATH, DB_PATH);
                console.log('Restored DB from backup after write failure.');
                this.dataCache = null;
                this.lastModified = 0;
            }
        } catch (rollbackError) {
            console.error('Critical: DB Restore Failed:', rollbackError);
        }
        
        throw lastError;
    });
  }

  // Reload for backup restoration or external changes
  public reload(force: boolean = false): void {
    if (force) {
        // [Zero Defect] Force invalidation of memory cache
        this.dataCache = null;
        this.lastModified = 0;
    }
    this.data = this.load();
  }

  // [NEW] Safety Backup Trigger
  public async createBackup(reason: string = 'manual'): Promise<string> {
      return this.mutex.dispatch(async () => {
          const backupDir = this.systemConfig.backupPath ? path.resolve(process.cwd(), this.systemConfig.backupPath) : path.join(process.cwd(), 'backups');
          
          if (!fs.existsSync(backupDir)) {
              fs.mkdirSync(backupDir, { recursive: true });
          }

          // [FIX] Use Local Time (KST) for backup filename
          // offset is +9 hours for KST. We can use manually constructed string to avoid timezone issues.
          const now = new Date();
          // const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // Unused
          
          // Alternatively, just formatted string:
          // const timestamp = now.toLocaleString('ko-KR', { hour12: false }).replace(/[\s\.:]/g, '-');
          // Start with Year-Month-Day-Hour-Minute-Second
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const hour = String(now.getHours()).padStart(2, '0');
          const minute = String(now.getMinutes()).padStart(2, '0');
          const second = String(now.getSeconds()).padStart(2, '0');
          
          const localTimestamp = `${year}-${month}-${day}_${hour}-${minute}-${second}`;
          const backupFile = path.join(backupDir, `db-backup-${localTimestamp}_${reason}.json`);

          await fs.promises.copyFile(DB_PATH, backupFile);
          console.log(`[DB] Created Safety Backup: ${backupFile}`);
          return backupFile;
      });
  }

  // [PERFORMANCE] Smart Accessors (Auto-Reload on Change)
  // Calls reload() which checks file mtime. If file changed, reloads. If not, returns cache.
  get users() { this.reload(); return this.data.users; }
  get customers() { this.reload(); return this.data.customers; }
  get cylinders() { this.reload(); return this.data.cylinders; }
  set cylinders(value: Cylinder[]) { this.data.cylinders = value; }
  get transactions() { this.reload(); return this.data.transactions; }
  set transactions(value: Transaction[]) { this.data.transactions = value; } 
  get gasItems() { this.reload(); return this.data.gasItems; }
  get dailyLedgerNotes() { this.reload(); return this.data.dailyLedgerNotes; }
  get systemConfig() { 
      this.reload();
      // Default fallback
      if (!this.data.systemConfig) {
          this.data.systemConfig = { backupSchedule: '0 0 * * *', backupPath: 'backups' };
      }
      return this.data.systemConfig; 
  }
  set systemConfig(value: SystemConfig) {
      if (!this.data.systemConfig) this.data.systemConfig = { backupSchedule: '0 0 * * *', backupPath: 'backups' };
      this.data.systemConfig = value;
  }

  // [NEW] Production Reset (Zero Defect Initialization)
  public async resetProduction(): Promise<void> {
      return this.mutex.dispatch(async () => {
          // 1. Create Internal Backup
          await this.createBackup('pre-production-reset');

          // 2. Filter Users (Keep Admin)
          const adminUser = this.data.users.find(u => u.username === 'admin') || {
              id: 'admin', username: 'admin', name: '관리자', role: '관리자', password: 'admin'
          };

          // 3. Reset Data (Preserve GasItems & Config)
          this.data.users = [adminUser];
          this.data.customers = [];
          this.data.cylinders = [];
          this.data.transactions = [];
          this.data.dailyLedgerNotes = [];

          // 4. Save to Disk
          await this.save();
          console.log('[DB] System Reset for Production Complete.');
      });
  }
}

// Export singleton instance
export const db = new Database();
// DB Reload Trigger: 2026-01-06 (Force Refresh)
