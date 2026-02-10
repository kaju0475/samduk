import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { deriveCylinderState } from '@/app/utils/cylinder';
import { resolveHolderName } from '@/app/utils/display';
import { Transaction } from '@/lib/types';
import { resolveSmartScan } from '@/lib/smart-scan';
import { isCompanyAlias } from '@/lib/company';


export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        // [FIX] Do NOT lowercase. Serials are case-sensitive usually (e.g. TEST-...)
        const targetId = searchParams.get('id')?.trim() || '';
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!targetId) {
            return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 });
        }

        // 0. Smart Scan (Async)
        const scanResult = await resolveSmartScan(targetId);

        const cylinder = scanResult?.type === 'CYLINDER' ? scanResult.data : null;
        
        if (!cylinder) {
            return NextResponse.json({ success: false, message: '용기를 찾을 수 없습니다.' }, { status: 404 });
        }

        // 1. Fetch Target Cylinder History (Transactions)
        // [Correction] The 'transactions' table stores 'cylinderId' as the SERIAL NUMBER (String), not the UUID.
        // Confirmed via app/api/work/delivery/route.ts (Line 268)
        const { data: rawHistory, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('cylinderId', cylinder.serialNumber) // Match Serial Number
            .order('created_at', { ascending: false });

        if (txError) {
            console.error('❌ [API/History] TX Fetch Error:', txError);
            throw txError;
        }

        const TransactionValidator = (await import('@/lib/transaction-validator')).TransactionValidator;
        let history = TransactionValidator.sanitizeTransactions(rawHistory || []);

        // 2. [RACK LOGIC] Merge Parent Rack History
        if (cylinder.parentRackId) {
             const { data: parentRack } = await supabase
                .from('cylinders')
                .select('*')
                .eq('id', cylinder.parentRackId)
                .maybeSingle();

            if (parentRack) {
                // Rack transactions also use Serial Number
                const { data: rackRaw } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('cylinderId', parentRack.serialNumber);
                
                const rackHistory = (rackRaw || []) as Transaction[];
                
                rackHistory.forEach(rackTx => {
                    const matchIndex = history.findIndex(t => 
                        t.timestamp === rackTx.timestamp && 
                        ((t.memo || '').includes('Included in RACK') || (t.memo || '').includes('랙'))
                    );

                    if (matchIndex !== -1) {
                        const enhancedTx = { 
                            ...rackTx, 
                            memo: `${rackTx.memo} (${parentRack.serialNumber})` 
                        };
                        history[matchIndex] = enhancedTx;
                    } else {
                        history.push(rackTx);
                    }
                });
            }
        }

        // 3. Sort Descending
        history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Date Filtering
        if (startDate || endDate) {
            history = history.filter(t => {
                const txDate = new Date(t.timestamp);
                const kstDate = new Date(txDate.getTime() + 9 * 60 * 60 * 1000);
                const dateStr = kstDate.toISOString().split('T')[0];

                if (startDate && dateStr < startDate) return false;
                if (endDate && dateStr > endDate) return false;
                return true;
            });
        }

        // 4. Resolve Names (Batch Fetch)
        // 4. Resolve Names (Batch Fetch)
        // Collect IDs
        const customerIds = new Set<string>();
        const userIds = new Set<string>();

        history.forEach(t => {
            if (t.customerId) customerIds.add(t.customerId.trim());
            if (t.workerId) userIds.add(t.workerId.trim());
        });

        // Add special IDs to map manually later
        // Fetch Customers
        const customerMap = new Map<string, string>();
        const companyName = '삼덕공장'; // Removed local DB dependency
        customerMap.set('삼덕공장', companyName);
        customerMap.set('SAMDUK', companyName);
        customerMap.set('INSPECTION_AGENCY', '검사소');
        customerMap.set('폐기', '폐기');
        customerMap.set('DISPOSAL', '폐기');

        // [FIX] Filter only valid UUIDs for DB query to prevent 500 Error
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        // [UPDATE] Customers table PK is TEXT (supports legacy/generated IDs), so we allow all.
        // But we still filter out '삼덕공장' etc which are manually mapped.
        const uniqueCustomerIds = Array.from(customerIds).filter(id => !customerMap.has(id));

        if (uniqueCustomerIds.length > 0) {
            // Safe to query 'id' with strings as column is Text (implied by Delivery API usage)
            const { data: customers } = await supabase
                .from('customers')
                .select('id, name')
                .in('id', uniqueCustomerIds);
            
            customers?.forEach((c: any) => customerMap.set(c.id, c.name));
        }

        // Fetch Users
        const userMap = new Map<string, string>();
        userMap.set('WORKER-DEFAULT', '관리자');
        userMap.set('DEFAULT', '관리자');
        userMap.set('admin', '관리자'); // Common legacy value

        const validUserIds = Array.from(userIds).filter(id => uuidRegex.test(id));

        if (validUserIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id, name')
                .in('id', validUserIds);
            
            users?.forEach((u: any) => userMap.set(u.id, u.name));
        }

        // [FIX] Fallback for Non-UUID IDs (e.g. Rack Serials as Location)
        // If the location is a Rack ID (Serial), we should resolve it to the Rack's Name/Serial.
        const nonUuidIds = Array.from(customerIds).filter(id => !uuidRegex.test(id) && !customerMap.has(id));
        
        if (nonUuidIds.length > 0) {
            // Try matching against Cylinders (Racks) by Serial Number or ID
            const { data: rackCandidates } = await supabase
                .from('cylinders')
                .select('id, serial_number, memo')
                .or(`serial_number.in.(${nonUuidIds.join(',')}),id.in.(${nonUuidIds.filter(id=>uuidRegex.test(id)).join(',')})`) // Handle UUIDs just in case mixed
                // Actually, just searching serial_number for text IDs is safer
                .in('serial_number', nonUuidIds);

            rackCandidates?.forEach((r: any) => {
                // If found, map the ID to the Serial Number (or Memo if better)
                // Use the Serial Number as the display name for the "Location"
                customerMap.set(r.serial_number, `${r.serial_number} (랙/용기)`);
            });
             
            // Also try legacy Usernames just in case
             const { data: userCandidates } = await supabase
                .from('users')
                .select('username, name')
                .in('username', nonUuidIds);
            
            userCandidates?.forEach((u: any) => {
                 userMap.set(u.username, u.name);
                 // Also set to customerMap if it appears in customerId column
                 customerMap.set(u.username, u.name);
            });
        }

        // 5. Map for Display
        const mappedHistory = history.map(t => {
            const dateObj = new Date(t.timestamp);
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            
            const isCharging = t.type.includes('충전');
            let customerName = '-';

            // sanitizeTransactions maps 'customer_id' -> 'customerId'
            if (t.customerId) {
                // [FIX] Trim lookup key
                const key = t.customerId.trim();
                customerName = customerMap.get(key) || t.customerId;
            } else if (isCharging) {
                customerName = '삼덕공장';
            }

            let workerName = '-';
            if (t.workerId) {
                const wKey = t.workerId.trim();
                workerName = userMap.get(wKey) || t.workerId;
            }

            if (workerName.startsWith('WORKER-')) {
                workerName = workerName.replace('WORKER-', '');
            }

            return {
                id: t.id,
                date: dateStr,
                type: t.type,
                customer: customerName,
                worker: workerName,
                // [FIX] Ensure display serial is consistent
                memo: t.memo || '-',
                cylinderId: cylinder.serialNumber || cylinder.id 
            };
        });

        // 6. Current Location Logic
        // deriveCylinderState now robustly handles matching, but returns trimmed ID.
        const { currentHolderId: derivedHolder } = deriveCylinderState(cylinder, history);
        
        // [FIX] Safe lookup for derivedHolder matches map keys
        let currentLocationName = customerMap.get(derivedHolder) || resolveHolderName(derivedHolder);
        
        // If map misses, and it LOOKS like a UUID, we might want to fetch it individually? 
        // Or just leave it as ID. Usually bulk fetch covers it since derivedHolder usually comes from last TX.
        
        if (isCompanyAlias(derivedHolder)) {
            currentLocationName = resolveHolderName(derivedHolder) + '(내부)';  
        }

        return NextResponse.json({ 
            success: true, 
            data: { 
                cylinder, 
                history: mappedHistory,
                currentLocationName 
            } 
        });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        console.error('API Error:', e);
        // [REQUESTED] Expose exact error message for debugging
        return NextResponse.json({ 
            success: false, 
            message: `Server Error: ${e.message}`,
            stack: e.stack // Optional: helper for precise debugging
        }, { status: 500 });
    }
}
