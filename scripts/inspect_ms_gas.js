const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://gedsuetwuxqrrboqobdj.supabase.co', 
    'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7'
);

async function inspectCustomer() {
    const name = '(주)MS 인천가스';
    console.log(`Inspecting customer: ${name}`);

    // Fuzzy search by name
    const { data, error } = await supabase.from('customers')
        .select('*')
        .ilike('name', `%MS%`) // Broad search
        .limit(5);

    if (error) console.error(error);
    else console.log('Found Customers:', data);

    // Also checking the mystery ID again just in case
    const target = 'C1768578467547-s1up7';
    console.log(`Checking Mystery ID: ${target}`);
}

inspectCustomer();
