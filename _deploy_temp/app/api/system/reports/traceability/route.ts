
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';
import { Customer, User } from '@/lib/types';
import dayjs from 'dayjs';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const serial = searchParams.get('serial');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!serial) {
            return NextResponse.json([], { status: 400 });
        }

        // [Performance Optimization] Direct Supabase query instead of db.reload()
        const { data: transactionsData } = await supabase.from('transactions').select('*');
        const { data: customersData } = await supabase.from('customers').select('*');
        const { data: usersData } = await supabase.from('users').select('*');
        
        const transactions = TransactionValidator.sanitizeTransactions(transactionsData || []);
        const customers = customersData || [];
        const users = usersData || [];

        let filtered = transactions.filter(t => t.cylinderId === serial);

        if (startDate) {
            filtered = filtered.filter(t => dayjs(t.timestamp).isAfter(dayjs(startDate).startOf('day')));
        }
        if (endDate) {
            filtered = filtered.filter(t => dayjs(t.timestamp).isBefore(dayjs(endDate).endOf('day')));
        }

        // Sort desc
        filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Map to display format
        // Expected: { date, type, cylinderId, location, worker }
        const result = filtered.map(t => {
            let locationName = '-';
            
            // Determine Location based on type
            if (t.type === '납품' || t.type === '회수') {
                const customer = customers.find((c: Customer) => c.id === t.customerId);
                locationName = customer ? customer.name : (t.customerId || '-');
            } else if (t.type === '검사출고' || t.type === '검사입고' || t.type === '폐기' || t.type === '재검사') {
                locationName = '검사소'; // Or specific agency name if recorded
            } else {
                locationName = '삼덕공장';
            }

            const user = users.find((u: User) => u.id === t.workerId);
            const workerName = user ? user.name : (t.workerId || '-');

            return {
                id: t.id,
                date: t.timestamp,
                type: t.type,
                cylinderId: t.cylinderId,
                location: locationName,
                worker: workerName,
                // Add memos if needed
            };
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('Traceability report error:', error);
        return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
    }
}
