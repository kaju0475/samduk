import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * 테스트 데이터 정리 API
 * TEST_ 접두사로 시작하는 모든 데이터 삭제
 */
export async function POST(request: Request) {
    try {
        const { action } = await request.json();
        
        if (action !== 'cleanup') {
            return NextResponse.json({ 
                success: false, 
                message: '유효하지 않은 작업입니다.' 
            }, { status: 400 });
        }
        
        const deletedCount = {
            transactions: 0,
            cylinders: 0,
            customers: 0
        };
        
        // 1. 트랜잭션 삭제
        const { data: deletedTx, error: txError } = await supabase
            .from('transactions')
            .delete()
            .like('id', 'TEST_%')
            .select();
        
        if (txError) {
            console.error('[cleanup] Transaction delete error:', txError);
            throw new Error('트랜잭션 삭제 실패: ' + txError.message);
        }
        
        deletedCount.transactions = deletedTx?.length || 0;
        
        // 2. 용기 삭제
        const { data: deletedCyl, error: cylError } = await supabase
            .from('cylinders')
            .delete()
            .like('id', 'TEST_%')
            .select();
        
        if (cylError) {
            console.error('[cleanup] Cylinder delete error:', cylError);
            throw new Error('용기 삭제 실패: ' + cylError.message);
        }
        
        deletedCount.cylinders = deletedCyl?.length || 0;
        
        // 3. 거래처 삭제
        const { data: deletedCus, error: cusError } = await supabase
            .from('customers')
            .delete()
            .like('id', 'TEST_%')
            .select();
        
        if (cusError) {
            console.error('[cleanup] Customer delete error:', cusError);
            throw new Error('거래처 삭제 실패: ' + cusError.message);
        }
        
        deletedCount.customers = deletedCus?.length || 0;
        
        const totalDeleted = deletedCount.transactions + deletedCount.cylinders + deletedCount.customers;
        
        return NextResponse.json({ 
            success: true, 
            message: `테스트 데이터가 성공적으로 삭제되었습니다. (총 ${totalDeleted}개)`,
            details: deletedCount
        });
        
    } catch (error) {
        console.error('[cleanup-test-data] Error:', error);
        return NextResponse.json({ 
            success: false, 
            message: error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.' 
        }, { status: 500 });
    }
}
