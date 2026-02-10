import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Safety Check
        if ((body.action !== 'INITIALIZE_PRODUCTION' && body.action !== 'RELOAD') || body.confirm !== true) {
            return NextResponse.json({ success: false, message: '잘못된 요청입니다 (확인 필요)' }, { status: 400 });
        }

        // Execute DB Reset (This handles backup, memory clear, and disk save)
        // Execute DB Reset (This handles backup, memory clear, and disk save)
        if (body.action === 'INITIALIZE_PRODUCTION') {
            await db.resetProduction();
            return NextResponse.json({ 
                success: true, 
                message: '시스템이 실사용 모드로 초기화되었습니다. 모든 테스트 데이터가 삭제되었습니다.' 
            });
        }
        
        // [NEW] Hot Reload for Testing
        if (body.action === 'RELOAD') {
            db.reload();
            return NextResponse.json({ success: true, message: 'DB가 새로고침되었습니다.' });
        }

    } catch (e) {
        console.error('Init Error:', e);
        return NextResponse.json({ success: false, message: '시스템 초기화에 실패했습니다.' }, { status: 500 });
    }
}
