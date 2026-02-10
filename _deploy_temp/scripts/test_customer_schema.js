const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://gedsuetwuxqrrboqobdj.supabase.co', 
    'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7' // ANON KEY
);

async function check() {
    console.log("Checking customer ID type...");
    
    // 1. Try to fetch the specific string ID
    const targetId = 'C1768578467547-s1up7';
    // Note: If ID is UUID type, this querry might fail or return error.
    const { data, error } = await supabase.from('customers').select('*').eq('id', targetId);
    
    if (error) {
        console.error("Error fetching string ID:", error);
    } else {
        console.log("Found data for string ID:", data);
    }

    // 2. Sample data
    const { data: one } = await supabase.from('customers').select('id, name').limit(1);
    if(one && one.length > 0) {
        console.log("Sample ID:", one[0].id, "Type:", typeof one[0].id);
    }
}

check();
