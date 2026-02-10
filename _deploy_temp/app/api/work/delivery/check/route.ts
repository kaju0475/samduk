import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';
import { deriveCylinderState } from '@/app/utils/cylinder';
import { safeLowerCase } from '@/app/utils/data-safety';
import { parseSmartScan } from '@/lib/smart-scan-logic';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, qrCode, customerId } = body;

        const parse = parseSmartScan(qrCode);
        const targetQr = parse && parse.intent === 'CYLINDER' ? parse.cleanTarget : (qrCode ? safeLowerCase(qrCode) : '');

        // 1. Fetch Cylinder
        const { data: cylData } = await supabase.from('cylinders')
            .select('*')
            .eq('id', targetQr)
            .maybeSingle();
        
        let cylinder;
        if (!cylData) {
            const { data: secondTry } = await supabase.from('cylinders').select('*').eq('serial_number', targetQr).maybeSingle();
            if (!secondTry) {
                return NextResponse.json({ success: false, message: '용기를 찾을 수 없습니다.' });
            }
            cylinder = TransactionValidator.sanitizeCylinders([secondTry])[0];
        } else {
            cylinder = TransactionValidator.sanitizeCylinders([cylData])[0];
        }

        // 2. State Derivation
        const { data: recentTxs } = await supabase.from('transactions')
            .select('*')
            .eq('cylinder_id', cylinder.serialNumber)
            .order('created_at', { ascending: false })
            .limit(5);
        
        const cylinderTxHistory = TransactionValidator.sanitizeTransactions(recentTxs || []);
        const { status: derivedStatus, currentHolderId: derivedHolder } = deriveCylinderState(cylinder, cylinderTxHistory);
        
        if (derivedStatus) cylinder.status = derivedStatus;
        if (derivedHolder) cylinder.currentHolderId = derivedHolder;

        let valResult;
        if (action === 'DELIVERY') {
            valResult = TransactionValidator.validateDelivery(cylinder, customerId);
        } else if (action === 'COLLECTION_EMPTY' || action === 'COLLECTION_FULL') {
            valResult = TransactionValidator.validateCollection(cylinder, customerId);
        } else {
            return NextResponse.json({ success: false, message: '유효하지 않은 작업입니다.' });
        }

        const inspectionStatus = TransactionValidator.getInspectionStatus(cylinder.chargingExpiryDate);

        return NextResponse.json({
            success: valResult.success,
            code: valResult.code,
            message: valResult.error || valResult.warning || '',
            data: {
                serialNumber: cylinder.serialNumber,
                status: cylinder.status,
                safety: {
                    level: valResult.success ? (valResult.warning ? 'warning' : 'success') : 'error',
                    color: inspectionStatus.color,
                    desc: inspectionStatus.desc,
                    diffDays: inspectionStatus.diffDays
                }
            }
        });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ success: false, message: '확인 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
