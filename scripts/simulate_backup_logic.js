
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://gedsuetwuxqrrboqobdj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runSimulation() {
    console.log('🚀 [Simulation] Starting Backup Logic Stress Test...\n');
    
    const startTotal = Date.now();

    // 1. Performance Test: Fetch All Tables Parallel
    console.log('📊 1. Performance Test (Parallel Fetch)');
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

        console.log(`   ✅ Fetch Complete in ${fetchTime}s`);
        console.log(`   📦 Data Volume:`);
        console.log(`      - Cylinders: ${cylinders.length.toLocaleString()} records`);
        console.log(`      - Transactions: ${transactions.length.toLocaleString()} records`);
        console.log(`      - Customers: ${customers.length.toLocaleString()} records`);
        
        if (fetchTime > 10) {
            console.warn('   ⚠️ WARNING: Fetch time > 10s. Near Vercel limit (if default).');
        } else {
            console.log('   ✅ Performance: EXCELLENT (Well under 60s limit)');
        }

        // 2. Data Integrity Test
        console.log('\n🔍 2. Data Integrity Test (Field Check)');
        
        // Cylinder Check
        if (cylinders.length > 0) {
            const sample = cylinders[0];
            const requiredFields = ['id', 'serial_number', 'status', 'owner'];
            const missing = requiredFields.filter(f => sample[f] === undefined);
            
            if (missing.length === 0) {
                console.log('   ✅ Cylinder Schema: Valid (Sample Serial: ' + sample.serial_number + ')');
            } else {
                console.error('   ❌ Cylinder Schema Malformed! Missing:', missing);
            }
        } else {
            console.log('   ⚠️ No cylinders to test schema.');
        }

        // Transaction Check
        if (transactions.length > 0) {
            const sample = transactions[0];
            const requiredFields = ['id', 'type', 'timestamp', 'cylinderId']; // Note: implementation uses 'timestamp' or 'date'? DB usually 'timestamp'
            // Let's check keys directly
            console.log('   ℹ️  Transaction Keys:', Object.keys(sample).slice(0, 5).join(', '));
        }

    } catch (e) {
        console.error('   ❌ Critical Simulation Error:', e);
    }

    const totalTime = (Date.now() - startTotal) / 1000;
    console.log(`\n🏁 [Simulation] Finished in ${totalTime}s`);
}

runSimulation();
