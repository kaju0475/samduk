import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType, Cylinder, Transaction } from '@/lib/types';
import { getGasColor } from '@/app/utils/gas';
import { TransactionValidator } from '@/lib/transaction-validator';
import { deriveCylinderState } from '@/app/utils/cylinder';
import { parseSmartScan } from '@/lib/smart-scan-logic';
import { db } from '@/lib/db';
import { Mutex } from 'async-mutex';

export const dynamic = 'force-dynamic';

// [Concurrency Control] Global Mutex to prevent race conditions
const postMutex = new Mutex();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const cylinderId = searchParams.get('cylinderId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const serial = searchParams.get('serial');
        const gasType = searchParams.get('gasType');
        const customer = searchParams.get('customer');
        const worker = searchParams.get('worker');
        
        // --- 1. Single Cylinder History Mode ---
        if (cylinderId) {
            const scanResult = parseSmartScan(cylinderId.trim());
            const targetId = (scanResult?.intent === 'CYLINDER' ? scanResult.cleanTarget : cylinderId.trim());

            // 1. Fetch History from Supabase
            const { data: historyData } = await supabase.from('transactions')
                .select('*')
                .ilike('cylinderId', targetId) // Match Case-Insensitive CylinderId
                .order('created_at', { ascending: false });
 
            // 2. Fetch Cylinder Info
            const { data: cylinderData } = await supabase.from('cylinders')
                .select('*')
                .ilike('id', targetId) // PK lookup
                .maybeSingle();
            
            // If not found by ID, try serial_number if columns differ, but usually ID=Serial 
            const cylinder = cylinderData ? TransactionValidator.sanitizeCylinders([cylinderData])[0] : null;

            // 3. Hydrate Additional Info (Gas, Worker)
            const gasItemsRes = await supabase.from('gas_items').select('*');
            const usersRes = await supabase.from('users').select('*');
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const gasMap = new Map((gasItemsRes.data || []).map((g: any) => [g.id, g]));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const history = (historyData || []).map((t: any) => {
                const tx = TransactionValidator.sanitizeTransactions([t])[0];
                const dateStr = new Date(tx.timestamp).toLocaleString('ko-KR');
                
                const gasItem = cylinder ? gasMap.get(cylinder.gasType) : null;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const gasTypeName = gasItem ? (gasItem as any).name : (cylinder ? cylinder.gasType : '-');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const gasColor = gasItem ? (gasItem as any).color : getGasColor(cylinder?.gasType);

                const containerType = cylinder ? cylinder.containerType : 'CYLINDER';
                const user = userMap.get(tx.workerId);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const workerName = user ? (user as any).name : (tx.workerId === 'admin' ? '관리자' : tx.workerId);

                // [FIX] Force display Serial Number instead of ID
                const displayCylId = cylinder ? cylinder.serialNumber : tx.cylinderId;

                return { ...tx, cylinderId: displayCylId, date: dateStr, gasType: gasTypeName, gasColor, workerId: workerName, containerType };
            });

            return NextResponse.json({ success: true, data: { history, cylinder } });
        }

        // --- 2. Filtered Search Mode (Stats & List) ---
        // If query params exist, we build a dynamic query
        if (startDate || endDate || serial || gasType || customer || worker) {
            
            let query = supabase.from('transactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100); // Limit usage

            // Apply Filters
            // Apply Filters (KST Awareness: Midnight KST is 15:00 UTC previous day)
            // Postgres with Timestamptz handles ISO+Offset correctly.
            if (startDate) query = query.gte('created_at', `${startDate}T00:00:00+09:00`);
            if (endDate) query = query.lte('created_at', `${endDate}T23:59:59+09:00`);
            
            if (serial) query = query.ilike('cylinderId', `%${serial}%`);
            
            // Worker Filter
            if (worker) {
                query = query.ilike('workerId', `%${worker}%`);
            }
            
            if (customer) {
                query = query.ilike('customerId', `%${customer}%`); 
            }

            const { data: txData } = await query;
            const transactions = TransactionValidator.sanitizeTransactions(txData || []);

            // [OPTIMIZATION] Batch fetch cylinder info to get Serial Numbers
            const cylIds = Array.from(new Set(transactions.map(t => t.cylinderId)));
            
            // [FIX] Separate UUIDs and Serial Numbers to prevent Type Error
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const validUuids = cylIds.filter(id => uuidRegex.test(id));
            // Unused 'serials' removed

            // 1. Fetch by valid UUID
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let cyls1: Record<string, any>[] = [];
            if (validUuids.length > 0) {
                 const { data } = await supabase.from('cylinders').select('id, memo, serial_number, gas_type, container_type').in('id', validUuids);
                 cyls1 = data || [];
            }
            
            // 2. Fetch by Serial Number (using strict serial search for strings)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let cyls2: Record<string, any>[] = [];
            if (cylIds.length > 0) {
                 const { data } = await supabase.from('cylinders').select('id, memo, serial_number, gas_type, container_type').in('serial_number', cylIds);
                 cyls2 = data || [];
            }

            const allCyls = [...cyls1, ...cyls2];
            const cylMap = new Map();
            allCyls.forEach(c => {
                 cylMap.set(c.id, c);
                 if (c.serial_number) cylMap.set(c.serial_number, c);
                 // Fallback for weird cases where transaction stores memo
                 if (c.memo) cylMap.set(c.memo, c);
            });

            const history = transactions.map(t => {
                 const c = cylMap.get(t.cylinderId);
                 const dateStr = new Date(t.timestamp).toLocaleString('ko-KR');
                 
                 // [STANDARD] Prefer serial_number -> memo -> original ID
                 const displaySerial = c ? (c.serial_number || c.memo || c.id) : t.cylinderId;

                 return {
                     ...t,
                     cylinderId: displaySerial, // Override with human-readable Serial
                     date: dateStr,
                     gasType: c?.gas_type || '-',
                     gasColor: getGasColor(c?.gas_type),
                     containerType: c?.container_type || 'CYLINDER'
                 };
            });

            return NextResponse.json({ success: true, data: { history } });   
        }

        // --- 3. Dashboard Stats Mode (Default) ---
        // "How many cylinders are in Standby / Charging / Full?"
        // This requires counting ALL cylinders based on status.
        // Supabase `count` is cheap.
        
        // However, we need accurate status (derived?).
        // If we strictly rely on `cylinders` table 'status' column, it might be stale if logic was only in `deriveCylinderState`.
        // BUT, since we are moving to "Write to Supabase", we ensure the `status` column IS updated on every action.
        // So we can trust the `status` column for general stats.

        const [standbyRes, chargingRes, fullRes, totalRes] = await Promise.all([
            // Standby: Status '공병' AND Location matches Factory
            supabase.from('cylinders').select('*', { count: 'exact', head: true })
                .eq('status', '공병').or('location.eq.삼덕공장,location.eq.SAMDUK'),
            
            // Charging: Status '충전중'
            supabase.from('cylinders').select('*', { count: 'exact', head: true })
                .eq('status', '충전중'),

            // Full: Status '실병' AND Location '삼덕공장'
            supabase.from('cylinders').select('*', { count: 'exact', head: true })
                .eq('status', '실병').or('location.eq.삼덕공장,location.eq.SAMDUK'),
            
            supabase.from('cylinders').select('*', { count: 'exact', head: true })
        ]);

        const stats = {
            standby: standbyRes.count || 0,
            charging: chargingRes.count || 0,
            full: fullRes.count || 0,
            total: totalRes.count || 0
        };
        
        return NextResponse.json({ 
            success: true, 
            data: stats 
        });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ success: false, message: 'Server Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
  // [Concurrency Control] Serialize all POST requests to prevent race conditions
  return await postMutex.runExclusive(async () => {
    try {
      const body = await request.json();
    const { action, qrCode, workerId } = body;

    if (!workerId || workerId === 'WORKER-DEFAULT') {
        return NextResponse.json({ success: false, message: '작업자 정보가 없습니다. 다시 로그인해주세요.' }, { status: 400 });
    }

    const { parseSmartScan } = await import('@/lib/smart-scan-logic');
    const parse = parseSmartScan(qrCode);
    const targetQr = parse && parse.intent === 'CYLINDER' ? parse.cleanTarget : (qrCode ? qrCode.trim() : '');

    // 1. Fetch Cylinder
    const { data: cylData } = await supabase.from('cylinders')
        .select('*')
        .or(`id.ilike.${targetQr},memo.eq.${targetQr}`) // PK match or exact Memo (Serial)
        .maybeSingle();
    
    // ... existing retry logic simplified ...
    
    let cylinder: Cylinder | null = null;
    if (cylData) {
        cylinder = TransactionValidator.sanitizeCylinders([cylData])[0];
    }

    if (!cylinder) {
        return NextResponse.json({ success: false, message: `용기를 찾을 수 없습니다. (${targetQr})` }, { status: 404 });
    }

    // 2. Fetch Recent Transactions for State Derivation
    const { data: recentTxs } = await supabase.from('transactions')
        .select('*')
        .ilike('cylinderId', cylinder.serialNumber)
        .order('created_at', { ascending: false })
        .limit(10);
    
    const cylinderTxHistory = TransactionValidator.sanitizeTransactions(recentTxs || []);

    // 3. Derived State Logic
    const { status: derivedStatus, currentHolderId: derivedHolder } = deriveCylinderState(cylinder, cylinderTxHistory);
    
    if (derivedStatus) cylinder.status = derivedStatus;
    if (derivedHolder) cylinder.currentHolderId = derivedHolder;

    let message = '';

    // --- Action Logic ---
    if (action === 'START') {
        const valResult = TransactionValidator.validateChargingStart(cylinder);

        if (!valResult.success) {
            // [LOST RECOVERY]
            if (valResult.code === 'CYLINDER_LOST') {
                 // Recovery logic via transaction
                 const txTimestamp = new Date().toISOString();
                 const recoverTx: Transaction = {
                    id: uuidv4(),
                    timestamp: txTimestamp,
                    type: '회수' as TransactionType,
                    cylinderId: cylinder.serialNumber,
                    customerId: '삼덕공장',
                    workerId: workerId,
                    memo: '분실 용기 회수 및 입고 (현장 발견)'
                 };

                 try {
                     await db.transaction(data => {
                         data.transactions = [recoverTx, ...data.transactions];
                         data.cylinders = data.cylinders.map(c => 
                             c.id === cylinder!.id ? { ...c, status: '공병', currentHolderId: '삼덕공장' } : c
                         );
                     });
                 } catch (err) {
                     console.error('Recover Fail:', err);
                     return NextResponse.json({ success: false, message: '회수 처리 중 오류가 발생했습니다.' }, { status: 500 });
                 }

                 return NextResponse.json({ success: true, message: '분실 용기 회수 및 입고 완료 (충전 대기 상태)', data: { ...cylinder, status: '공병', currentHolderId: '삼덕공장' } });
            }

             return NextResponse.json({ 
                 success: false, 
                 message: valResult.error,
                 code: valResult.code
             }, { status: 400 });
        }
        
        if (valResult.warning) message = `[주의] 충전 시작 (${valResult.warning})`;
        else message = '충전시작';

        cylinder.status = '충전중';
        cylinder.currentHolderId = '삼덕공장';
    }
    else if (action === 'COMPLETE') {
         const valResult = TransactionValidator.validateChargingComplete(cylinder);

         if (!valResult.success) {
             return NextResponse.json({ success: false, message: valResult.error, code: valResult.code }, { status: 400 });
         }

         if (valResult.warning) message = `[주의] 충전 완료 (${valResult.warning})`;
         else message = '충전완료';

         cylinder.status = '실병';
         cylinder.currentHolderId = '삼덕공장';
    }
    else {
        return NextResponse.json({ success: false, message: '유효하지 않은 작업(Action) 입니다.' }, { status: 400 });
    }

    // 5. Finalize Action
    if (action) {
        const txTimestamp = new Date().toISOString();
        const txId = uuidv4();

        const txObj: Transaction = {
            id: txId,
            timestamp: txTimestamp,
            type: (action === 'START' ? '충전시작' : '충전완료') as TransactionType,
            cylinderId: cylinder.serialNumber, 
            customerId: '삼덕공장',
            workerId: workerId,
            memo: message
        };

        try {
            await db.transaction(data => {
                // 1. Update Transactions
                data.transactions = [txObj, ...data.transactions];
                
                // 2. Update Cylinder
                data.cylinders = data.cylinders.map(c => 
                    c.id === cylinder!.id 
                    ? { ...c, status: cylinder!.status, currentHolderId: '삼덕공장' } 
                    : c
                );
            });
            
// console.log(`✅ [Charging] Mutex-protected update success: ${cylinder.serialNumber}`);
        } catch (err: unknown) {
            console.error('❌ [Charging] Atomic Update Failed:', err);
            return NextResponse.json({ success: false, message: '데이터 업데이트 중 충돌이 발생했습니다.' }, { status: 500 });
        }

        // Audit Log (Fire and Forget)
        import('@/lib/audit-logger').then(({ AuditLogger }) => {
            AuditLogger.log(
                'TRANSACTION_CHARGING', 
                { cylinder: cylinder?.serialNumber, memo: '충전 완료' }, 
                workerId
            ).catch(e => console.error('Audit Log Error:', e));
        });
    }

    return NextResponse.json({ success: true, message: `충전 완료: ${cylinder.serialNumber}`, data: cylinder });

  } catch (error: unknown) {
    console.error('❌ [API/Charging] Critical Error:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ success: false, message: `서버 내부 오류: ${errorMessage}` }, { status: 500 });
  }
  }); // End of postMutex.runExclusive
}
