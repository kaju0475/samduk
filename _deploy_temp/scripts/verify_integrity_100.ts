
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Load Env
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Helper: Batch Insert with Delay
async function batchInsert(table: string, items: any[], batchSize = 20) {
    let successCount = 0;
    for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const { error } = await supabase.from(table).insert(chunk);
        
        if (error) {
            console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1} Failed: ${error.message}`);
            // We continue trying other batches even if one fails, to see if it's transient, but usually precise fail is better.
            // For simulation, we want to know EXACTLY what failed.
            throw error; 
        } else {
            successCount += chunk.length;
            process.stdout.write(` [Batch ${Math.floor(i/batchSize) + 1} OK] `); 
            // Small delay to prevent terminal/network freeze
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    console.log(`\n   ✅ Done. (${successCount}/${items.length})`);
    return successCount;
}

// REPLICATING TransactionValidator.toCustomerDB Logic for Verification
function toCustomerDB(c: any) {
    const payload: any = {};
    if (c.id) payload.id = c.id;
    if (c.name) payload.name = c.name;
    if (c.phone) payload.phone = c.phone;
    if (c.address) payload.address = c.address;
    if (c.representative) payload.manager = c.representative; // Mapping check
    if (c.businessNumber) payload.business_number = c.businessNumber; // Snake check
    if (c.ledgerNumber) payload.ledger_number = c.ledgerNumber; // Snake check
    if (c.type) payload.type = c.type;
    if (c.paymentType) payload.payment_type = c.paymentType; // Snake check
    if (c.created_at) payload.created_at = c.created_at;
    return payload;
}

// REPLICATING TransactionValidator.toCylinderDB Logic
function toCylinderDB(c: any) {
    const payload: any = {};
    if (c.id) payload.id = c.id;
    if (c.serialNumber) payload.serial_number = c.serialNumber; // Snake check
    if (c.gasType) payload.gas_type = c.gasType;
    if (c.status) payload.status = c.status;
    if (c.currentHolderId) payload.location = c.currentHolderId; // Legacy Location check
    
    // [FIX] Strict Ownership + Default
    // Ensure ownership is NEVER NULL.
    payload.ownership = c.owner || 'SAMDUK';
    payload.owner_id = (c.owner === '자사' || c.owner === 'SAMDUK') ? 'SAMDUK' : (c.ownerId || 'EXTERNAL');

    if (c.capacity) { payload.capacity = c.capacity; payload.volume = c.capacity; }
    if (c.chargingExpiryDate) {
        payload.charging_expiry_date = c.chargingExpiryDate;
        payload.chargingExpiryDate = c.chargingExpiryDate;
    }
    // Fixed: Always ensure container_type is set if schema requires it
    payload.container_type = 'CYLINDER';
    
    return payload;
}

// REPLICATING TransactionValidator.toTransactionDB Logic
function toTransactionDB(t: any) {
    const now = t.timestamp || new Date().toISOString();
    return {
        id: t.id || uuidv4(),
        type: t.type,
        cylinderId: t.cylinderId, // Camel check (Master)
        workerId: t.workerId,
        customerId: t.customerId,
        created_at: now,
        date: now
    };
}

async function runSimulation() {
    console.log('🚀 Starting 100-Cycle Heavy Load Simulation (Batched Mode v2)...');
    
    const ITERATIONS = 100;
    const stats = {
        scanSuccess: 0,
        scanFail: 0,
        customerSuccess: 0,
        customerFail: 0,
        txSuccess: 0,
        txFail: 0
    };

    const testIds: string[] = [];
    const testCyls: string[] = [];

    try {
        // 0. Pre-Cleanup (Just in case)
        console.log('[Phase 0] Pre-Cleanup...');
        await supabase.from('customers').delete().like('id', 'SIM-CUS-%');
        await supabase.from('cylinders').delete().like('serial_number', 'SIM-CYL-%');
        console.log('✅ Pre-Cleanup Done.');

        // 1. Customer Simulation
        console.log(`\n[Phase 1] Creating ${ITERATIONS} Customers (Batch)...`);
        const cusPayloads = [];
        for (let i = 0; i < ITERATIONS; i++) {
            const id = `SIM-CUS-${Date.now()}-${i}`;
            const raw = {
                id,
                name: `SimCustomer ${i}`,
                phone: '010-0000-0000',
                address: 'Simulation World',
                representative: 'Sim Manager',
                businessNumber: `123-45-${10000+i}`,
                ledgerNumber: `L-${10000+i}`,
                type: 'BUSINESS',
                paymentType: 'card', 
                created_at: new Date().toISOString()
            };
            cusPayloads.push(toCustomerDB(raw));
            testIds.push(id);
        }
        
        await batchInsert('customers', cusPayloads);
        stats.customerSuccess = ITERATIONS;
        

        // 2. Cylinder Simulation
        console.log(`\n[Phase 2] Creating ${ITERATIONS} Cylinders (Batch)...`);
        const cylPayloads = [];
        for (let i = 0; i < ITERATIONS; i++) {
            const serial = `SIM-CYL-${i}`; 
            const raw = {
                id: uuidv4(),
                serialNumber: serial,
                gasType: 'O2',
                status: '공병',
                currentHolderId: '삼덕공장',
                owner: '삼덕공장', // Required by DB
                capacity: '40L',
                chargingExpiryDate: '2030-12-31'
            };
            cylPayloads.push(toCylinderDB(raw));
            testCyls.push(serial);
        }

        await batchInsert('cylinders', cylPayloads);
        stats.scanSuccess = ITERATIONS;
        

        // 3. Transaction Simulation (Delivery)
        console.log(`\n[Phase 3] Creating ${ITERATIONS} Transactions (Batch)...`);
        const txPayloads = [];
        for (let i = 0; i < ITERATIONS; i++) {
             const tx = {
                type: '납품',
                cylinderId: testCyls[i], 
                workerId: 'WORKER-SIM',
                customerId: testIds[i],
                timestamp: new Date().toISOString()
            };
            txPayloads.push(toTransactionDB(tx));
        }
        
        await batchInsert('transactions', txPayloads);
        stats.txSuccess = ITERATIONS;
        

        // 4. Verification Check (Sample Coverage)
        console.log('\n[Phase 4] Verifying Data Integrity...');
        
        // Check 5 Random Customers
        const sampleCusIds = testIds.slice(0, 5);
        const { data: sampleCus } = await supabase.from('customers').select('*').in('id', sampleCusIds);
        console.log(`✅ Verified ${sampleCus?.length}/5 Sample Customers.`);

        // Check 5 Random Transactions
        const sampleCyls = testCyls.slice(0, 5);
        const { data: sampleTx } = await supabase.from('transactions').select('*').in('cylinderId', sampleCyls);
        console.log(`✅ Verified ${sampleTx?.length}/5 Sample Transactions.`);
        
        // 5. Cleanup
        console.log('\n[Phase 5] Cleanup...');
        await supabase.from('transactions').delete().eq('workerId', 'WORKER-SIM');
        
        // Batch delete simulation data
        for (let i = 0; i < testIds.length; i += 20) {
            const batch = testIds.slice(i, i + 20);
            await supabase.from('customers').delete().in('id', batch);
        }

        for (let i = 0; i < testCyls.length; i += 20) {
            const batch = testCyls.slice(i, i + 20);
            await supabase.from('cylinders').delete().in('serial_number', batch);
        }
        
        console.log('✅ Cleanup Complete.');

    } catch (e: any) {
        console.error('\n❌ Simulation Failed:', e.message);
        process.exit(1);
    }
}

runSimulation()
    .then(() => {
        console.log('✅ Simulation Script Finished Successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Simulation Verification Failed:', err);
        process.exit(1);
    });
