const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    'https://gedsuetwuxqrrboqobdj.supabase.co', 
    'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7'
);

async function checkCounts() {
    const counts = {};
    
    const { count: customers } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    counts.customers = customers;

    const { count: cylinders } = await supabase.from('cylinders').select('*', { count: 'exact', head: true });
    counts.cylinders = cylinders;

    const { count: transactions } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
    counts.transactions = transactions;

    fs.writeFileSync('count_output.json', JSON.stringify(counts, null, 2));
}

checkCounts();
