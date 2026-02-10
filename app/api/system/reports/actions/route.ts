
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, serialNumber } = body;

        if (!serialNumber || !action) {
            return NextResponse.json({ success: false, message: '잘못된 요청입니다.' }, { status: 400 });
        }

        // [Performance Optimization] Direct Supabase query instead of db.reload()
        const { data: cylinderData } = await supabase
            .from('cylinders')
            .select('*')
            .eq('id', serialNumber)
            .maybeSingle();

        if (!cylinderData) {
            return NextResponse.json({ success: false, message: '해당 용기를 찾을 수 없습니다.' }, { status: 404 });
        }
        
        const cylinder = TransactionValidator.sanitizeCylinders([cylinderData])[0];

        const timestamp = new Date().toISOString();
        const worker = 'Administrator'; // Since this is a system report action

        if (action === 'FORCE_RETURN') {
            // Update cylinder in Supabase
            await supabase
                .from('cylinders')
                .update({ 
                    status: '공병',
                    currentHolderId: 'SAMDUK'
                })
                .eq('id', serialNumber);

            // Log Transaction
            await supabase
                .from('transactions')
                .insert({
                    id: crypto.randomUUID(),
                    cylinderId: serialNumber,
                    type: '회수',
                    timestamp: timestamp,
                    customerId: '삼덕공장',
                    workerId: worker,
                    memo: '강제회수(관리자)'
                });

        } else if (action === 'MARK_LOST') {
            // Update cylinder in Supabase
            await supabase
                .from('cylinders')
                .update({ status: '분실' })
                .eq('id', serialNumber);

            // Log Transaction
            await supabase
                .from('transactions')
                .insert({
                    id: crypto.randomUUID(),
                    cylinderId: serialNumber,
                    type: '분실',
                    timestamp: timestamp,
                    customerId: cylinder.currentHolderId || 'Unknown',
                    workerId: worker,
                    memo: '분실처리(관리자)'
                });
        
        } else {
             return NextResponse.json({ success: false, message: '알 수 없는 작업입니다.' }, { status: 400 });
        }

        
        return NextResponse.json({ success: true, message: '작업이 완료되었습니다.' });

    } catch (error) {
        console.error('Report Action Error:', error);
        return NextResponse.json({ success: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
