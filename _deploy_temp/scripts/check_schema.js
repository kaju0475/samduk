
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env.local
try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const envVars = {};
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/"/g, '');
            envVars[key] = val;
        }
    });

    const url = envVars['NEXT_PUBLIC_SUPABASE_URL'];
    const key = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

    if (!url || !key) {
        console.error('❌ Missing Supabase Logic in .env.local');
        process.exit(1);
    }

    // 2. Init Client
    const supabase = createClient(url, key);

    async function probe() {
        // Cylinders
        const { data: cyl, error: cylErr } = await supabase.from('cylinders').select('*').limit(1);
        const cylCols = Object.keys(cyl?.[0] || {});

        // Transactions
        const { data: tx, error: txErr } = await supabase.from('transactions').select('*').limit(1);
        const txCols = Object.keys(tx?.[0] || {});

        // Customers
        const { data: cus, error: cusErr } = await supabase.from('customers').select('*').limit(1);
        const cusCols = Object.keys(cus?.[0] || {});

        // Users
        const { data: usr, error: usrErr } = await supabase.from('users').select('*').limit(1);
        const usrCols = Object.keys(usr?.[0] || {});

        // Gas Items
        const { data: gas, error: gasErr } = await supabase.from('gas_items').select('*').limit(1);
        const gasCols = Object.keys(gas?.[0] || {});

        const result = {
            cylinders: cylCols,
            transactions: txCols,
            customers: cusCols,
            users: usrCols,
            gas_items: gasCols,
            errors: { cyl: cylErr, tx: txErr, cus: cusErr, usr: usrErr, gas: gasErr }
        };

        fs.writeFileSync('schema.json', JSON.stringify(result, null, 2));
    }

    probe();

} catch (e) {
    console.error('Script Error:', e);
}
