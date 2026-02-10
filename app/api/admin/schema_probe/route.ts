
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch 1 row to see actual column names
        const { data: cylData, error: cylError } = await supabase.from('cylinders').select('*').limit(1);
        const { data: txData, error: txError } = await supabase.from('transactions').select('*').limit(1);

        const cylColumns = cylData && cylData.length > 0 ? Object.keys(cylData[0]) : 'No data in cylinders';
        const txColumns = txData && txData.length > 0 ? Object.keys(txData[0]) : 'No data in transactions';

        return NextResponse.json({ 
            success: true, 
            cylinders: cylColumns,
            transactions: txColumns,
            errors: { cyl: cylError, tx: txError }
        });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message });
    }
}
