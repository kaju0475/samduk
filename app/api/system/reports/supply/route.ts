
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';
import { Customer, User } from '@/lib/types';
import dayjs from 'dayjs';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const customerId = searchParams.get('customerId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!customerId) {
            return NextResponse.json([], { status: 400 });
        }

        // [Performance Optimization] Direct Supabase query instead of db.reload()
        const { data: transactionsData } = await supabase.from('transactions').select('*');
        const { data: cylindersData } = await supabase.from('cylinders').select('*');
        const { data: customersData } = await supabase.from('customers').select('*');
        const { data: usersData } = await supabase.from('users').select('*');
        
        const transactions = TransactionValidator.sanitizeTransactions(transactionsData || []);
        const cylinders = TransactionValidator.sanitizeCylinders(cylindersData || []);
        const customers = customersData || [];
        const users = usersData || [];

        // Filter transactions for this customer
        // Usually '납품' (Delivery) and '회수' (Collection) are the key supply events.
        let filtered = transactions.filter(t => 
            t.customerId === customerId && 
            (t.type === '납품' || t.type === '회수')
        );

        if (startDate) {
            filtered = filtered.filter(t => dayjs(t.timestamp).isAfter(dayjs(startDate).startOf('day')));
        }
        if (endDate) {
            filtered = filtered.filter(t => dayjs(t.timestamp).isBefore(dayjs(endDate).endOf('day')));
        }

        // Sort desc
        filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Map
        const result = filtered.map(t => {
            // Find Gas Type. 
            // Transaction might not optimize saving gas type, so lookup cylinder
            // Note: Cylinder might have changed gas type later? Usually not.
            // But if we want historical gas type, we rely on cylinder's current type 
            // or if transaction stored it (not in current Transaction interface).
            // Current Cylinder lookup:
            const cylinder = cylinders.find(c => c.serialNumber === t.cylinderId);
            const gasName = cylinder ? cylinder.gasType : '알 수 없음';

            return {
                id: t.id,
                date: t.timestamp,
                type: t.type,
                item: gasName, // Gas Name
                serial: t.cylinderId,
                quantity: 1, // Individual cylinder transaction is count 1
                
                // [FIX] Resolve Names
                worker: users.find((u: User) => u.id === t.workerId)?.name || t.workerId || '-',
                customerName: customers.find((c: Customer) => c.id === t.customerId)?.name || '-',
                customer: t.customerId // Keep ID reference just in case
            };
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('Supply report error:', error);
        return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
    }
}
