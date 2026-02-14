import { supabase } from '@/lib/supabase';
import { Customer, Cylinder, User } from './types';
import { parseSmartScan } from './smart-scan-logic';
import { TransactionValidator } from './transaction-validator';

export type ScanResult = 
    | { type: 'CUSTOMER'; data: Customer }
    | { type: 'CYLINDER'; data: Cylinder }
    | { type: 'USER'; data: User }
    | null;

/**
 * 2-Channel Verification Logic (Async / Supabase Version)
 * Channel 1: Intent Analysis
 * Channel 2: Data Verification (Supabase)
 */
export const resolveSmartScan = async (rawQr: string): Promise<ScanResult> => {
    const parse = parseSmartScan(rawQr);
    if (!parse) return null;

    const { cleanTarget, intent } = parse;

    // Parallel Fetching based on intention
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promises: Promise<any>[] = [];

    // --- CUSTOMERS ---
    let matchedCustomers: Customer[] = [];
    if (intent !== 'CYLINDER' && intent !== 'USER') {
        const isNumeric = /^\d+$/.test(cleanTarget);
        
        const conditions = [
            `id.eq.${cleanTarget}`,
            `name.ilike.%${cleanTarget}%`
        ];
        
        if (isNumeric) {
            conditions.push(`ledger_number.eq.${cleanTarget}`);
            conditions.push(`business_number.ilike.%${cleanTarget}%`);
        } else {
             conditions.push(`business_number.eq.${cleanTarget}`);
        }

        const query = supabase.from('customers').select('*')
            .or(conditions.join(','))
            .limit(5);

        promises.push(query.then(({ data }: { data: any }) => matchedCustomers = TransactionValidator.sanitizeCustomers(data || [])));
    } else {
        promises.push(Promise.resolve());
    }

    // --- CYLINDERS ---
    let matchedCylinders: Cylinder[] = [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(cleanTarget);

    if (intent !== 'CUSTOMER' && intent !== 'USER') {
        let condition = `serial_number.ilike.${cleanTarget},memo.ilike.${cleanTarget}`;
        if (isUuid) {
            condition += `,id.eq.${cleanTarget}`;
        }

        const query = supabase.from('cylinders').select('*')
            .or(condition)
            .limit(5);
            
        promises.push(query.then(({ data }: { data: any }) => matchedCylinders = TransactionValidator.sanitizeCylinders(data || [])));
    } else {
        promises.push(Promise.resolve());
    }

    // --- USERS ---
    let matchedUser: User | null = null;
    if (intent !== 'CUSTOMER' && intent !== 'CYLINDER') {
        const query = supabase.from('users').select('*')
            .or(`id.eq.${cleanTarget},username.eq.${cleanTarget}`)
            .maybeSingle();

        promises.push(query.then(({ data }: { data: any }) => matchedUser = data as User | null));
    } else {
        promises.push(Promise.resolve());
    }

    await Promise.all(promises);

    // --- Channel 3: Arbitration (Decision) ---
    
    // Priority 1: High Confidence (Intent Matches Data)
    if (intent === 'CUSTOMER' && matchedCustomers.length > 0) {
        const exact = matchedCustomers.find(c => c.id.toLowerCase() === cleanTarget.toLowerCase());
        return { type: 'CUSTOMER', data: exact || matchedCustomers[0] };
    }
    if (intent === 'CYLINDER' && matchedCylinders.length > 0) {
        // Safe access now that data is sanitized
        const exact = matchedCylinders.find(c => c.serialNumber?.toLowerCase() === cleanTarget.toLowerCase());
        return { type: 'CYLINDER', data: exact || matchedCylinders[0] };
    }
    if (intent === 'USER' && matchedUser) {
        return { type: 'USER', data: matchedUser };
    }

    // Priority 2: Ambiguous Intent -> Exact Match Wins
    const exactCustomerMatch = matchedCustomers.find(c => c.id.toLowerCase() === cleanTarget.toLowerCase());
    if (exactCustomerMatch) return { type: 'CUSTOMER', data: exactCustomerMatch };

    const exactCylinderMatch = matchedCylinders.find(c => 
        c.serialNumber?.toLowerCase() === cleanTarget.toLowerCase() || 
        (c.id && c.id.toLowerCase() === cleanTarget.toLowerCase())
    );
    if (exactCylinderMatch) return { type: 'CYLINDER', data: exactCylinderMatch };

    if (matchedUser) return { type: 'USER', data: matchedUser };

    // Priority 3: Ambiguous -> Fallback to Candidates (Customer Priority)
    if (matchedCustomers.length > 0) return { type: 'CUSTOMER', data: matchedCustomers[0] };
    if (matchedCylinders.length > 0) return { type: 'CYLINDER', data: matchedCylinders[0] };

    return null;
};
