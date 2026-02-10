const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://gedsuetwuxqrrboqobdj.supabase.co', 
    'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7'
);

async function search() {
    const target = 'C1768578467547-s1up7';
    console.log(`Searching for: ${target}`);

    // 1. Check Transactions (Where we know it exists)
    const { data: txs } = await supabase.from('transactions').select('*').eq('customerId', target).limit(1);
    if (txs && txs.length > 0) {
        console.log('✅ Found in transactions.customerId!');
        console.log('Sample TX:', txs[0]);
    } else {
        console.log('❌ Not found in transactions.customerId');
    }

    // 2. Check Customers (ID)
    const { data: custId } = await supabase.from('customers').select('*').eq('id', target);
    if (custId && custId.length > 0) {
        console.log('✅ Found in customers.id!');
        console.log('Customer:', custId[0]);
    } else {
        console.log('❌ Not found in customers.id');
    }

    // 3. Check Customers (Other Columns)
    // Maybe it's in business_number? or memo?
    const { data: custOther } = await supabase.from('customers').select('*').or(`business_number.eq.${target},ledger_number.eq.${target}`);
    if (custOther && custOther.length > 0) {
        console.log('✅ Found in customers (business/ledger)!');
        console.log('Customer:', custOther[0]);
    }

    // 4. Check Cylinders (Serial/Memo)
    const { data: cyl } = await supabase.from('cylinders').select('*').or(`serial_number.eq.${target},memo.eq.${target},id.eq.${target}`);
    if (cyl && cyl.length > 0) {
        console.log('✅ Found in cylinders!');
        console.log('Cylinder:', cyl[0]);
    } else {
        console.log('❌ Not found in cylinders');
    }
}

search();
