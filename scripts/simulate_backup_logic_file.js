
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Configuration
const SUPABASE_URL = 'https://gedsuetwuxqrrboqobdj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(message) {
    console.log(message);
    fs.appendFileSync('simulation_result.txt', message + '\n');
}

async function runSimulation() {
    // Clear previous log
    fs.writeFileSync('simulation_result.txt', '');
    
    log('🚀 [Simulation] Starting Backup Logic Stress Test...\n');
    
    const startTotal = Date.now();

    // 1. Performance Test: Fetch All Tables Parallel
    log('📊 1. Performance Test (Parallel Fetch)');
    try {
        const startFetch = Date.now();
        const [
            { data: cylinders, error: errCyl },
            { data: transactions, error: errTx },
            { data: customers, error: errCus },
            { data: users, error: errUser }
        ] = await Promise.all([
            supabase.from('cylinders').select('*', { count: 'exact' }),
            supabase.from('transactions').select('*', { count: 'exact' }),
            supabase.from('customers').select('*', { count: 'exact' }),
            supabase.from('users').select('*', { count: 'exact' })
        ]);
        const fetchTime = (Date.now() - startFetch) / 1000;

        if (errCyl || errTx || errCus || errUser) {
            throw new Error(`Fetch Error: ${errCyl?.message || errTx?.message}`);
        }

        log(`   ✅ Fetch Complete in ${fetchTime}s`);
        log(`   📦 Data Volume:`);
        log(`      - Cylinders: ${cylinders ? cylinders.length.toLocaleString() : 0} records`);
        log(`      - Transactions: ${transactions ? transactions.length.toLocaleString() : 0} records`);
        log(`      - Customers: ${customers ? customers.length.toLocaleString() : 0} records`);
        
        if (fetchTime > 10) {
            log('   ⚠️ WARNING: Fetch time > 10s. Near Vercel limit (if default).');
        } else {
            log('   ✅ Performance: EXCELLENT (Well under 60s limit)');
        }

        // 2. Data Integrity Test
        log('\n🔍 2. Data Integrity Test (Field Check)');
        
        // Cylinder Check
        if (cylinders && cylinders.length > 0) {
            const sample = cylinders[0];
            const requiredFields = ['id', 'serial_number', 'status', 'owner'];
            const missing = requiredFields.filter(f => sample[f] === undefined);
            
            if (missing.length === 0) {
                log('   ✅ Cylinder Schema: Valid (Sample Serial: ' + sample.serial_number + ')');
            } else {
                log('   ❌ Cylinder Schema Malformed! Missing: ' + JSON.stringify(missing));
            }
        } else {
            log('   ⚠️ No cylinders to test schema.');
        }

        // Transaction Check
        if (transactions && transactions.length > 0) {
            const sample = transactions[0];
            log('   ℹ️  Transaction Keys: ' + Object.keys(sample).slice(0, 5).join(', '));
        }

    } catch (e) {
        log('   ❌ Critical Simulation Error: ' + e.message);
    }

    const totalTime = (Date.now() - startTotal) / 1000;
    log(`\n🏁 [Simulation] Finished in ${totalTime}s`);
}

runSimulation();
