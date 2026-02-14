
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET() {
    const results = [];
    
    // Probe 1: Try Inserting with 'serial_number' (Snake Case)
    // This is what our code CURRENTLY uses.
    const id1 = uuidv4();
    const probe1 = { id: id1, serial_number: 'PROBE-SNAKE', memo: 'PROBE' };
    const { error: err1 } = await supabase.from('cylinders').insert(probe1);
    results.push({ key: 'serial_number', success: !err1, error: err1?.message });
    if (!err1) await supabase.from('cylinders').delete().eq('id', id1);

    // Probe 2: Try Inserting with 'serialNumber' (Camel Case)
    // This is the likely alternative.
    const id2 = uuidv4();
    const probe2 = { id: id2, serialNumber: 'PROBE-CAMEL', memo: 'PROBE' };
    const { error: err2 } = await supabase.from('cylinders').insert(probe2);
    results.push({ key: 'serialNumber', success: !err2, error: err2?.message });
    if (!err2) await supabase.from('cylinders').delete().eq('id', id2);

    return NextResponse.json({ results });
}
