import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';
import { Customer, CylinderStatus, Transaction } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    console.log('🚀 [SEED] STARTING SUPER CLEAN RESET (SD-5XXX Series)...');
    try {
        await db.init();

        // 1. MEMORY RESET
        // Clear arrays completely to avoid any lingering references
        // We only keep legitimate non-test customers if strictly needed, but let's be aggressive here.
        // Re-fetching strictly "System" users/items might be safer, but filtering is okay.
        
        console.log(`[SEED] Before: ${db.cylinders.length} cyls, ${db.customers.length} custs`);

        db.customers = db.customers.filter(c => !c.name.includes('테스트거래처') && !c.id.startsWith('TEST-CUST') && !c.id.startsWith('PARTNER_'));
        
        // Remove ALL SD-, CO2- cylinders from memory
        db.cylinders = db.cylinders.filter(c => {
             const isTest = c.serialNumber.startsWith('SD-') || c.serialNumber.startsWith('CO2-') || c.serialNumber.includes('TEST');
             return !isTest;
        });

        // Remove ALL Transactions associated with deleted cylinders
        const validCylIds = new Set(db.cylinders.map(c => c.id));
        db.transactions = db.transactions.filter(t => validCylIds.has(t.cylinderId));

        // [NEW] Wipe Financial History (Ledger Notes)
        db.dailyLedgerNotes = [];

        // 2. SUPABASE HARD DELETE - AGGRESSIVE CLEANUP
        console.log('[SEED] Executing AGGRESSIVE Cleanup...');
        try {
            // A. DELETE ALL TRANSACTIONS
            // This clears the "History" views completely.
            const { error: txError } = await db.supabase.from('transactions').delete().gte('created_at', '2000-01-01');
            if (txError) console.error('Tx Delete Error:', txError);
            console.log('[SEED] All Transactions Deleted.');

            // B. DELETE TEST CYLINDERS
            // 1. Fetch ALL Cylinder IDs (Optimization: chunks if needed, but for test data it's fine)
            const { data: allCyls } = await db.supabase.from('cylinders').select('id, serial_number, memo');
            
            if (allCyls && allCyls.length > 0) {
                 const idsToDelete = allCyls.filter((c: { id: string; serial_number: string; memo?: string }) => {
                     const id = c.id;
                     // Condition 1: Is UUID? (Length > 10 and has dashes)
                     const isUUID = id.length > 20 && id.includes('-');
                     // Condition 2: Is Test Serial?
                     const isTestSerial = id.startsWith('SD-') || id.startsWith('CO2-') || id.startsWith('TEST') || id.startsWith('PROD-') || id.startsWith('VERIFY-');
                     // Condition 3: Known Test Memos
                     const isTestMemo = ['정상 운용 용기', '검사 대상 지정', '분실 처리', '폐기됨', '장기 미회수', '타사 용기', '🚨 분실 처리', '❌ 폐기됨', '👻 장기 미회수', '❓ 타사 용기', '🔍 외부 검사중'].includes(c.memo || '');
                     
                     return isUUID || isTestSerial || isTestMemo;
                 }).map((c: { id: string }) => c.id);

                 if (idsToDelete.length > 0) {
                     // Delete in chunks of 500
                     const chunkSize = 500;
                     for (let i=0; i < idsToDelete.length; i += chunkSize) {
                         const chunk = idsToDelete.slice(i, i + chunkSize);
                         await db.supabase.from('cylinders').delete().in('id', chunk);
                     }
                     console.log(`[SEED] Deleted ${idsToDelete.length} Test Cylinders.`);
                 }
            }
            
            // [NEW] Explicitly Delete PROD/VERIFY patterns (UUID-based entries where ID check failed)
            await db.supabase.from('cylinders').delete().ilike('serial_number', 'PROD-%');
            await db.supabase.from('cylinders').delete().ilike('serial_number', 'VERIFY-%');
            await db.supabase.from('cylinders').delete().ilike('serial_number', 'TEST-%');
            
            
            // C. Text Customers
            await db.supabase.from('customers').delete().ilike('id', 'PARTNER_%');

        } catch (e) {
            console.error('[SEED] Supabase Delete Failed', e);
        }

        // 3. GENERATION
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode');

        if (mode === 'clean') {
             console.log('🚀 [SEED] CLEAN MODE: Skipping Generation.');
             // Save the empty state (after deletes)
             await db.save();
             return NextResponse.json({ success: true, message: 'Test data cleared successfully.' });
        }

        const gasTypes = [
            { n: '산소', c: '40L', col: '#228BE6' }, { n: '질소', c: '40L', col: '#868E96' },
            { n: '아르곤', c: '40L', col: '#40C057' }, { n: '탄산', c: '40L', col: '#228BE6' },
            { n: '수소', c: '40L', col: '#FD7E14' }, { n: '헬륨', c: '47L', col: '#BE4BDB' },
            { n: '아세틸렌', c: '40L', col: '#FA5252' }, { n: '혼합가스', c: '40L', col: '#868E96' }
        ];

        // Customers
        const partnerNames = ['(주)대한용접', '서울병원', '경기연구소', '인천조선소', '강원농장'];
        const createdCustomers: Customer[] = [];
        partnerNames.forEach((name, idx) => {
            const cust: Customer = {
                id: `PARTNER_${idx+1}`,
                name: name,
                type: 'BUSINESS',
                ledgerNumber: `10${idx}`,
                paymentType: 'tax_invoice',
                address: `테스트 지역구 ${idx+1}번길`,
                phone: `010-1000-000${idx}`,
                businessNumber: `123-45-6789${idx}`,
                isDeleted: false,
                balance: 0,
                tanks: {}
            };
            db.customers.push(cust);
            createdCustomers.push(cust);
        });

        // Helper
        const now = new Date();
        const daysFromNow = (days: number) => {
            const d = new Date(now);
            d.setDate(d.getDate() + days);
            return d.toISOString().split('T')[0];
        };

        const newCylinders = [];
        const newTransactions: Transaction[] = [];

        // Groups: 20 Standard, 20 Safety, 20 Abnormal
        
        // Group 1: Standard [SD-51xx]
        for(let i=1; i<=20; i++) {
             const gas = gasTypes[i % gasTypes.length];
             const cycle = i % 4; 
             let status: CylinderStatus = '공병';
             let holder = '삼덕공장';
             
             if (cycle === 0) { status = '공병'; holder = '삼덕공장'; }
             else if (cycle === 1) { status = '충전중'; holder = '삼덕공장'; }
             else if (cycle === 2) { status = '실병'; holder = '삼덕공장'; }
             else { status = '납품'; holder = createdCustomers[i % 5].id; }

             // const cylId = uuidv4(); // [FIX] Use Serial as ID for DB consistency
             const serial = `SD-51${i.toString().padStart(2, '0')}`;
             const cylId = serial; 

             newCylinders.push({
                id: cylId,
                serialNumber: serial,
                gasType: `${gas.n}-${gas.c}`,
                capacity: gas.c,
                gasColor: gas.col,
                owner: '삼덕공장',
                currentHolderId: holder,
                status: status,
                chargingExpiryDate: daysFromNow(300 + (i*10)),
                workPressure: '15MPa',
                manufactureDate: '2024-01-01',
                lastInspectionDate: '2024-01-01',
                createdDate: new Date().toISOString(),
                containerType: 'CYLINDER',
                memo: '정상 운용 용기'
             });

             // Logs Chain
             // 1. Initial
             newTransactions.push({
                 id: uuidv4(),
                 timestamp: daysFromNow(-30),
                 type: '기타출고',
                 cylinderId: cylId,
                 workerId: 'system',
                 memo: '초기 등록'
             });

             if (status === '공병') {
                     // Returned recently
                     newTransactions.push({
                         id: uuidv4(),
                         timestamp: daysFromNow(-1),
                         type: '회수', // Fixed: Removed duplicate key
                         cylinderId: cylId,
                         customerId: createdCustomers[i % 5].id, // Previous holder
                         workerId: '김기사',
                         memo: '공병 회수'
                     });
             } else if (status === '충전중') {
                 // Returned -> Start Charging
                 newTransactions.push({
                     id: uuidv4(),
                     timestamp: daysFromNow(-1),
                     type: '회수',
                     cylinderId: cylId,
                     customerId: createdCustomers[i % 5].id,
                     workerId: '김기사',
                     memo: '공병 회수'
                 });
                 newTransactions.push({
                     id: uuidv4(),
                     timestamp: daysFromNow(0),
                     type: '충전시작',
                     cylinderId: cylId,
                     workerId: '박충전',
                     memo: '충전 작업 시작'
                 });
             } else if (status === '실병') {
                 // Returned -> Start -> Complete
                 newTransactions.push({
                     id: uuidv4(),
                     timestamp: daysFromNow(-2),
                     type: '회수',
                     cylinderId: cylId,
                     customerId: createdCustomers[i % 5].id,
                     workerId: '김기사',
                     memo: '공병 회수'
                 });
                 newTransactions.push({
                     id: uuidv4(),
                     timestamp: daysFromNow(-1),
                     type: '충전시작',
                     cylinderId: cylId,
                     workerId: '박충전',
                     memo: '충전 시작'
                 });
                 newTransactions.push({
                     id: uuidv4(),
                     timestamp: daysFromNow(0),
                     type: '충전완료',
                     cylinderId: cylId,
                     workerId: '박충전',
                     memo: '충전 완료 (적합)'
                 });
             } else if (status === '납품') {
                 // Returned -> Start -> Complete -> Delivered
                 newTransactions.push({
                     id: uuidv4(),
                     timestamp: daysFromNow(-4),
                     type: '회수',
                     cylinderId: cylId, // customerId missing here? Added below.
                     customerId: createdCustomers[i % 5].id,
                     workerId: '김기사',
                     memo: '공병 회수'
                 });
                 newTransactions.push({
                     id: uuidv4(),
                     timestamp: daysFromNow(-3),
                     type: '충전시작',
                     cylinderId: cylId,
                     workerId: '박충전',
                     memo: '충전 시작'
                 });
                 newTransactions.push({
                     id: uuidv4(),
                     timestamp: daysFromNow(-2),
                     type: '충전완료',
                     cylinderId: cylId,
                     workerId: '박충전',
                     memo: '충전 완료'
                 });
                 newTransactions.push({
                      id: uuidv4(),
                      timestamp: daysFromNow(-1),
                      type: '납품',
                      cylinderId: cylId,
                      customerId: holder,
                      workerId: '김기사',
                      memo: '정기 납품'
                  });
             }
        }

        // Group 2: Safety [SD-52xx]
        for(let i=1; i<=20; i++) {
             const gas = gasTypes[i % gasTypes.length];
             let expiry = daysFromNow(0);
             let status: CylinderStatus = '검사대상';
             let holder = '삼덕공장';
             let memo = '';

             if (i <= 8) { 
                 expiry = daysFromNow(-150); status = '검사대상'; memo = '⚠️ 기한 만료';
             } else if (i <= 14) { 
                 expiry = daysFromNow(15); status = '실병'; memo = '⚠️ 만료 임박'; 
             } else { 
                 expiry = daysFromNow(-10); status = '검사중'; holder = 'INSPECTION_AGENCY'; memo = '🔍 외부 검사중';
             }

             // const cylId = uuidv4();
             const serial = `SD-52${i.toString().padStart(2, '0')}`;
             const cylId = serial;

             newCylinders.push({
                id: cylId,
                serialNumber: serial,
                gasType: `${gas.n}-${gas.c}`,
                capacity: gas.c,
                gasColor: gas.col,
                owner: '삼덕공장',
                currentHolderId: holder,
                status: status,
                chargingExpiryDate: expiry,
                workPressure: '15MPa',
                manufactureDate: '2019-01-01',
                lastInspectionDate: '2019-01-01',
                createdDate: new Date().toISOString(),
                containerType: 'CYLINDER',
                memo: memo
             });
             
            // Log for Safety
            newTransactions.push({
                 id: uuidv4(),
                 timestamp: daysFromNow(-2),
                 type: '기타출고',
                 cylinderId: cylId,
                 workerId: 'system',
                 memo: '검사 대상 지정'
             });
        }

        // Group 3: Abnormal [SD-53xx]
        for(let i=1; i<=20; i++) {
             const gas = gasTypes[i % gasTypes.length];
             let status: CylinderStatus = '분실';
             let holder = '삼덕공장';
             let memo = '';
             let specificOwner = '삼덕공장';

             if (i <= 5) { status = '분실'; memo = '🚨 분실 처리'; }
             else if (i <= 10) { status = '폐기'; memo = '❌ 폐기됨'; }
             else if (i <= 15) { status = '납품'; holder = createdCustomers[0].id; memo = '👻 장기 미회수'; }
             else { status = '실병'; specificOwner = 'UNKNOWN'; memo = '❓ 타사 용기'; }
             
             const serial = `SD-53${i.toString().padStart(2, '0')}`;
             const cylId = serial; // [FIX] Use Serial

             newCylinders.push({
                id: cylId,
                serialNumber: serial,
                gasType: `${gas.n}-${gas.c}`,
                capacity: gas.c,
                gasColor: i > 15 ? '#000000' : gas.col,
                owner: specificOwner,
                currentHolderId: holder,
                status: status,
                chargingExpiryDate: daysFromNow(100),
                workPressure: '15MPa',
                manufactureDate: '2018-01-01',
                lastInspectionDate: '2018-01-01',
                createdDate: new Date().toISOString(),
                containerType: 'CYLINDER',
                memo: memo
             });
        }

        console.log(`[SEED] Adding ${newCylinders.length} new cylinders...`);
        
        // Use Admin Client to bypass RLS
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        
        const client = supabaseServiceKey 
            ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
            : db.supabase;

        if (!supabaseServiceKey) console.warn('⚠️ [SEED] SERVICE_ROLE_KEY MISSING. Transactions might fail RLS.');

        // 1. Upsert Users (Fix FK)
        const dummyUsers = [
            { id: 'system', name: '시스템', role: 'admin', email: 'system@example.com' },
            { id: '김기사', name: '김기사', role: 'driver', email: 'driver@example.com' },
            { id: '박충전', name: '박충전', role: 'worker', email: 'worker@example.com' },
            { id: '이영미', name: '이영미', role: 'manager', email: 'manager@example.com' },
            { id: 'admin', name: '관리자', role: 'admin', email: 'admin@example.com' },
            { id: '관리자', name: '관리자', role: 'admin', email: 'admin2@example.com' } // Fallback
        ];
        const { error: userErr } = await client.from('users').upsert(dummyUsers);
        if (userErr) console.warn('User Upsert Warn (UUID?):', userErr.message);

        // 2. Upsert Customers (Fix FK)
        // Add '삼덕공장', 'INSPECTION_AGENCY'
        const allCustomers = [
            { id: '삼덕공장', name: '삼덕공장', type: 'INTERNAL', address: '본사', phone: '000-0000-0000', is_deleted: false },
            { id: 'INSPECTION_AGENCY', name: '검사소', type: 'PARTNER', address: '검사소', phone: '-', is_deleted: false },
            { id: 'SAMDUK', name: '삼덕공장', type: 'INTERNAL', address: '본사', phone: '-', is_deleted: false }, // Legacy alias
            ...createdCustomers.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                ledger_number: c.ledgerNumber,
                payment_type: c.paymentType,
                address: c.address,
                phone: c.phone,
                business_number: c.businessNumber,
                is_deleted: c.isDeleted,
                balance: c.balance
                // tanks: c.tanks // Jsonb column?
            }))
        ];
        const { error: custErr } = await client.from('customers').upsert(allCustomers);
        if (custErr) throw custErr;


        // 3. Cylinders
        const cylPayload = newCylinders.map(c => ({
            id: c.id,
            serial_number: c.serialNumber,
            gas_type: c.gasType,
            capacity: c.capacity,
            // gas_color: c.gasColor,
            ownership: 'SAMDUK', 
            owner_id: c.owner,
            location: c.currentHolderId,
            status: c.status,
            charging_expiry_date: c.chargingExpiryDate,
            // work_pressure: c.workPressure,
            manufacture_date: c.manufactureDate,
            last_inspection_date: c.lastInspectionDate,
            created_at: c.createdDate,
            container_type: c.containerType,
            memo: c.memo
        }));

        const { error: cylErr } = await client.from('cylinders').upsert(cylPayload);
        if (cylErr) throw cylErr;

        // 4. Transactions
        const txPayload = newTransactions.map(t => ({
            id: t.id,
            date: t.timestamp ? `${t.timestamp}T09:00:00+09:00` : new Date().toISOString(),
            type: t.type,
            cylinderId: t.cylinderId,
            customerId: t.customerId || '삼덕공장',
            workerId: t.workerId || 'SYSTEM'
            // [CRITICAL] Omitted 'memo' column as it causes insert failure
        }));

        const { error: txErr } = await client.from('transactions').upsert(txPayload);
        if (txErr) throw txErr;

        // Force DB Refresh
        await db.init();

        console.log('🚀 [SEED] COMPLETE. 60 Cylinders Generated.');
        return NextResponse.json({ success: true, count: newCylinders.length });
    } catch (e) {
        console.error('[SEED] Fatal Error', e);
        return NextResponse.json({ success: false, error: e }, { status: 500 });
    }
}
