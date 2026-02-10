/* eslint-disable @typescript-eslint/no-explicit-any */
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Client-Side Seeder to bypass Server RLS issues.
 * Uses the logged-in user's session to write data.
 */
export async function runClientSeed(supabase: SupabaseClient) {
    const gasTypes = [
        { n: '산소', c: '40L', col: '#228BE6' }, { n: '질소', c: '40L', col: '#868E96' },
        { n: '아르곤', c: '40L', col: '#40C057' }, { n: '탄산', c: '40L', col: '#228BE6' },
        { n: '수소', c: '40L', col: '#FD7E14' }, { n: '헬륨', c: '47L', col: '#BE4BDB' },
        { n: '아세틸렌', c: '40L', col: '#FA5252' }, { n: '혼합가스', c: '40L', col: '#868E96' }
    ];

    const now = new Date();
    const daysFromNow = (days: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + days);
        d.setHours(12, 0, 0, 0); // Noon to avoid date-boundary issues
        return d.toISOString();
    };

    // 1. Users
    const dummyUsers = [
        { id: 'system', name: '시스템', role: 'admin', email: 'system@example.com' },
        { id: '김기사', name: '김기사', role: 'driver', email: 'driver@example.com' },
        { id: '박충전', name: '박충전', role: 'worker', email: 'worker@example.com' },
        { id: '이영미', name: '이영미', role: 'manager', email: 'manager@example.com' },
        { id: 'admin', name: '관리자', role: 'admin', email: 'admin@example.com' },
        { id: '관리자', name: '관리자', role: 'admin', email: 'admin2@example.com' }
    ];
    await supabase.from('users').upsert(dummyUsers);

    // 2. Customers
    const partnerNames = ['(주)대한용접', '서울병원', '경기연구소', '인천조선소', '강원농장'];
    const createdCustomers: any[] = [];
    partnerNames.forEach((name, idx) => {
        createdCustomers.push({
            id: `PARTNER_${idx+1}`,
            name: name,
            type: 'BUSINESS',
            ledgerNumber: `10${idx}`,
            paymentType: 'tax_invoice',
            address: `테스트 지역구 ${idx+1}번길`,
            phone: `010-1000-000${idx}`,
            businessNumber: `123-45-6789${idx}`,
            isDeleted: false,
            balance: 0
        });
    });

    // Add Internal/Partners
    const allCustomers = [
        { id: '삼덕공장', name: '삼덕가스공업(주)', type: 'INTERNAL', address: '본사', phone: '000-0000-0000', is_deleted: false },
        { id: 'INSPECTION_AGENCY', name: '검사소', type: 'PARTNER', address: '검사소', phone: '-', is_deleted: false },
        { id: 'SAMDUK', name: '삼덕가스공업(주)', type: 'INTERNAL', address: '본사', phone: '-', is_deleted: false },
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
        }))
    ];
    await supabase.from('customers').upsert(allCustomers);

    // 3. Cylinders & Transactions
    const newCylinders: any[] = [];
    const newTransactions: any[] = [];

    // Group 1: Standard
    for(let i=1; i<=20; i++) {
        const gas = gasTypes[i % gasTypes.length];
        const cycle = i % 4; 
        let status = '공병';
        let holder = '삼덕공장';
        
        if (cycle === 0) { status = '공병'; holder = '삼덕공장'; }
        else if (cycle === 1) { status = '충전중'; holder = '삼덕공장'; }
        else if (cycle === 2) { status = '실병'; holder = '삼덕공장'; }
        else { status = '납품'; holder = createdCustomers[i % 5].id; }

        const serial = `SD-51${i.toString().padStart(2, '0')}`;
        const cylId = serial; 

        newCylinders.push({
            id: cylId,
            serial_number: serial,
            gas_type: `${gas.n}-${gas.c}`,
            capacity: gas.c,
            // gas_color: gas.col,
            ownership: '삼덕용기', 
            owner_id: '삼덕공장',
            location: holder,
            status: status,
            charging_expiry_date: daysFromNow(300 + (i*10)),
            // work_pressure: '15MPa',
            manufacture_date: '2024-01-01',
            last_inspection_date: '2024-01-01',
            created_at: new Date().toISOString(),
            container_type: 'CYLINDER',
            memo: '정상 운용 용기'
        });

        // Logs
        newTransactions.push({
            id: uuidv4(),
            timestamp: daysFromNow(-30),
            type: '기타출고',
            cylinderId: cylId,
            workerId: 'system',
            memo: '초기 등록'
        });

        if (status === '공병') { // Cycle 0
            newTransactions.push({
                id: uuidv4(),
                timestamp: daysFromNow(-1),
                type: '회수',
                cylinderId: cylId,
                customerId: createdCustomers[i % 5].id,
                workerId: '김기사',
                memo: '공병 회수'
            });
        } else if (status === '충전중') { // Cycle 1
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
        } else if (status === '실병') { // Cycle 2 (Full)
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
        } else if (status === '납품') { // Cycle 3
            newTransactions.push({
                id: uuidv4(),
                timestamp: daysFromNow(-4),
                type: '회수',
                cylinderId: cylId,
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

    // Group 2, 3 (Simplified for brevity, or include if needed)
    // Adding Group 2 (Safety)
    for(let i=1; i<=20; i++) {
        const gas = gasTypes[i % gasTypes.length];
        const serial = `SD-52${i.toString().padStart(2, '0')}`;
        newCylinders.push({
            id: serial, serial_number: serial, gas_type: `${gas.n}-${gas.c}`, capacity: gas.c, 
            // gas_color: gas.col,
            ownership: 'SAMDUK', owner_id: '삼덕공장', location: '삼덕공장', status: '검사대상',
            charging_expiry_date: daysFromNow(-1), 
            // work_pressure: '15MPa', 
            manufacture_date: '2020-01-01', last_inspection_date: '2020-01-01',
            created_at: new Date().toISOString(), container_type: 'CYLINDER', memo: '검사 대상'
        });
    }

    // Upsert Cylinders
    await supabase.from('cylinders').upsert(newCylinders.map(c => ({
        id: c.id, serial_number: c.serial_number, gas_type: c.gas_type, capacity: c.capacity,
        gas_color: c.gas_color, ownership: c.ownership, owner_id: c.owner_id, location: c.location,
        status: c.status, charging_expiry_date: c.charging_expiry_date, 
        // work_pressure: c.work_pressure,
        manufacture_date: c.manufacture_date, last_inspection_date: c.last_inspection_date,
        created_at: c.created_at || c.created_date || new Date().toISOString(), container_type: c.container_type, memo: c.memo
    })));

    // Upsert Transactions
    await supabase.from('transactions').upsert(newTransactions.map(t => ({
        id: t.id,
        created_at: t.timestamp,
        date: t.timestamp,
        type: t.type,
        cylinder_id: t.cylinderId,
        customer_id: t.customerId,
        worker_id: t.workerId,
        memo: t.memo
    })));

    return newCylinders.length;
}





export async function runClientWipe(supabase: SupabaseClient) {
    console.log('[WIPE] Starting NUCLEAR Wipe (Types + Data)...');
    let deletedCount = 0;

    try {
        // --- 1. TRANSACTIONS (Delete FIRST - Depended upon by everything) ---
        const { count: txCount, error: txErr } = await supabase.from('transactions').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000');
        if (txErr) console.error('Tx Wipe Error', txErr);
        deletedCount += (txCount || 0);

        // --- 2. CYLINDERS (Delete SECOND - Depends on Gas/Customer, Depended by Transaction) ---
        const { count: cylCount, error: cylErr } = await supabase.from('cylinders').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000');
        if (cylErr) console.error('Cyl Wipe Error', cylErr);
        deletedCount += (cylCount || 0);

        // --- 3. GAS ITEMS (Delete THIRD - Released by Cylinders) ---
        // Delete (B) suffix AND weird capacities like 10.2L/RACK (Test data)
        const { count: gasCount1 } = await supabase.from('gas_items').delete({ count: 'exact' }).ilike('name', '%(B)');
        const { count: gasCount2 } = await supabase.from('gas_items').delete({ count: 'exact' }).or('capacity.eq.10.2L,capacity.eq.RACK');
        deletedCount += (gasCount1 || 0) + (gasCount2 || 0);

        // [DEDUPLICATION] Remove duplicate Gas Items (Keep 1st, delete others)
        const { data: allGas } = await supabase.from('gas_items').select('id, name, capacity');
        if (allGas && allGas.length > 0) {
            const seen = new Set<string>();
            const duplicateIds: string[] = [];
            
            for (const g of allGas) {
                const key = `${g.name}|${g.capacity}`; // e.g. '산소|40L'
                if (seen.has(key)) {
                    duplicateIds.push(g.id);
                } else {
                    seen.add(key);
                }
            }
            
            if (duplicateIds.length > 0) {
                const chunkSize = 100;
                for (let i = 0; i < duplicateIds.length; i += chunkSize) {
                    await supabase.from('gas_items').delete().in('id', duplicateIds.slice(i, i + chunkSize));
                }
                deletedCount += duplicateIds.length;
                console.log(`[WIPE] Deduplicated ${duplicateIds.length} Gas Items`);
            }
        }

        // --- 4. CUSTOMERS (Selective) ---
        const { count: custCount } = await supabase.from('customers').delete({ count: 'exact' })
            .or('id.ilike.PARTNER_%,name.ilike.%ProbeTest%,name.eq.TestCustomer,name.eq.(주)대한용접');
        deletedCount += (custCount || 0);

        // --- 5. USERS ---
        const testUsers = ['김기사', '박충전', '이영미', '관리자', 'system'];
        await supabase.from('users').delete().in('id', testUsers);

        return deletedCount;
    } catch (e) {
        console.error('[WIPE_FATAL]', e);
        throw e;
    }
}
