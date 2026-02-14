
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local manually
try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) process.env[key.trim()] = val.trim();
    });
} catch (e) {
    console.warn('Could not load .env.local', e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Env Vars: URL or KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('--- Probing Customers Table ---');
    
    // 1. Check existing columns by fetching one row raw
    const { data, error } = await supabase.from('customers').select('*').limit(1);
    if (error) {
        console.error('Fetch Error:', error);
        return;
    }
    
    if (data && data.length > 0) {
        console.log('Existing Columns:', Object.keys(data[0]));
        const c = data[0];
        console.log('Values:', {
            payment_type: c.payment_type,
            type: c.type,
            corporate_id: c.corporate_id,
            fax: c.fax
        });
    } else {
        console.log('No customers found to probe.');
    }

    // 2. Try Update to check if column exists (on a fake ID to avoid side effects, or handle error)
    // Actually, updating a non-existent ID with a column that doesn't exist *might* still throw 'Column does not exist',
    // or it might just return count 0.
    // Let's try INSERT validation which is stricter? 
    // No, UPDATE is safer.
    
    // Let's try to update the FIRST customer found with its OWN values (safe op)
    if (data && data.length > 0) {
        const target = data[0];
        console.log(`Attempting Dummy Update on ${target.id}...`);
        
        const updates = { 
            payment_type: 'card',
            type: 'BUSINESS',
            // corporate_id: 'TEST', // these might fail
            // fax: '000' 
        };
        
        const { error: updateError } = await supabase.from('customers').update(updates).eq('id', target.id);
        if (updateError) {
            console.error('Update Failed (Column likely missing):', updateError.message);
        } else {
            console.log('Update Success! Columns payment_type and type exist.');
        }

        // Test Extended Columns
        console.log('Testing Extended Columns (corporate_id, fax)...');
        const extUpdates = { corporate_id: 'TEST', fax: 'TEST' };
        const { error: extError } = await supabase.from('customers').update(extUpdates).eq('id', target.id);
        if (extError) {
            console.error('Extended Update Failed:', extError.message);
        } else {
            console.log('Extended Update Success!');
        }
    }
}

probe();
