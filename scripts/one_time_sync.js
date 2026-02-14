const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// [설정] Supabase 연결 정보 (Service Role Key 사용 - RLS 우회)
// 사용자 로컬 환경에서만 실행되는 1회성 스크립트입니다.
const SUPABASE_URL = 'https://gedsuetwuxqrrboqobdj.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZHN1ZXR3dXhxcnJib3FvYmRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY0NTkwOCwiZXhwIjoyMDg0MjIxOTA4fQ.wRzsiBbVV5BMWm4PKNSL8rjnqEPlFMGTuenFwWt1meE';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const DB_PATH = path.join(__dirname, '..', 'db.json');

async function main() {
    console.log('🚀 [Sync] Starting migration from local db.json to Supabase...');

    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ db.json not found!');
        process.exit(1);
    }

    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

    // 1. Users Sync
    if (db.users && db.users.length > 0) {
        console.log(`👤 Syncing ${db.users.length} users...`);
        const { error } = await supabase.from('users').upsert(db.users, { onConflict: 'id' });
        if (error) console.error('❌ Users Sync Error:', error);
        else console.log('✅ Users Synced');
    }

    // 2. Customers Sync
    if (db.customers && db.customers.length > 0) {
        console.log(`🏢 Syncing ${db.customers.length} customers...`);
        // Map fields based on db.ts logic
        const customersPayload = db.customers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || c.phoneNumber || '',
            address: c.address || '',
            manager: c.representative || c.manager || '',
            tanks: c.tanks || {},
            balance: c.balance || 0,
            type: c.type || 'BUSINESS',
            payment_type: c.paymentType || 'card',
            is_deleted: c.isDeleted || false
        }));

        const { error } = await supabase.from('customers').upsert(customersPayload, { onConflict: 'id' });
        if (error) console.error('❌ Customers Sync Error:', error);
        else console.log('✅ Customers Synced');
    }

    // 3. Cylinders Sync
    if (db.cylinders && db.cylinders.length > 0) {
        console.log(`gas Syncing ${db.cylinders.length} cylinders...`);
        // Map fields based on db.ts logic
        const cylindersPayload = db.cylinders.map(c => ({
            id: c.id,
            serial_number: c.serialNumber,
            gas_type: c.gasType,
            status: c.status,
            location: c.currentHolderId || '삼덕공장',
            owner: c.owner || 'SAMDUK',
            charging_expiry_date: c.chargingExpiryDate || null,
            last_inspection_date: c.lastInspectionDate || null,
            capacity: c.capacity || '40L',
            container_type: c.containerType || 'CYLINDER',
            is_deleted: c.isDeleted || false
        }));

        // Batch upload (1000 items per batch to avoid timeouts)
        const batchSize = 1000;
        for (let i = 0; i < cylindersPayload.length; i += batchSize) {
            const batch = cylindersPayload.slice(i, i + batchSize);
            const { error } = await supabase.from('cylinders').upsert(batch, { onConflict: 'id' });
            if (error) console.error(`❌ Cylinders Batch ${i} Error:`, error);
            else console.log(`✅ Cylinders Batch ${i}-${Math.min(i + batchSize, cylindersPayload.length)} Synced`);
        }
    }

    // 4. Transactions Sync
    if (db.transactions && db.transactions.length > 0) {
        console.log(`📝 Syncing ${db.transactions.length} transactions...`);
        // Map fields based on db.ts logic
        const transactionsPayload = db.transactions.map(t => ({
            id: t.id,
            date: t.timestamp || new Date().toISOString(), // db.ts maps timestamp to date
            type: t.type,
            cylinderId: t.cylinderId,
            customerId: t.customerId || '삼덕공장',
            workerId: t.workerId || 'SYSTEM'
        }));

        // Batch upload
        const batchSize = 1000;
        for (let i = 0; i < transactionsPayload.length; i += batchSize) {
            const batch = transactionsPayload.slice(i, i + batchSize);
            const { error } = await supabase.from('transactions').upsert(batch, { onConflict: 'id' });
            if (error) console.error(`❌ Transactions Batch ${i} Error:`, error);
            else console.log(`✅ Transactions Batch ${i}-${Math.min(i + batchSize, transactionsPayload.length)} Synced`);
        }
    }

    console.log('🎉 Migration Complete! Please refresh the Vercel app.');
}

main().catch(console.error);
