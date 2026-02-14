
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// 1. Configuration (Secrets)
const SUPABASE_URL = 'https://gedsuetwuxqrrboqobdj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Logger setup
function log(msg) {
    console.log(msg);
    fs.appendFileSync('advanced_simulation_result.txt', msg + '\n');
}

async function runAdvancedSimulation() {
    fs.writeFileSync('advanced_simulation_result.txt', '');
    log('🤖 [AI Simulation] Starting Comprehensive Variable Stress Test...');
    
    // Variable 1: Memory Baseline
    const memStart = process.memoryUsage().heapUsed;
    log(`   🧠 Memory Baseline: ${(memStart / 1024 / 1024).toFixed(2)} MB`);

    try {
        const start = Date.now();

        // Variable 2: Network Latency & Throughput (Fetch)
        log('   📡 Fetching Raw Data (30k+ records)...');
        const [
            { data: users },
            { data: customers },
            { data: cylinders },
            { data: transactions },
            { data: gasItems },
            { data: dailyLedgerNotes },
            { data: systemConfigData }
        ] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('customers').select('*'),
            supabase.from('cylinders').select('*'),
            supabase.from('transactions').select('*'),
            supabase.from('gas_items').select('*'),
            supabase.from('daily_ledger_notes').select('*'),
            supabase.from('system_config').select('*').single()
        ]);

        const fetchTime = Date.now() - start;
        log(`   ⏱️  Fetch Time: ${(fetchTime/1000).toFixed(2)}s`);

        // Variable 3: Processing Overhead (Mapping Logic)
        log('   ⚙️  Executing Data Mapping (snake_case -> camelCase)...');
        const mapStart = Date.now();

        // EXACT Logic from route.ts
        const mappedCylinders = (cylinders || []).map(c => ({
            id: c.id,
            serialNumber: c.serial_number || c.serialNumber || '',
            gasType: c.gas_type || c.gasType || 'Oxygen',
            status: c.status || 'Unknown',
            currentHolderId: c.location || '삼덕공장',
            owner: c.owner || 'SAMDUK',
            chargingExpiryDate: c.charging_expiry_date || null,
            lastInspectionDate: c.last_inspection_date || null,
            capacity: c.capacity || '40L',
            containerType: c.container_type || 'General',
            isDeleted: c.is_deleted || false,
            workId: c.work_id || null
        }));

        const mappedTransactions = (transactions || []).map(t => ({
            id: t.id,
            timestamp: t.date || t.timestamp || new Date().toISOString(),
            type: t.type,
            cylinderId: t.cylinderId,
            customerId: t.customerId || '삼덕공장',
            workerId: t.workerId || 'SYSTEM',
            isManual: t.is_manual || false
        }));
        
        const mappedCustomers = (customers || []).map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            address: c.address || '',
            representative: c.manager || '',
            tanks: c.tanks || [],
            balance: c.balance || 0,
            type: c.type || 'General',
            paymentType: c.payment_type || 'Monthly',
            isDeleted: c.is_deleted || false
        }));

        const mapTime = Date.now() - mapStart;
        log(`   ⏱️  Mapping Time: ${mapTime}ms`);

        // Variable 4: Data Integrity (Post-Mapping)
        log('   🔍 Verifying Mapped Data integrity...');
        const badCylinders = mappedCylinders.filter(c => !c.serialNumber || !c.owner);
        if (badCylinders.length > 0) {
            log(`   ❌ Integrity Check Failed: ${badCylinders.length} cylinders missing critical keys.`);
        } else {
            log('   ✅ Integrity Check Passed: All cylinders have serialNumber and owner.');
        }

        // Variable 5: Final Payload Size (The Critical Limit)
        log('   📦 Constructing Final JSON...');
        const backupData = {
            metadata: { timestamp: new Date().toISOString(), version: '2.1' },
            data: {
                users: users || [],
                customers: mappedCustomers,
                cylinders: mappedCylinders,
                transactions: mappedTransactions,
                gasItems: gasItems || [],
                dailyLedgerNotes: dailyLedgerNotes || [],
                systemConfig: systemConfigData?.data || {},
                companySettings: { companyName: '삼덕가스공업(주)' }
            }
        };

        const jsonString = JSON.stringify(backupData);
        const jsonSize = Buffer.byteLength(jsonString);
        const jsonSizeMB = (jsonSize / 1024 / 1024).toFixed(2);
        
        log(`   ⚖️  Final JSON Size: ${jsonSizeMB} MB`);
        
        if (jsonSizeMB > 4.5) {
            log('   ⚠️ CRITICAL WARNING: payload > 4.5MB. Vercel Serverless limit might be exceeded!');
        } else {
            log('   ✅ Payload Size: Safe (< 4.5MB)');
        }

        // Variable 6: Peak Memory
        const memEnd = process.memoryUsage().heapUsed;
        log(`   🧠 Memory Peak: ${(memEnd / 1024 / 1024).toFixed(2)} MB (+${((memEnd - memStart) / 1024 / 1024).toFixed(2)} MB)`);

    } catch (e) {
        log(`   ❌ Simulation Failed: ${e.message}`);
    }
}

runAdvancedSimulation();
