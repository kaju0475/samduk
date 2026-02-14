
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';
import { Customer } from '@/lib/types';
import dayjs from 'dayjs';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const minDays = parseInt(searchParams.get('minDays') || '90');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // [Performance Optimization] Direct Supabase query instead of db.reload()
        const { data: cylindersData } = await supabase.from('cylinders').select('*');
        const { data: customersData } = await supabase.from('customers').select('*');
        const { data: transactionsData } = await supabase.from('transactions').select('*');
        
        const cylinders = TransactionValidator.sanitizeCylinders(cylindersData || []);
        const customers = customersData || [];
        const transactions = TransactionValidator.sanitizeTransactions(transactionsData || []);

        const longTermHeld: Array<{
            customerName: string;
            serialNumber: string;
            gasType: string;
            deliveryDate: string;
            daysHeld: number;
        }> = [];
        const today = dayjs();

        // 1. Filter cylinders currently at a customer
        // "currentHolderId" is not 'SAMDUK' (company) and not 'INSPECTION_AGENCY' (agency) and not 'UNKNOWN'
        // Also check status is '납품' (Delivered)
        const candidates = cylinders.filter(c => 
            c.status === '납품' && 
            c.currentHolderId && 
            c.currentHolderId !== 'SAMDUK' && 
            c.currentHolderId !== 'INSPECTION_AGENCY'
        );

        for (const cylinder of candidates) {
            // 2. Find the last '납품' (Delivery) transaction for this cylinder
            // We search transactions for this cylinder, filtered by type '납품', sorted by date desc
            const lastDelivery = transactions
                .filter(t => t.cylinderId === cylinder.serialNumber && t.type === '납품')
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

            if (lastDelivery) {
                const deliveryDate = dayjs(lastDelivery.timestamp);
                const daysHeld = today.diff(deliveryDate, 'day');

                if (daysHeld >= minDays) {
                    // Check Date Range Filter (Optional: Filter by Delivery Date?)
                    // The UI requirement seems to be "Current Status", but there is a Date Range Picker.
                    // Usually "Long Term" report is a snapshot of NOW. 
                    // However, if the user provided startDate/endDate, maybe they want to see items delivered in that range that are STILL held?
                    // Let's apply date filter on the 'Delivery Date' if provided.
                    
                    let inRange = true;
                    if (startDate && deliveryDate.isBefore(startDate)) inRange = false;
                    if (endDate && deliveryDate.isAfter(endDate)) inRange = false;

                    if (inRange) {
                        const customer = customers.find((c: Customer) => c.id === cylinder.currentHolderId);
                        longTermHeld.push({
                            customerName: customer ? customer.name : '알 수 없음',
                            serialNumber: cylinder.serialNumber,
                            gasType: cylinder.gasType,
                            deliveryDate: lastDelivery.timestamp,
                            daysHeld: daysHeld
                        });
                    }
                }
            } else {
                // If no delivery record found but status is Delivered... data inconsistency or migrated data without history.
                // We might skip or include with unknown date. Let's skip to be safe.
            }
        }

        // Sort by Days Held Descending
        longTermHeld.sort((a, b) => b.daysHeld - a.daysHeld);

        return NextResponse.json(longTermHeld);

    } catch (error) {
        console.error('Long-term report error:', error);
        return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
    }
}
