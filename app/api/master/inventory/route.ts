import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';
import { deriveCylinderState } from '@/app/utils/cylinder';
import { normalizeCompanyOwner } from '@/lib/company';
import { getGasColor } from '@/app/utils/gas';
import { Cylinder, Customer, Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface CylinderDetail {
    serialNumber: string;
    gasType: string;
    chargingExpiryDate: string;
    lastDeliveryDate: string;
    gasColor: string;
}

interface InventoryStats {
    customerId: string;
    customerName: string;
    customerType: 'BUSINESS' | 'INDIVIDUAL' | 'FACTORY';
    total: number;
    inventory: Record<string, number>;
    details: CylinderDetail[];
}

// [Optimized] Single Source of Truth: Direct Supabase Fetch
export async function GET() {
  try {
    // 1. Fetch Core Data in Parallel (High Limits + Select All for safety)
    const [custRes, cylRes, txRes, gasRes] = await Promise.all([
      supabase.from('customers').select('*').order('created_at', { ascending: false }).range(0, 9999), 
      supabase.from('cylinders').select('*').range(0, 9999),
      // Select * to ensure no field mapping issues
      supabase.from('transactions').select('*')
        .order('created_at', { ascending: false })
        .range(0, 9999),
      supabase.from('gas_items').select('*')
    ]);

    if (custRes.error) throw custRes.error;
    if (cylRes.error) throw cylRes.error;

    // 2. Sanitize
    const customers = TransactionValidator.sanitizeCustomers(custRes.data || []);
    const cylinders = TransactionValidator.sanitizeCylinders(cylRes.data || []);
    const transactions = TransactionValidator.sanitizeTransactions(txRes.data || []);
    const gasItems = gasRes.data || [];

    // 3. Group Transactions (Robust Key Normalization: Upper + Trim)
    const deliveryDateMap: Record<string, string> = {};
    const txMap = new Map<string, Transaction[]>();

    transactions.forEach(tx => {
        if (tx.cylinderId) {
            // [ROBUST FIX] Trim and Upper to match mismatched input
            const key = tx.cylinderId.trim().toUpperCase();
            
            // Delivery Map
            if (tx.type === '납품' && !deliveryDateMap[key]) {
                deliveryDateMap[key] = tx.timestamp.split('T')[0];
            }

            if (!txMap.has(key)) {
                txMap.set(key, []);
            }
            txMap.get(key)!.push(tx);
        }
    });

    const inventoryMap: Record<string, InventoryStats> = {};

    // 4. Initialize Holders (Trim IDs)
    customers.forEach((c: Customer) => {
        const key = c.id.trim();
        inventoryMap[key] = {
            customerId: key,
            customerName: c.name,
            customerType: c.type || 'BUSINESS',
            total: 0,
            inventory: {},
            details: []
        };
    });

    inventoryMap['삼덕공장'] = {
        customerId: '삼덕공장',
        customerName: '삼덕공장 (내부)',
        customerType: 'FACTORY',
        total: 0,
        inventory: {},
        details: []
    };

    // 5. Logical Distribution
    cylinders.forEach((cyl: Cylinder) => {
        // Match using Robust Key
        const serialKey = cyl.serialNumber.trim().toUpperCase();
        const cylinderTransactions = txMap.get(serialKey) || [];
        
        const state = deriveCylinderState(cyl, cylinderTransactions);
        let holderId = state.currentHolderId || '삼덕공장';
        
        // Normalize and Trim
        holderId = normalizeCompanyOwner(holderId).trim();

        if (!inventoryMap[holderId]) {
             // [FIX] Dynamically create entry for unregistered/orphan holders
             // This ensures that even if "MS Gas" ID has invisible whitespace or casing diffs, 
             // it will create an entry and show the inventory.
             inventoryMap[holderId] = {
                customerId: holderId,
                customerName: `미등록 (${holderId})`,
                customerType: 'INDIVIDUAL',
                total: 0,
                inventory: {},
                details: []
            };
        }

        const stats = inventoryMap[holderId];
        stats.total += 1;

        const gas = cyl.gasType || 'UNKNOWN';
        stats.inventory[gas] = (stats.inventory[gas] || 0) + 1;

        stats.details.push({
            serialNumber: cyl.serialNumber,
            gasType: gas,
            chargingExpiryDate: cyl.chargingExpiryDate || '-',
            lastDeliveryDate: deliveryDateMap[serialKey] || '-',
            gasColor: gasItems.find((g: {id: string, color: string}) => g.id === gas)?.color || getGasColor(gas)
        });
    });

    const result = Object.values(inventoryMap).sort((a: InventoryStats, b: InventoryStats) => b.total - a.total);

    return NextResponse.json({ success: true, data: result }, {
        headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('Inventory API Error:', error);
    return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
  }
}
