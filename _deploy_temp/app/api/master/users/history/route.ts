
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Transaction, User } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const workerId = searchParams.get('workerId');

        if (!workerId) {
             return NextResponse.json({ success: false, message: 'Worker ID is required' }, { status: 400 });
        }

        // 1. Resolve Work Target Information
        // We need to find the user to get their username AND id, as transactions might be logged under either.
        
        const searchIds = new Set<string>();
        searchIds.add(workerId); // Always search for the ID passed

        const { data: userRaw } = await supabase
            .from('users')
            .select('*')
            .or(`id.eq.${workerId},username.eq.${workerId}`)
            .maybeSingle();
        
        if (userRaw) {
            const targetUser = userRaw as User;
            searchIds.add(targetUser.id);
            searchIds.add(targetUser.username);
            
            // Only show default worker actions to the main 'admin' account
            if (targetUser.username === 'admin') {
                searchIds.add('WORKER-DEFAULT');
                searchIds.add('DEFAULT');
            }
        } else {
             // Fallback for special IDs if user not found (e.g. 'admin' legacy)
             if (workerId === 'admin' || workerId === '관리자') {
                 searchIds.add('WORKER-DEFAULT');
                 searchIds.add('DEFAULT');
                 searchIds.add('admin');
             }
        }

        // 2. Fetch Transactions for these worker IDs
        const { data: history, error } = await supabase
            .from('transactions')
            .select('*')
            .in('worker_id', Array.from(searchIds))
            .order('created_at', { ascending: false })
            .limit(500); // Limit relevant history

        if (error) throw error;

        // Map snake_case to camelCase for frontend (if necessary, or just pass through)
        // Frontend likely expects standard structure.
        // Assuming transactions table has standard columns. 
        // If the frontend uses generic 'Transaction' type, we should map.
        
        const safeHistory: Transaction[] = (history || []).map((t: Record<string, any>) => ({
            id: t.id,
            cylinderId: t.cylinder_id,
            customerId: t.customer_id,
            workerId: t.worker_id,
            timestamp: t.created_at || t.timestamp,
            type: t.type,
            memo: t.memo
        }));

        return NextResponse.json({ success: true, data: safeHistory });
    } catch (error) {
        console.error('User History API Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
