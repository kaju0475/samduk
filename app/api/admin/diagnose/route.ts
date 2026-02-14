import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
        const { count: cylCount } = await supabase.from('cylinders').select('*', { count: 'exact', head: true });

        // Fetch top 5 txs
        const { data: txs } = await supabase.from('transactions').select('*').limit(5).order('created_at', { ascending: false });
        
        return NextResponse.json({
            txCount,
            cylCount,
            recentTxs: txs
        });
    } catch (e) {
        return NextResponse.json({ error: e });
    }
}
