
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function probe() {
    console.log('Probing settings table...');
    const { data, error } = await supabase.from('settings').select('*').limit(1);
    
    if (error) {
        console.log('Error/Missing:', error.message);
    } else {
        console.log('Table Exists. Data:', data);
    }
}

probe();
