
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gedsuetwuxqrrboqobdj.supabase.co', 
    'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7'
);

async function checkCounts() {
    console.log('--- START CHECK ---');
    const tables = ['cylinders', 'transactions', 'customers', 'users', 'gas_items', 'daily_ledger_notes'];
    
    for (const table of tables) {
        try {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (error) {
                console.error(`Error counting ${table}: ${error.message}`);
            } else {
                console.log(`${table}: ${count}`);
            }
        } catch (e) {
            console.error(`Exception for ${table}:`, e);
        }
    }
    console.log('--- END CHECK ---');
}

checkCounts().catch(console.error);
