import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // [Performance Optimization] Direct Supabase query instead of db.reload()
        const { data: cylindersData } = await supabase.from('cylinders').select('*');
        const { data: transactionsData } = await supabase.from('transactions').select('*');
        
        const cylinders = TransactionValidator.sanitizeCylinders(cylindersData || []);
        const transactions = TransactionValidator.sanitizeTransactions(transactionsData || []);
        
        const abnormalItems: Record<string, unknown>[] = [];

        // 0. Fetch Dynamic Company Settings
        let validOwners = ['삼덕가스공업(주)', '삼덕', 'SDG', '삼덕가스', 'SAMDUK', '삼덕공장']; // Defaults
        
        const { data: settings } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'company')
            .single();

        if (settings?.value) {
            const { companyName, aliases } = settings.value;
            // Normalize and merge
            const dynamicAliases = Array.isArray(aliases) ? aliases : [];
            validOwners = [
                companyName, 
                ...dynamicAliases,
                'SAMDUK', '삼덕공장' // Internal immutable keys
            ].filter(Boolean);
        }

        // Helper: Check if holder is 'My Company'
        const isMyCompany = (holderId: string | null | undefined) => {
            if (!holderId) return false;
            const target = holderId.trim().toUpperCase();
            return validOwners.some(owner => owner.trim().toUpperCase() === target);
        };

        for (const cylinder of cylinders) {
            let limitType = '';
            let description = '';

            // 1. [Basic] Status vs Holder Mismatch
            if (cylinder.status === '납품' && isMyCompany(cylinder.currentHolderId)) {
                limitType = '위치불일치';
                description = '상태는 [납품]이나 소유자가 [삼덕공장]입니다.';
            }
            else if ((cylinder.status === '충전중' || cylinder.status === '실병') && !isMyCompany(cylinder.currentHolderId)) {
                limitType = '위치불일치';
                description = `상태는 [${cylinder.status}]이나 소유자가 공장이 아닙니다 (${cylinder.currentHolderId}).`;
            }
            else if (cylinder.status === '납품' && cylinder.currentHolderId === 'UNKNOWN') {
                limitType = '소유자미상';
                description = '납품 상태이나 거래처 정보가 없습니다.';
            }

            // 2. [Advanced] Safety Engine Heuristics
            if (!limitType) {
                const anomaly = TransactionValidator.analyzeAnomalies(cylinder, transactions);
                if (anomaly) {
                    limitType = anomaly.type;
                    description = anomaly.description;
                }
            }

            if (limitType) {
                abnormalItems.push({
                    serialNumber: cylinder.serialNumber,
                    gasType: cylinder.gasType,
                    status: cylinder.status,
                    location: cylinder.currentHolderId,
                    type: limitType,
                    description: description,
                    updatedAt: cylinder.createdAt || new Date().toISOString()
                });
            }
        }

        return NextResponse.json({ success: true, data: abnormalItems });

    } catch (error) {
        console.error('Abnormal report error:', error);
        return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
    }
}
