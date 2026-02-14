
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Or service role if needed
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('🔍 Diagnosing Transactions Table...');

    // 1. Try to fetch one row to see structure
    const { data: sample, error } = await supabase
        .from('transactions')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error fetching sample:', error);
        return;
    }

    if (!sample || sample.length === 0) {
        console.log('⚠️ No transactions found.');
    } else {
        console.log('✅ Sample Transaction:', sample[0]);
        console.log('Type of cylinderId:', typeof sample[0].cylinderId);
    }

    // 2. Specific test: Query by String
    console.log('\n🧪 Testing Query by String (TEST-2026-1069)...');
    const { data: byString, error: stringError } = await supabase
        .from('transactions')
        .select('*')
        .eq('cylinderId', 'TEST-2026-1069')
        .limit(1);
    
    if (stringError) {
        console.error('❌ Query by String FAILED:', stringError.message);
        console.error('   Hint: This suggests column is UUID type.');
    } else {
        console.log('✅ Query by String SUCCESS. Found:', byString?.length);
    }

    // 3. Specific test: Query by UUID (if possible, let's try a fake one)
    console.log('\n🧪 Testing Query by UUID...');
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const { error: uuidError } = await supabase
        .from('transactions')
        .select('*')
        .eq('cylinderId', fakeUuid)
        .limit(1);

    if (uuidError) {
        console.log('ℹ️ Query by UUID rejected (Expected if column is Text):', uuidError.message);
    } else {
        console.log('✅ Query by UUID accepted (Column might be UUID).');
    }
}

diagnose();
