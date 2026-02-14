
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testSettings() {
    console.log('🧪 Starting Settings Table Simulation...');

    const testData = {
        companyName: 'Simulated Company (Test)',
        aliases: ['TEST', 'SIM']
    };

    // 1. Try UPDATE (Upsert)
    console.log('[Step 1] Attempting to Save Settings...');
    const { data, error } = await supabase
        .from('settings')
        .upsert({ 
            key: 'company', 
            value: testData,
            updated_at: new Date().toISOString()
        })
        .select();

    if (error) {
        console.error('❌ Save Failed:', error.message);
        if (error.message.includes('relation "public.settings" does not exist')) {
            console.error('   -> CAUSE: The "settings" table has not been created in the database.');
            console.error('   -> ACTION: You MUST run the SQL migration.');
        } else if (error.message.includes('policy')) {
            console.error('   -> CAUSE: RLS Policy blocked the write. Check "Allow Admin Write" policy.');
        }
        process.exit(1);
    } else {
        console.log('✅ Save Successful:', data);
    }

    // 2. Try READ
    console.log('[Step 2] Attempting to Read Settings...');
    const { data: readData, error: readError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'company')
        .single();

    if (readError) {
        console.error('❌ Read Failed:', readError.message);
    } else {
        console.log('✅ Read Successful:', readData);
    }
}

testSettings();
