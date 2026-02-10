import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, message: 'Missing Service Key' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action } = await request.json();

    if (action === 'cleanup') {
        // Cleaning
        await supabaseAdmin.from('transactions').delete().ilike('cylinderId', 'E2E-TEST%');
        await supabaseAdmin.from('cylinders').delete().ilike('serial_number', 'E2E-TEST%');
        await supabaseAdmin.from('customers').delete().ilike('id', 'E2E-TEST%');
        return NextResponse.json({ success: true, message: 'Cleanup Done' });
    }

    if (action === 'seed') {
        const today = new Date().toISOString().split('T')[0];
        
        // 1. Create Test Customer
        await supabaseAdmin.from('customers').upsert({
            id: 'E2E-TEST-CUS-01',
            name: 'E2E테스트거래처',
            type: 'BUSINESS',
            address: '테스트시 테스트구',
            phone: '010-0000-0000',
            created_at: new Date().toISOString()
        });

        // 2. Create Test Cylinder (Standby)
        await supabaseAdmin.from('cylinders').upsert({
            id: 'E2E-TEST-CYL-01',
            serial_number: 'E2E-TEST-CYL-01',
            gas_type: 'O2',
            container_type: 'CYLINDER',
            status: '공병',
            location: '삼덕공장',
            ownership: 'SAMDUK',
            capacity: '40L',
            charging_expiry_date: '2030-12-31', // Future date (Safe)
            manufacture_date: '2020-01-01',
            created_at: new Date().toISOString()
        });
        
         // 3. Create Test Cylinder (Expired) - For Safety Check Test
        await supabaseAdmin.from('cylinders').upsert({
            id: 'E2E-TEST-CYL-OLD',
            serial_number: 'E2E-TEST-CYL-OLD',
            gas_type: 'O2',
            container_type: 'CYLINDER',
            status: '공병',
            location: '삼덕공장',
            ownership: 'SAMDUK',
            capacity: '40L',
            charging_expiry_date: '2000-01-01', // Past date (Expired)
            manufacture_date: '1990-01-01',
            created_at: new Date().toISOString()
        });

        return NextResponse.json({ success: true, message: 'Seed Done' });
    }

    return NextResponse.json({ success: false, message: 'Invalid Action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
