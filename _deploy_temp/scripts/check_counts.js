const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://gedsuetwuxqrrboqobdj.supabase.co', 
    'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7'
);

async function checkCounts() {
    const { count: customers } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    const { count: cylinders } = await supabase.from('cylinders').select('*', { count: 'exact', head: true });
    const { count: transactions } = await supabase.from('transactions').select('*', { count: 'exact', head: true });

    console.log('Counts:');
    console.log('Customers:', customers);
    console.log('Cylinders:', cylinders);
    console.log('Transactions:', transactions);
}

checkCounts();
