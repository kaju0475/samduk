
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import fs from 'fs';
import path from 'path';

// Re-creating client to avoid import alias issues in standalone script
// Using the same keys from lib/supabase.ts
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gedsuetwuxqrrboqobdj.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generateData() {
    console.log('🚀 Starting Test Data Generation...');
    
    const generatedCylinders: any[] = [];
    const generatedTransactions: any[] = [];

    const GAS_TYPES = ['O2-40L', 'N2-40L', 'Ar-40L', 'CO2-40L', 'Mix-40L'];
    const CUSTOMER_ID = 'CUS-TEST-001';
    const WORKER_ID = 'WORKER-TEST-AG';

    let serialCounter = 1000;

    const generate = (count: number, config: any) => {
        for (let i = 0; i < count; i++) {
            serialCounter++;
            const serial = `TEST-2026-${serialCounter}`;
            const gasType = GAS_TYPES[Math.floor(Math.random() * GAS_TYPES.length)];
            
            // Expiry Logic
            let expiryDate = dayjs().add(1, 'year').format('YYYY-MM-DD'); // Default Safe (Green)
            if (config.expiry === 'warning') {
                expiryDate = dayjs().add(15, 'day').format('YYYY-MM-DD'); // Orange
            } else if (config.expiry === 'expired') {
                expiryDate = dayjs().subtract(5, 'day').format('YYYY-MM-DD'); // Red (Blocked)
            }

            // Cylinder Object (DB Schema - snake_case)
            const cylinder = {
                id: serial,
                serial_number: serial,
                gas_type: gasType,
                status: config.status,
                location: config.location,
                ownership: 'SAMDUK', // Default
                charging_expiry_date: expiryDate,
                last_inspection_date: dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
                memo: '테스트용 데이터 (삭제예정)',
                container_type: 'CYLINDER',
                created_at: new Date().toISOString()
            };

            generatedCylinders.push(cylinder);

            // Initial Transaction
            const txId = uuidv4();
            let txType = '기타입고';
            if (config.status === '충전중') txType = '충전시작';
            if (config.status === '실병') txType = '충전완료';
            if (config.status === '납품') txType = '납품';
            if (config.status === '폐기') txType = '폐기';

            const tx = {
                id: txId,
                cylinder_id: serial, // DB Schema snake_case
                cylinderId: serial,  // API/Legacy compatibility
                type: txType,
                worker_id: WORKER_ID,
                workerId: WORKER_ID,
                customer_id: config.location === '삼덕공장' ? '삼덕공장' : config.location,
                customerId: config.location === '삼덕공장' ? '삼덕공장' : config.location,
                created_at: new Date().toISOString(),
                date: new Date().toISOString(),
                memo: '테스트 데이터 생성'
            };
            generatedTransactions.push(tx);
        }
    };

    // 1. Normal Empty (Safe) - 40
    generate(40, { status: '공병', location: '삼덕공장', expiry: 'safe' });

    // 2. Normal Empty (Warning) - 10
    generate(10, { status: '공병', location: '삼덕공장', expiry: 'warning' });

    // 3. Normal Empty (Expired) - 10
    generate(10, { status: '공병', location: '삼덕공장', expiry: 'expired' });

    // 4. Full (Factory, Safe) - 10
    generate(10, { status: '실병', location: '삼덕공장', expiry: 'safe' });

    // 5. Delivered (Customer, Safe) - 10
    generate(10, { status: '납품', location: CUSTOMER_ID, expiry: 'safe' });

    // 6. Delivered (Customer, Expired/Lost) - 10
    generate(10, { status: '납품', location: CUSTOMER_ID, expiry: 'expired' });

    // 7. Scrapped - 5
    generate(5, { status: '폐기', location: '폐기', expiry: 'safe' });

    // 8. Defective - 5
    generate(5, { status: '불량', location: '삼덕공장', expiry: 'safe' });

    console.log(`Prepared ${generatedCylinders.length} cylinders.`);

    // --- BATCH INSERT ---
    // Custromer
    const { error: cusError } = await supabase.from('customers').upsert({
        id: CUSTOMER_ID,
        name: '(테스트) 미수업체',
        phone: '010-0000-0000',
        address: '테스트 데이터 지역',
        managers: { name: "테스터" }, 
        created_at: new Date().toISOString()
    });
    if (cusError) console.error('Customer Error:', cusError);
    else console.log('✅ Customer Upserted');

    // Cylinders
    const { error: cylError } = await supabase.from('cylinders').upsert(generatedCylinders);
    if (cylError) {
        console.error('❌ Cylinder Insert Failed:', cylError);
    } else {
        console.log('✅ Cylinders Inserted');
    }

    // Transactions
    const { error: txError } = await supabase.from('transactions').insert(generatedTransactions);
    if (txError) {
        console.error('❌ Transaction Insert Failed:', txError);
    } else {
        console.log('✅ Transactions Inserted');
    }
    
    // Cleanup DB.JSON
    try {
        const dbPath = path.join(process.cwd(), 'db.json');
        if (fs.existsSync(dbPath)) {
            const backupPath = path.join(process.cwd(), 'db.json.bak');
            fs.copyFileSync(dbPath, backupPath);
            fs.unlinkSync(dbPath);
            console.log('🗑️  Deleted db.json to force Cloud Sync on next load (Backup created at db.json.bak)');
        }
    } catch (e) {
        console.error('File Op Error:', e);
    }

    console.log('Done.');
}

generateData();
