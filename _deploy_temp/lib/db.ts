
import { Cylinder, Customer, Transaction, User, GasItem, DailyLedgerNote, CompanySettings } from './types';
import { supabase } from './supabase';
import fs from 'fs';
import path from 'path';
import { TransactionValidator } from './transaction-validator';

const DB_PATH = path.join(process.cwd(), 'db.json');

export interface SystemConfig {
  backupSchedule: string;
  backupPath: string;
}

interface Schema {
  users: User[];
  customers: Customer[];
  cylinders: Cylinder[];
  transactions: Transaction[];
  gasItems: GasItem[];
  dailyLedgerNotes: DailyLedgerNote[];
  systemConfig: SystemConfig;
  companySettings?: CompanySettings;
}

const initialData: Schema = {
    users: [],
    customers: [],
    cylinders: [],
    transactions: [],
    gasItems: [],
    dailyLedgerNotes: [],
    systemConfig: { backupSchedule: '0 * * * *', backupPath: 'backups' },
    companySettings: { companyName: '삼덕가스공업(주)', aliases: ['삼덕', 'SDG', '삼덕가스'] }
};

class Mutex {
    private queue: Promise<void> = Promise.resolve();
    public async dispatch<T>(fn: () => Promise<T> | T): Promise<T> {
        const result = this.queue.then(() => fn());
        this.queue = result.then(() => {}, () => {});
        return result;
    }
}

export class Database {
  private data: Schema = initialData;
  private snapshot: string = JSON.stringify(initialData); 
  private mutex = new Mutex();
  private isLoaded = false;

  constructor() {
      // ⚠️ CRITICAL BUILD FIX (2026-02-09)
      // PROBLEM: Next.js 16 bundles ALL API route imports during 'npm run build'
      // When ANY api route imports { db }, this constructor executes:
      //   → Line 59: loadLocalBackup() → fs.readFileSync() (BLOCKING I/O)
      //   → Line 60: reload() → Supabase connection attempt (NETWORK TIMEOUT)
      //   → BUILD FREEZE at "compiling..."
      //
      // SOLUTION: Skip ALL initialization during build phase
      // Only run in actual runtime environments (dev server or production server)
      
      // 🔍 DEBUG: Log environment to verify guard activation
// console.log(`☁️ [DB] Delta Sync Success (${syncTasks.length} segments)`);
      this.init().catch(e => console.error('[DB] Async Init Fail:', e));
  }

  public async init() {
      if (this.isLoaded) return;
      this.loadLocalBackup();
      await this.reload(false); // [OPTIMIZATION] Lazy load if local backup exists
      this.isLoaded = true;
  }

  private loadLocalBackup() {
      try {
          if (fs.existsSync(DB_PATH)) {
              const content = fs.readFileSync(DB_PATH, 'utf8');
              const json = JSON.parse(content);
              
              if (json.customers) {
                  try {
                      this.data.customers = TransactionValidator.sanitizeCustomers(json.customers);
                  } catch (e) {
                      this.data.customers = json.customers;
                  }
              }

              if (json.cylinders) {
                  try {
                      this.data.cylinders = TransactionValidator.sanitizeCylinders(json.cylinders);
                  } catch (e) {
                      this.data.cylinders = json.cylinders;
                  }
              }

              if (json.transactions) {
                  try {
                      this.data.transactions = TransactionValidator.sanitizeTransactions(json.transactions);
                  } catch (e) {
                      this.data.transactions = json.transactions;
                  }
              }

              if (json.users) this.data.users = json.users;
              if (json.gasItems) this.data.gasItems = json.gasItems;
              if (json.companySettings) this.data.companySettings = json.companySettings; // Load settings
              
              this.snapshot = JSON.stringify(this.data);
              
              // [OPTIMIZATION] Mark sections as loaded to prevent redundant cloud fetch on init
              if (this.data.customers.length > 0) this.loadedSections.customers = true;
              if (this.data.cylinders.length > 0) this.loadedSections.cylinders = true;
              if (this.data.transactions.length > 0) this.loadedSections.transactions = true;
              if (this.data.users.length > 0) this.loadedSections.users = true;
              if (this.data.gasItems.length > 0) this.loadedSections.gasItems = true;

              console.log('📦 [DB] Loaded local backup (db.json)');
          }
      } catch (e) {
          console.error('❌ [DB] Failed to load local backup:', e);
      }
  }

  private loadedSections = {
      users: false,
      customers: false,
      cylinders: false,
      transactions: false,
      gasItems: false
  };

  public async reload(force: boolean = false): Promise<void> {
      if (!force && this.isLoaded) return;
      console.log('🔄 [DB] Full Loading...');
      
      await Promise.all([
          this.reloadUsers(force).catch(e => console.error('Failed to load users:', e)),
          this.reloadCustomers(force).catch(e => console.error('Failed to load customers:', e)),
          this.reloadCylinders(force).catch(e => console.error('Failed to load cylinders:', e)),
          this.reloadTransactions(force).catch(e => console.error('Failed to load transactions:', e)),
          this.reloadGasItems(force).catch(e => console.error('Failed to load gasItems:', e))
      ]);
      
      this.snapshot = JSON.stringify(this.data);
      console.log('✅ [DB] Full Load Complete');
      
      // [Self-Healing] Report any data repairs
      if (TransactionValidator.healingLogs.length > 0) {
          console.warn(`🚑 [Self-Healing] ${TransactionValidator.healingLogs.length} issues repaired during load.`);
          // TransactionValidator.healingLogs.forEach(log => console.log(`   - ${log}`));
          TransactionValidator.healingLogs = []; // Reset after reporting
      }
  }

  public async reloadUsers(force: boolean = false) {
      if (!force && this.loadedSections.users) return;
      const { data } = await supabase.from('users').select('*');
      if (data) this.data.users = data;
      this.loadedSections.users = true;
  }

  public async reloadCustomers(force: boolean = false) {
      if (!force && this.loadedSections.customers) return;
       const { data } = await supabase.from('customers').select('*').limit(2000);
       if (data && data.length > 0) {
              this.data.customers = TransactionValidator.sanitizeCustomers(data);
       }
       this.loadedSections.customers = true;
  }

  public async reloadCylinders(force: boolean = false) {
      if (!force && this.loadedSections.cylinders) return;
      const { data } = await supabase.from('cylinders').select('*').limit(30000);
      if (data && data.length > 0) {
            this.data.cylinders = TransactionValidator.sanitizeCylinders(data);
      }
      this.loadedSections.cylinders = true;
  }

  public async reloadTransactions(force: boolean = false) {
      if (!force && this.loadedSections.transactions) return;
      const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(5000);
      if (data && data.length > 0) {
          this.data.transactions = TransactionValidator.sanitizeTransactions(data);
      }
      this.loadedSections.transactions = true;
  }

  public async reloadGasItems(force: boolean = false) {
      if (!force && this.loadedSections.gasItems) return;
      const { data } = await supabase.from('gas_items').select('*');
      if (data) this.data.gasItems = data;
      this.loadedSections.gasItems = true;
  }

  public async save(): Promise<void> {
      // Direct call using the main mutex for public access
      return this.mutex.dispatch(async () => {
          await this.executeSaveInternal();
      });
  }

  private async executeSaveInternal(retryCount = 0): Promise<void> {
          if (!this.isLoaded) return;

          const currentSnapshot = JSON.stringify(this.data);
          if (currentSnapshot === this.snapshot) return;

          const prev = JSON.parse(this.snapshot) as Schema;

          // A. Local Persistence
          if (process.env.NODE_ENV === 'development') {
              try {
                  fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
              } catch (err) {
                  console.error('❌ [DB] Local Save Failed:', err);
              }
          }

          // B. Optimized Cloud Sync (Delta)
          try {
              const [changedCyl, changedTx, changedCus, changedGas] = [
                  this.getDiff(prev.cylinders, this.data.cylinders),
                  this.getDiff(prev.transactions, this.data.transactions),
                  this.getDiff(prev.customers, this.data.customers),
                  this.getDiff(prev.gasItems, this.data.gasItems)
              ];

              const syncTasks = [];

              if (changedCyl.length > 0) {
                  syncTasks.push(supabase.from('cylinders').upsert(changedCyl.map(c => ({
                      id: c.id, serial_number: c.serialNumber, gas_type: c.gasType,
                      status: c.status, location: c.currentHolderId || '삼덕공장',
                      owner: c.owner || 'SAMDUK', charging_expiry_date: c.chargingExpiryDate,
                      last_inspection_date: c.lastInspectionDate, capacity: c.capacity,
                      container_type: c.containerType, is_deleted: c.isDeleted || false
                  }))));
              }

              if (changedTx.length > 0) {
                  syncTasks.push(supabase.from('transactions').upsert(changedTx.map(t => ({
                      id: t.id, date: t.timestamp, type: t.type,
                      cylinderId: t.cylinderId, customerId: t.customerId || '삼덕공장',
                      workerId: t.workerId || 'SYSTEM'
                  }))));
              }

              if (changedCus.length > 0) {
                  syncTasks.push(supabase.from('customers').upsert(changedCus.map(c => ({
                      id: c.id, name: c.name, phone: c.phone, address: c.address,
                      manager: c.representative, tanks: c.tanks, balance: c.balance,
                      type: c.type, payment_type: c.paymentType, is_deleted: c.isDeleted
                  }))));
              }

              if (syncTasks.length > 0) {
                  const results = await Promise.all(syncTasks);
                  const errors = results.filter(r => r.error);
                  if (errors.length > 0) throw new Error(`Cloud Sync failed for ${errors.length} segments`);
                  console.log(`☁️ [DB] Delta Sync Success (${syncTasks.length} segments)`);
              }

          } catch (cloudErr) {
              console.error(`❌ [DB] Cloud Sync Error (Attempt ${retryCount + 1}):`, cloudErr);
              if (retryCount < 2) {
                  setTimeout(() => this.executeSaveInternal(retryCount + 1), 5000 * (retryCount + 1));
              }
          }
          
          this.snapshot = currentSnapshot;
  }

  /**
   * [OPTIMIZED] Shallow compare + property check before deep JSON stringify.
   */
  private getDiff<T extends { id: string, updatedAt?: string }>(prevList: T[], newList: T[]): T[] {
      const changes: T[] = [];
      if (!prevList || prevList.length === 0) return newList || [];
      
      const prevMap = new Map(prevList.map(i => [i.id, i]));
      for (const item of (newList || [])) {
          const prevItem = prevMap.get(item.id);
          // If updatedAt exists, use it first for speed
          if (!prevItem) {
              changes.push(item);
          } else if (item.updatedAt && prevItem.updatedAt && item.updatedAt !== prevItem.updatedAt) {
              changes.push(item);
          } else if (JSON.stringify(prevItem) !== JSON.stringify(item)) {
              changes.push(item);
          }
      }
      return changes;
  }

  // Expose Supabase client for direct operations (Admin/Seed)
  // Atomic Update Methods [Transaction Lock]
  public async transaction(fn: (data: Schema) => Promise<void> | void): Promise<void> {
      return this.mutex.dispatch(async () => {
          await fn(this.data);
          await this.executeSaveInternal();
      });
  }

  public async updateCylinders(updater: (data: Cylinder[]) => Cylinder[]): Promise<void> {
      return this.mutex.dispatch(async () => {
          this.data.cylinders = updater([...this.data.cylinders]);
          await this.executeSaveInternal();
      });
  }

  public async updateTransactions(updater: (data: Transaction[]) => Transaction[]): Promise<void> {
      return this.mutex.dispatch(async () => {
          this.data.transactions = updater([...this.data.transactions]);
          await this.executeSaveInternal();
      });
  }

  public async updateCustomers(updater: (data: Customer[]) => Customer[]): Promise<void> {
      return this.mutex.dispatch(async () => {
          this.data.customers = updater([...this.data.customers]);
          await this.executeSaveInternal();
      });
  }

  public get supabase() { return supabase; }

  get users() { return this.data.users; }
  set users(value: User[]) { this.data.users = value; }
  get customers() { return this.data.customers; }
  set customers(value: Customer[]) { this.data.customers = value; }
  get cylinders() { return this.data.cylinders; }
  set cylinders(value: Cylinder[]) { this.data.cylinders = value; }
  get transactions() { return this.data.transactions; }
  set transactions(value: Transaction[]) { this.data.transactions = value; } 
  get gasItems() { return this.data.gasItems; }
  set gasItems(value: GasItem[]) { this.data.gasItems = value; }
  get dailyLedgerNotes() { return this.data.dailyLedgerNotes; }
  set dailyLedgerNotes(value: DailyLedgerNote[]) { this.data.dailyLedgerNotes = value; }
  get systemConfig() { return this.data.systemConfig; }
  set systemConfig(value: SystemConfig) { this.data.systemConfig = value; }
  get companySettings() { return this.data.companySettings; }
  set companySettings(value: CompanySettings | undefined) { this.data.companySettings = value; }

  public async resetProduction(): Promise<void> {}
}

export const db = new Database();
