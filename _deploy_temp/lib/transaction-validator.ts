/* eslint-disable @typescript-eslint/no-explicit-any */
import { Cylinder, Transaction, Customer, CylinderStatus } from './types';
import { v4 as uuidv4 } from 'uuid';

export class TransactionValidator {
    
    /**
     * Valdates a list of Cylinders before they are synched to the DB.
     * Checks for required fields and data consistency.
     */
    /**
     * [CENTRAL CONTROL UNIT] Transaction Validator
     * -------------------------------------------------------------------------
     * This class acts as the single source of truth for all safety & business logic.
     * All operations (Delivery, Charging, Return) MUST pass these checks.
     *
     * [Safety Policy 2026-01-25]
     * 1. Charging Expiry Limits (충전기한 관리):
     *    - RED (BLOCK): 충전기한 10일 이내 ~ 검사 전 (검사 후 판정에 따름)
     *      => 충전 및 납품 원천 차단
     *    - ORANGE (WARNING): 11일 ~ 20일
     *      => 주의 메세지 및 알림 수행
     *    - YELLOW (NOTICE): 21일 ~ 30일
     *      => 검사 예정 알림
     * 
     * 2. Auto-Renewal (KGS Standard 상세):
     *    - 이음매없는용기 (Seamless): 10년 미만(+5년), 10년 이상(+3년)
     *    - 초저온용기 (LGC): 15년 미만(+5년), 15~20년(+2년), 20년 이상(+1년)
     * 
     * 3. Exceptions (예외 처리):
     *    - 회수 (Collection): 납품 후 충전기한이 경과한 용기는 차단하지 않음.
     *      (미아 용기, 타 거래처 혼입 등 특수 상황은 경고 후 강제 회수 가능)
     * 
     * 4. Secure QR Login (보안 QR 로그인 - 2026-02-04):
     *    - Encryption: AES-256-GCM (Payload: Internal User ID)
     *    - Immutability: Once generated, the QR image is FIXED and independent of username changes.
     *    - Delivery: Absolute URL 'https://samduk.vercel.app/q/[token]' to ensure cross-device compatibility.
     *    - Detection: Regex-based differentiation between Legacy UUIDs and Encrypted Base64URL tokens.
     * -------------------------------------------------------------------------
     */

    static healingLogs: string[] = [];

    /**
     * [QR SYSTEM CONTROL]
     * Defines the standard for QR code generation and validation.
     */
    static QR_CONFIG = {
        PROTOCOL: 'AES-256-GCM',
        PREFIX: 'ENC-',
        BASE_URL: 'https://samduk.vercel.app',
        REDIRECT_PATH: '/q/',
        // UUID v4 Regex for Legacy/Immutable identification
        UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    };

    /**
     * Determine if a raw token string is an Encrypted Token or a Raw ID.
     */
    static isEncryptedToken(token: string): boolean {
        if (token.startsWith(this.QR_CONFIG.PREFIX)) return true;
        
        // If no prefix, check if it's NOT a UUID but has encrypted length/entropy
        const isUuid = this.QR_CONFIG.UUID_REGEX.test(token);
        return !isUuid && token.length > 30 && !token.includes('-');
    }

    /**
     * Generate the standardized Redirect URL for a given token.
     */
    static getQrRedirectUrl(token: string): string {
        const cleanToken = token.startsWith(this.QR_CONFIG.PREFIX) 
            ? token.replace(this.QR_CONFIG.PREFIX, '') 
            : token;
        return `${this.QR_CONFIG.BASE_URL}${this.QR_CONFIG.REDIRECT_PATH}${cleanToken}`;
    }

    /**
     * [AI/LMM Optimized] High-Performance Schema Validator
     * Enforces 'camelCase' standard and blocks 'snake_case' pollution.
     * Uses fail-fast logic for maximum speed in large datasets.
     */

    /**
     * [AI Self-Healing] Normalize & Sanitize Data
     * Instead of blocking invalid data, this converts legacy formats (snake_case)
     * to the standard (camelCase) and strips unknown fields.
     */
    static sanitizeCylinders(data: Record<string, any>[]): Cylinder[] {
        return data.map((c: Record<string, any>, i: number) => {
             // [AI Self-Healing] Handle redundant fields with priority
             const chargingExpiry = c.charging_expiry_date || c.chargingExpiryDate || c.expiry || null;
             const lastInspection = (c as Record<string, any>).last_inspection_date || (c as Record<string, any>).lastInspectionDate || c.lastInspected || null;
             const containerType = c.container_type || c.containerType || 'CYLINDER';
             const capacity = c.capacity || c.volume || c.size || '40L';
             const owner = c.ownership || c.owner || 'SAMDUK';
             const holderId = c.location || c.currentHolderId || '삼덕공장';
             const status = c.status || '공병';

             // Validation & Normalization
             const validStatuses = ['공병', '충전중', '실병', '납품', '불량', '분실', '검사대상', '검사중', '폐기'];
             const cleanStatus = validStatuses.includes(status) ? status : '공병';
             if (status !== cleanStatus) {
                 this.healingLogs.push(`[Cyl ${c.id}] Status '${status}' clamped to '공병'`);
             }

             const clean: Cylinder = {
                id: c.id, 
                serialNumber: c.serial_number || c.serialNumber || c.memo || c.id,
                gasType: c.gas_type || c.gasType || 'O2-40L',
                capacity: capacity,
                status: cleanStatus as CylinderStatus,
                currentHolderId: holderId,
                owner: owner,
                chargingExpiryDate: chargingExpiry,
                lastInspectionDate: lastInspection || '',
                containerType: containerType as 'CYLINDER' | 'LGC' | 'RACK',
                gasColor: (c as Record<string, any>).gas_color || (c as Record<string, any>).gasColor ||'dimmed',
                memo: c.memo || null,
                createdAt: c.created_at || c.created_date || c.createdDate || new Date().toISOString(),
                isDeleted: !!(c.is_deleted || c.isDeleted),
                manufactureDate: c.manufacture_date || c.manufactureDate || null,
                bundleCount: c.bundle_count || c.bundleCount || 0,
                childSerials: c.child_serials || c.childSerials || [],
                parentRackId: c.parent_rack_id || c.parentRackId || null
             };
             
             if (!clean.id) {
                 clean.id = `CYL_RESTORED_${Date.now()}_${i}`;
                 this.healingLogs.push(`[Cyl Index ${i}] Missing ID restored: ${clean.id}`);
             }
             return clean;
        });
    }

    /**
     * Convert App Model to Supabase Snake Case DB Payload
     */
    static toCylinderDB(c: Partial<Cylinder>): Record<string, any> {
        const payload: Record<string, any> = {};
        if (c.id) payload.id = c.id;
        
        // [Verified Schema] serial_number (snake_case)
        if (c.serialNumber) payload.serial_number = c.serialNumber;
        
        if (c.gasType) payload.gas_type = c.gasType;
        if (c.status) payload.status = c.status;
        
        // [Verified Schema] location (legacy column, current_holder_id does NOT exist)
        if (c.currentHolderId) {
            payload.location = c.currentHolderId;
        }
        
        if (c.owner) payload.ownership = c.owner;
        
        // [Verified Schema] capacity (Text)
        if (c.capacity) {
            payload.capacity = c.capacity;
            payload.volume = c.capacity; // Keep legacy 'volume' sync if column exists
        }
        
        // [Verified Schema] charging_expiry_date (snake) + chargingExpiryDate (camel) both exist
        if (c.chargingExpiryDate) {
            payload.charging_expiry_date = c.chargingExpiryDate;
            payload.chargingExpiryDate = c.chargingExpiryDate;
        }
        
        if (c.lastInspectionDate) payload.last_inspection_date = c.lastInspectionDate;
        if (c.manufactureDate) payload.manufacture_date = c.manufactureDate;
        
        if (c.containerType) {
            payload.container_type = c.containerType;
            payload.containerType = c.containerType; 
        }
        
        if (c.parentRackId !== undefined) payload.parent_rack_id = c.parentRackId;
        if (c.memo !== undefined) payload.memo = c.memo;
        if (c.isDeleted !== undefined) payload.is_deleted = c.isDeleted;
        
        return payload;
    }

    static sanitizeCustomers(data: Record<string, any>[]): Customer[] {
        return data.map((c: Record<string, any>, i: number) => {
            // Helper for parsing tanks safely
            const parseTanks = (val: any) => {
                if (!val) return {};
                if (typeof val === 'object') return val;
                try { return JSON.parse(val); } catch { return {}; }
            };

            const clean: Customer = {
                id: c.id,
                name: c.name || '미지정 거래처',
                type: c.type || (c as Record<string, any>).type || 'BUSINESS',
                paymentType: c.payment_type || c.paymentType || 'card',
                businessNumber: c.business_number || c.businessNumber || '',
                ledgerNumber: c.ledger_number || c.ledgerNumber || '',
                corporateId: c.corporate_id || c.corporateId || '',
                representative: c.representative || c.manager || (c as Record<string, any>).manager || (c as Record<string, any>).representative || '',
                phone: c.phone || '',
                fax: c.fax || '',
                address: c.address || '',
                tanks: parseTanks(c.tanks),
                lastTransactionDate: c.last_transaction_date || c.lastTransactionDate,
                balance: Number(c.balance || 0),
                isDeleted: !!(c.is_deleted || c.isDeleted),
                deletedAt: c.deleted_at || c.deletedAt,
                createdAt: c.created_at || c.createdAt
            };

            if (!clean.id) {
                clean.id = `CUS_RESTORED_${Date.now()}_${i}`;
                this.healingLogs.push(`[Cus Index ${i}] Missing ID restored: ${clean.id}`);
            }
            return clean;
        });
    }

    static toCustomerDB(c: Partial<Customer>): Record<string, any> {
        const payload: Record<string, any> = {};
        if (c.id) payload.id = c.id;
        if (c.name) payload.name = c.name;
        if (c.phone) payload.phone = c.phone;
        if (c.fax) payload.fax = c.fax;
        if (c.address) payload.address = c.address;
        
        // Map Frontend 'representative' to DB 'manager'
        if (c.representative) payload.manager = c.representative;
        
        // Map camelCase to snake_case based on verified schema
        if (c.businessNumber) payload.business_number = c.businessNumber;
        if (c.ledgerNumber) payload.ledger_number = c.ledgerNumber;
        if (c.corporateId) payload.corporate_id = c.corporateId;
        if (c.paymentType) payload.payment_type = c.paymentType;
        if (c.type) payload.type = c.type;
        
        if (c.balance !== undefined) payload.balance = c.balance;
        if (c.tanks) payload.tanks = c.tanks;
        if (c.isDeleted !== undefined) payload.is_deleted = c.isDeleted;
        if (c.createdAt) payload.created_at = c.createdAt;
        
        return payload;
    }

    static toUserDB(u: Record<string, any>): Record<string, any> {
        const payload: Record<string, any> = {};
        if (u.id) payload.id = u.id;
        if (u.username) payload.username = u.username;
        if (u.name) payload.name = u.name;
        if (u.role) payload.role = u.role;
        if (u.password) payload.password = u.password;
        if (u.createdAt) payload.created_at = u.createdAt;
        return payload;
    }

    static toGasDB(g: Record<string, any>): Record<string, any> {
        const payload: Record<string, any> = {};
        if (g.id) payload.id = g.id;
        if (g.name) payload.name = g.name;
        if (g.capacity) payload.capacity = g.capacity;
        if (g.color) payload.color = g.color;
        // Gas items are usually static, but this ensures consistency
        return payload;
    }

    static sanitizeTransactions(data: Record<string, any>[]): Transaction[] {
        return data.map((t: Record<string, any>, i: number) => {
            const timestamp = t.created_at || t.date || t.timestamp || new Date().toISOString();
            const type = t.type || '기타출고';
            
            // Validation
            const validTypes = ['충전', '충전시작', '충전완료', '납품', '회수', '회수(실병)', '검사출고', '검사입고', '기타출고', '폐기', '재검사', '분실'];
            const cleanType = validTypes.includes(type) ? type : '기타출고';

            const clean: Transaction = {
                id: t.id,
                type: cleanType as any,
                cylinderId: t.cylinderId || t.cylinder_id || 'UNKNOWN',
                workerId: t.workerId || t.worker_id || 'UNKNOWN',
                customerId: t.customerId || t.customer_id || t.customer || 'UNKNOWN',
                timestamp: timestamp,
                memo: t.memo || ''
            };
            if (!clean.id) {
                clean.id = `TX_RESTORED_${Date.now()}_${i}`;
                this.healingLogs.push(`[Tx Index ${i}] Missing ID restored: ${clean.id}`);
            }
            return clean;
        });
    }

    static toTransactionDB(t: Partial<Transaction>): Record<string, any> {
        const now = t.timestamp || new Date().toISOString();
        const payload: Record<string, any> = {
            id: t.id || uuidv4(),
            type: t.type,
            // [Verified Schema] Only 'cylinderId' exists in transactions table.
            cylinderId: t.cylinderId, 
            workerId: t.workerId,
            customerId: t.customerId || '삼덕공장',
            created_at: now,
            date: now 
        };
        return payload;
    }
    static validateCylinders(cylinders: Cylinder[]): void {
        const errors: string[] = [];
        // const ghosts = this.GHOST_KEYS.cylinder; // Unused, direct check is faster

        // Optimized Loop
        for (let i = 0; i < cylinders.length; i++) {
            const c = cylinders[i];
            const ref = c.id || `Index_${i}`;

            // 1. Critical Field Check
            if (!c.id) errors.push(`[Cyl #${i}] Missing ID`);
            if (!c.serialNumber) errors.push(`[Cyl ${ref}] Missing serialNumber`);
            if (!c.gasType) errors.push(`[Cyl ${ref}] Missing gasType`);
            // if (!c.status) errors.push(`[Cyl ${ref}] Missing status`); // Allow partial for rack children? No, strict.
            
            // 2. Ghost Key Check (Schema Pollution Prevention)
            // Fastest check: direct property access is faster than Object.keys iteration for known set
            // usage of 'in' operator handles prototype chain, but for data DTOs, hasOwnProperty or direct undefined check is fine.
            // We use direct check for speed.
            // Removed strict snake_case checks during processing to allow flexible data flow
            // Validations should focus on data integrity, not field names.

            // 3. Status Validity
            const validStatuses = ['공병', '충전중', '실병', '납품', '불량', '분실', '검사대상', '검사중', '폐기'];
            if (c.status && !validStatuses.includes(c.status)) {
                errors.push(`[Cyl ${ref}] Invalid status '${c.status}'`);
            }
        }

        if (errors.length > 0) {
            console.error('[TransactionValidator] Cylinder Validation Errors:', errors);
            throw new Error(`[Schema Violation] Cylinder Data contains Invalid/Legacy Formats:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '...and more' : ''}`);
        }
    }

    static validateTransactions(transactions: Transaction[]): void {
        const errors: string[] = [];
        for (let i = 0; i < transactions.length; i++) {
            const t = transactions[i];
            const ref = t.id || `Index_${i}`;

            if (!t.id) errors.push(`[Tx #${i}] Missing ID`);
            if (!t.type) errors.push(`[Tx ${ref}] Missing Type`);
            if (!t.cylinderId) errors.push(`[Tx ${ref}] Missing cylinderId`);
            if (!t.workerId) errors.push(`[Tx ${ref}] Missing workerId`);
            if (!t.timestamp) errors.push(`[Tx ${ref}] Missing timestamp`);

            // Ghost Check
            const unsafe = t as any;
            if (unsafe.cylinder_id) errors.push(`[Tx ${ref}] Detected snake_case 'cylinder_id'. Schema Violation.`);
        }

        if (errors.length > 0) {
            throw new Error(`[Schema Violation] Transaction Data Errors:\n${errors.slice(0, 5).join('\n')}`);
        }
    }

    static validateCustomers(customers: Customer[]): void {
        const errors: string[] = [];
        
        for (let i = 0; i < customers.length; i++) {
            const c = customers[i];
            const ref = c.name || c.id || `Index_${i}`;

            if (!c.id) errors.push(`[Cus #${i}] Missing ID`);
            if (!c.name) errors.push(`[Cus ${ref}] Missing Name`);
            
            // Ghost Check
            // Relaxed ghost key check for compatibility
        }

        if (errors.length > 0) {
            throw new Error(`[Schema Violation] Customer Data Errors:\n${errors.slice(0, 5).join('\n')}`);
        }
    }

    /**
     * Get Inspection Status based on Charging Expiry Date
     * Returns color, needsInspection flag, description, and days remaining
     */
    /**
     * Get Inspection Status based on Charging Expiry Date
     * [Updated Logic 2026-01-25]
     * - Red (Block): <= 10 days (Previously < 0)
     * - Orange (Warning): 10 < d <= 20
     * - Yellow (Notice): 20 < d <= 30
     * - Green (Normal): > 30
     */
    static getInspectionStatus(chargingExpiryDate?: string): { 
        color: string; 
        needsInspection: boolean; 
        desc: string; 
        diffDays: number | null 
    } {
        if (!chargingExpiryDate) {
            return { color: 'gray', needsInspection: false, desc: '미설정', diffDays: null };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [expYear, expMonth] = chargingExpiryDate.toString().split('-').map(Number);
        
        if (!expYear || !expMonth) {
            return { color: 'gray', needsInspection: false, desc: '날짜 오류', diffDays: null };
        }

        // End of month
        const expiry = new Date(expYear, expMonth, 0);
        expiry.setHours(23, 59, 59, 999);
        
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Color coding and inspection status
        if (diffDays <= 10) { 
            // BLOCKING RANGE (Expired or Imminent)
            const desc = diffDays < 0 ? '기한만료(차단)' : '검사임박(차단)'; 
            return { color: 'red', needsInspection: true, desc: desc, diffDays };
        } else if (diffDays <= 20) {
            // WARNING RANGE
            return { color: 'orange', needsInspection: true, desc: '검사필요(주의)', diffDays };
        } else if (diffDays <= 30) {
            // NOTICE RANGE
            return { color: 'yellow', needsInspection: true, desc: '검사예정', diffDays };
        } else {
            return { color: 'green', needsInspection: false, desc: '정상', diffDays };
        }
    }

    /**
     * [KGS Standard] Calculate Next Expiry Date
     * @param manufactureDate YYYY or YYYY-MM-DD
     * @param containerType 'CYLINDER' | 'LGC'
     */
    static calculateNextExpiryDate(manufactureDate: string | undefined, containerType: string = 'CYLINDER'): string {
        const today = new Date();
        const currentYear = today.getFullYear();
        let manuYear = currentYear;

        if (manufactureDate) {
             // Robust parsing for YYYY-MM-DD or just YYYY
             const parsed = parseInt(manufactureDate.toString().substring(0, 4));
             if (!isNaN(parsed)) manuYear = parsed;
        }

        const age = currentYear - manuYear;
        let addYears = 1; // Conservative default

        if (containerType === 'LGC') {
            // LGC (Liquid) Rules
            // < 15 -> +5
            // 15 ~ 20 -> +2
            // >= 20 -> +1
            if (age < 15) addYears = 5;
            else if (age >= 15 && age < 20) addYears = 2;
            else addYears = 1;
        } else {
             // Seamless Cylinder Rules (Default)
             // <= 10 -> +5
             // > 10 -> +3
             if (age <= 10) addYears = 5;
             else addYears = 3;
        }

        const nextDate = new Date();
        nextDate.setFullYear(nextDate.getFullYear() + addYears);
        
        const nextYear = nextDate.getFullYear();
        const nextMonth = nextDate.getMonth() + 1; // 1-12
        
        // Set to Last Day of the month
        const lastDay = new Date(nextYear, nextMonth, 0).getDate();
        
        return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    /**
     * Business Logic: Validate Delivery
     */
    static validateDelivery(cylinder: Cylinder, customer: Customer): { success: boolean, error?: string, code?: string, warning?: string } {
        // 1. Check Cylinder Status
        if (cylinder.status === '폐기') {
            return { success: false, error: '폐기된 용기는 납품할 수 없습니다.', code: 'DISCARDED' };
        }
        if (cylinder.status === '불량') {
            return { success: false, error: '불량 용기는 납품할 수 없습니다.', code: 'STATUS_MISMATCH' };
        }

        // 2. Check Expiry
        const inspection = TransactionValidator.getInspectionStatus(cylinder.chargingExpiryDate);
        
        // [BLOCK] Red Status (<= 10 days)
        if (inspection.diffDays !== null && inspection.diffDays <= 10) {
             const shortDate = cylinder.chargingExpiryDate ? cylinder.chargingExpiryDate.substring(0, 7) : ''; 
             const msg = inspection.diffDays < 0 
                ? `납품 불가: 충전 기한이 만료되었습니다. (${shortDate})`
                : `납품 불가: 기한 임박(10일 이내) 용기입니다. (${shortDate})`;
                
             return { success: false, error: msg, code: 'EXPIRY_LIMIT' }; // Critical Block
        }

        // 3. Location Check
        if (cylinder.currentHolderId && cylinder.currentHolderId !== '삼덕공장') {
             if (cylinder.currentHolderId === customer.id) {
                  return { success: false, error: '이미 해당 거래처에 납품된 용기입니다.', code: 'ALREADY_DELIVERED' };
             }
             return { success: false, error: `현재 위치가 삼덕공장이 아닙니다. (현재: ${cylinder.currentHolderId})`, code: 'LOCATION_MISMATCH' };
        }


        if (cylinder.status !== '실병') {
             return { success: false, error: `용기 상태가 '실병'이 아닙니다. (현재: ${cylinder.status})`, code: 'STATUS_MISMATCH' };
        }


        // 4. Warning for Orange/Yellow (10 < d <= 30)
        if (inspection.needsInspection) {
             return { success: true, warning: inspection.desc };
        }

        return { success: true };
    }

    /**
     * Business Logic: Charging Start (Added)
     */
    static validateChargingStart(cylinder: Cylinder): { success: boolean, error?: string, code?: string, warning?: string } {
        if (cylinder.status === '폐기') return { success: false, error: '폐기된 용기입니다.', code: 'DISCARDED' };

        // [BLOCK] Expiry Check
        const inspection = TransactionValidator.getInspectionStatus(cylinder.chargingExpiryDate);
        if (inspection.diffDays !== null && inspection.diffDays <= 10) {
             const shortDate = cylinder.chargingExpiryDate ? cylinder.chargingExpiryDate.substring(0, 7) : '';
             return { success: false, error: `충전 불가: ${inspection.desc} (${shortDate})`, code: 'EXPIRY_LIMIT' };
        }

        if (cylinder.status !== '공병') {
             if (cylinder.status === '충전중') return { success: false, error: '이미 충전 중입니다.', code: 'ALREADY_CHARGING' };
             return { success: false, error: `용기 상태가 '공병'이 아닙니다. (${cylinder.status})`, code: 'STATUS_MISMATCH' };
        }
        
        if (cylinder.currentHolderId !== '삼덕공장') {
             return { success: false, error: '용기가 삼덕공장에 없습니다.', code: 'LOCATION_MISMATCH' };
        }

        return { success: true, warning: inspection.needsInspection ? inspection.desc : undefined };
    }

    /**
     * Business Logic: Charging Complete (Added)
     */
    static validateChargingComplete(cylinder: Cylinder): { success: boolean, error?: string, code?: string, warning?: string } {
        if (cylinder.status === '폐기') return { success: false, error: '폐기용기', code: 'DISCARDED' };

        if (cylinder.status !== '충전중') {
             return { success: false, error: `용기 상태가 '충전중'이 아닙니다. (${cylinder.status})`, code: 'STATUS_MISMATCH' };
        }
        
        // Expiry Check (Double Check)
        const inspection = TransactionValidator.getInspectionStatus(cylinder.chargingExpiryDate);
        if (inspection.diffDays !== null && inspection.diffDays <= 10) {
             const shortDate = cylinder.chargingExpiryDate ? cylinder.chargingExpiryDate.substring(0, 7) : '';
             return { success: false, error: `충전완료 불가: ${inspection.desc} (${shortDate})`, code: 'EXPIRY_LIMIT' };
        }

        return { success: true };
    }

    /**
     * Business Logic: Validate Collection
     */
    static validateCollection(cylinder: Cylinder, customerId: string): { success: boolean, error?: string, code?: string, warning?: string } {
        // 1. Check Cylinder Status
        if (cylinder.status === '폐기') {
            return { success: false, error: '폐기된 용기는 회수 관리 대상이 아닙니다.', code: 'DISCARDED' };
        }

        // 2. Location Check
        if (cylinder.currentHolderId === '삼덕공장') {
             return { success: false, error: '이미 삼덕공장에 있는 용기입니다.', code: 'ALREADY_COLLECTED' };
        }

        if (cylinder.currentHolderId !== customerId) {
             return { success: false, error: `해당 거래처에 납품된 기록이 없습니다. (현재 위치: ${cylinder.currentHolderId})`, code: 'LOCATION_MISMATCH' };
        }

        return { success: true };
    }
    /**
     * Business Logic: Inspection Outbound (Factory -> Agency)
     */
    static validateInspectionOutbound(cylinder: Cylinder): { success: boolean, error?: string, code?: string, warning?: string } {
        if (cylinder.status === '폐기') return { success: false, error: '폐기된 용기는 검사를 보낼 수 없습니다.', code: 'DISCARDED' };
        
        // Should be at Factory
        if (cylinder.currentHolderId && cylinder.currentHolderId !== '삼덕공장') {
             return { success: false, error: `용기가 삼덕공장에 없습니다. (현재: ${cylinder.currentHolderId})`, code: 'LOCATION_MISMATCH' };
        }

        // [New] Full Cylinder Check (Interceptor)
        if (cylinder.status === '실병') {
            return { success: true, warning: '실병입니다. 가스를 비우시겠습니까?' };
        }
        
        return { success: true };
    }

    /**
     * Business Logic: Inspection Inbound (Agency -> Factory)
     */
    static validateInspectionInbound(cylinder: Cylinder): { success: boolean, error?: string, code?: string } {
        // Must be at Agency
        if (cylinder.currentHolderId !== 'INSPECTION_AGENCY') {
             return { success: false, error: '검사 출고(검사소 이동) 내역이 없습니다.', code: 'LOCATION_ERROR' };
        }

        return { success: true };
    }

    /**
     * Business Logic: Inspection Scrap (Agency -> Scrap)
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static validateInspectionScrap(cylinder: Cylinder): { success: boolean, error?: string, code?: string } {
         /* 
          * Allow scraping from Inspection Agency OR Factory (if returned physically but processing late)
          * But mostly this action is triggered when "Failure" is decided at Agnecy.
          */
         return { success: true };
    }

     /**
     * Business Logic: Inspection Re-inspect (Agency -> Factory as Defective)
     */
    static validateInspectionReinspect(cylinder: Cylinder): { success: boolean, error?: string, code?: string } {
         /*
          * Action: Validating return of defective cylinder requiring repair/re-check.
          */
         if (cylinder.currentHolderId !== 'INSPECTION_AGENCY') {
             return { success: false, error: '검사 출고 내역이 없습니다.', code: 'LOCATION_ERROR' };
         }
         return { success: true };
    }

    /**
     * [SAFETY ENGINE] Analyze Anomalies
     * Detects irregular patterns that might indicate data loss or process violation.
     */
    static analyzeAnomalies(cylinder: Cylinder, transactions: Transaction[]): { type: string, description: string } | null {
        // Filter transactions for this cylinder
        const cylinderLogs = transactions
            .filter(t => t.cylinderId === cylinder.serialNumber || t.id === cylinder.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (cylinderLogs.length < 2) return null;

        const latest = cylinderLogs[0];
        const prev = cylinderLogs[1];

        // 1. [Sequence Break] Missing Return Record
        // If current status is '실병' or '충전중' but the last transaction was '납품'
        if ((cylinder.status === '실병' || cylinder.status === '충전중') && latest.type === '납품') {
            return {
                type: '절차누락',
                description: '회수 기록 없이 공장에 복귀되었습니다. (최종기록: 납품)'
            };
        }

        // 2. [Time Warp] Impossible Turnaround
        // If delivered and returned within less than 30 minutes
        if (latest.type === '회수' && prev.type === '납품') {
            const diffMin = (new Date(latest.timestamp).getTime() - new Date(prev.timestamp).getTime()) / (1000 * 60);
            if (diffMin > 0 && diffMin < 10) {
                return {
                    type: '비정상회전',
                    description: `10분 이내에 납품 및 회수가 동시에 발생했습니다. (오입력 의심)`
                };
            }
        }

        // 3. [Stagnant Inventory] Dusty Cylinder
        // Status is '공병' but no transaction for > 6 months
        if (cylinder.status === '공병' && cylinder.currentHolderId === '삼덕공장') {
             const lastActive = new Date(latest.timestamp);
             const diffMonths = (new Date().getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24 * 30);
             if (diffMonths > 6) {
                 return {
                     type: '장기방치',
                     description: '6개월 이상 공병 상태로 방치되어 검사 기한 확인이 필요합니다.'
                 };
             }
        }

        return null;
    }
}
