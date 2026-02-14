import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';
import { getGasColor } from '@/app/utils/gas';

import { Transaction } from '@/lib/types'; // [FIX] Added Import

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date'); // YYYY-MM-DD
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Validation
        if (!dateParam && (!startDate || !endDate)) {
            return NextResponse.json({ success: false, message: 'Date parameter required' }, { status: 400 });
        }

        let query = supabase.from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        // Filter by Date
        // Use KST-aware queries or simple string matching if ISO stored.
        // Assuming ISO stored in UTC, we need robust range.
        // Or simplifying to string match if stored as YYYY-MM-DD in 'date' column?
        // Check `charging/route.ts`: it uses `gte` / `lte` on `created_at`.
        
        // Let's use created_at with specific ranges (KST Aware)
        // If we query midnight KST, we use T00:00:00+09:00
        if (dateParam) {
            query = query.gte('created_at', `${dateParam}T00:00:00+00:00`).lte('created_at', `${dateParam}T23:59:59+00:00`);
        } else if (startDate && endDate) {
            query = query.gte('created_at', `${startDate}T00:00:00+00:00`).lte('created_at', `${endDate}T23:59:59+00:00`);
        }

        // Filter by Type
        query = query.in('type', ['검사출고', '검사입고', '기타출고', '폐기', '재검사']);

        const { data: rawData, error } = await query;
        if (error) throw error;
        
        const transactions = TransactionValidator.sanitizeTransactions(rawData || []);

        // Fetch Metadata (Cylinders, GasItems)
        const cylIds = Array.from(new Set(transactions.map(t => t.cylinderId)));
        
        // [FIX] Separate UUIDs and Serial Numbers to prevent Type Error
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validUuids = cylIds.filter(id => uuidRegex.test(id));
        // Unused 'serials' removed

        // 1. Fetch by valid UUID
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cyls1: Record<string, any>[] = [];
        if (validUuids.length > 0) {
            const { data } = await supabase.from('cylinders').select('id, memo, serial_number, gas_type, container_type').in('id', validUuids);
            cyls1 = data || [];
        }

        // 2. Fetch by Serial Number (using all IDs as candidates)
        // Note: Transactions store 'cylinderId' which matches 'serial_number' in DB usually.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cyls2: Record<string, any>[] = [];
        if (cylIds.length > 0) {
             // Safer: .in('serial_number', cylIds)
             const { data: serialData } = await supabase.from('cylinders').select('id, memo, serial_number, gas_type, container_type').in('serial_number', cylIds);
             cyls2 = serialData || [];
        }

        const allCyls = [...cyls1, ...cyls2];
        
        // Dedupe & Sanitize
        const uniqueCyls = new Map();
        allCyls.forEach(c => {
            const sanitized = TransactionValidator.sanitizeCylinders([c])[0];
            uniqueCyls.set(c.id, sanitized); // Map ID -> Obj
            if (c.serial_number) uniqueCyls.set(c.serial_number, sanitized); // Map Serial -> Obj (Critical for lookup)
            if (c.memo) uniqueCyls.set(c.memo, sanitized);
        });

        const { data: gasItems } = await supabase.from('gas_items').select('*');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gasMap = new Map((gasItems || []).map((g: any) => [g.id, g]));

        const { data: users } = await supabase.from('users').select('id, name');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        // Enrich
        const enrich = (list: Transaction[]) => {
            return list.map(t => {
                const cyl = uniqueCyls.get(t.cylinderId);
                const timeStr = new Date(t.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                const user = userMap.get(t.workerId);
                const gasItem = cyl ? gasMap.get(cyl.gasType) : null;
                
                // [FIX] ID -> Serial Force
                const displayCylId = cyl ? (cyl.serialNumber || cyl.id) : t.cylinderId;

                return {
                    ...t,
                    cylinderId: displayCylId,
                    time: timeStr,
                    gasType: gasItem ? (gasItem as any).name : (cyl ? cyl.gasType : 'Unknown'), // eslint-disable-line @typescript-eslint/no-explicit-any
                    gasColor: gasItem ? (gasItem as any).color : getGasColor(cyl?.gasType), // eslint-disable-line @typescript-eslint/no-explicit-any
                    containerType: cyl ? cyl.containerType : 'CYLINDER',
                    workerId: user ? (user as any).name : (t.workerId === 'admin' ? '관리자' : t.workerId) // eslint-disable-line @typescript-eslint/no-explicit-any
                };
            }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        };

        const enrichedList = enrich(transactions);

        const outbound = enrichedList.filter(t => t.type === '검사출고');
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const failure = enrichedList.filter((t: any) => {
            if (t.type === '폐기') return true;
            if (t.type === '재검사') return true;
            if (t.type === '기타출고' && t.memo?.includes('검사 불합격')) return true;
            if (t.type === '검사입고' && t.memo?.includes('검사 불합격')) return true;
            return false;
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inbound = enrichedList.filter((t: any) => {
            if (t.type !== '검사입고') return false;
            if (t.memo?.includes('검사 불합격')) return false; 
            return true;
        });

        return NextResponse.json({ 
            success: true, 
            data: { 
                date: dateParam,
                outbound,
                inbound,
                failure,
                summary: {
                    out: outbound.length,
                    in: inbound.length,
                    fail: failure.length
                }
            } 
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
    }
}
