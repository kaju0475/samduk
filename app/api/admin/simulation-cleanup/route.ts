import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db'; // Local DB Import

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'simulate'; // 'simulate' or 'execute'

    // 1. Next.js가 로드한 환경변수 사용 (로컬 파일 파싱 X)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Service Role Key 우선 사용, 없으면 Anon Key 사용 (삭제 권한 확인 필요)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ 
            success: false, 
            message: '환경 변수 설정 오류', 
            debug: { url: !!supabaseUrl, key: !!serviceRoleKey } 
        }, { status: 500 });
    }

    // 2. 관리자 권한 클라이언트 생성
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    try {
        // [삭제 패턴 정의]
        const txTargetPatterns = ['SIMULATOR_BOT', 'SIMULATOR', 'SIM-STRESS', 'VERIFY-', 'SD-TEST'];
        const cylTargetPatterns = ['TEST-SIM', 'SIMULATOR', 'SIM-STRESS', 'VERIFY-', 'SD-TEST', 'PROD-'];
        const custTargetPatterns = ['TestCust_', 'PROD_TEST_', 'ProbeTest', 'TestCustomer'];

        // 3. 시뮬레이션: Supabase 조회
        const sbTxPatterns = txTargetPatterns.map(p => `workerId.ilike.%${p}%`).join(',');
        const { data: sbTxData } = await supabase.from('transactions').select('id, workerId').or(sbTxPatterns);

        const sbCylPatterns = cylTargetPatterns.map(p => `serial_number.ilike.${p}%,id.ilike.${p}%`).join(',');
        const { data: sbCylData } = await supabase.from('cylinders').select('id, serial_number').or(sbCylPatterns);

        const sbCustPatterns = custTargetPatterns.map(p => `name.ilike.%${p}%`).join(',');
        const { data: sbCustData } = await supabase.from('customers').select('id, name').or(sbCustPatterns);

        // 4. 시뮬레이션: Local DB 조회 filter
        await db.init(); // Ensure DB is loaded
        const localTx = db.transactions.filter(t => txTargetPatterns.some(p => t.workerId?.includes(p)));
        const localCyl = db.cylinders.filter(c => cylTargetPatterns.some(p => c.serialNumber?.startsWith(p) || c.id?.startsWith(p)));
        const localCust = db.customers.filter(c => custTargetPatterns.some(p => c.name.includes(p)));

        const txCount = (sbTxData?.length || 0) + localTx.length;
        const cylCount = (sbCylData?.length || 0) + localCyl.length;
        const custCount = (sbCustData?.length || 0) + localCust.length;

        const report = {
            status: 'OK',
            mode: mode.toUpperCase(),
            found: {
                total: txCount + cylCount + custCount,
                supabase: {
                    transactions: sbTxData?.length || 0,
                    cylinders: sbCylData?.length || 0,
                    customers: sbCustData?.length || 0,
                },
                local: {
                    transactions: localTx.length,
                    cylinders: localCyl.length,
                    customers: localCust.length,
                },
                patterns: [...txTargetPatterns, ...cylTargetPatterns, ...custTargetPatterns],
            }
        };

        if (mode === 'simulate') {
            return NextResponse.json({
                ...report,
                message: `[시뮬레이션] 총 ${report.found.total}건 발견 (Local: ${localCyl.length}건, Cloud: ${sbCylData?.length || 0}건). 삭제하려면 ?mode=execute 를 붙여주세요.`
            });
        }

        // 5. 실행: 실제 삭제 (mode === 'execute')
        if (mode === 'execute') {
            if (report.found.total === 0) {
                return NextResponse.json({ success: true, message: '삭제할 데이터가 없습니다.' });
            }

            // A. Supabase 삭제
            if (sbTxData?.length) await supabase.from('transactions').delete().or(sbTxPatterns);
            if (sbCylData?.length) await supabase.from('cylinders').delete().or(sbCylPatterns);
            if (sbCustData?.length) await supabase.from('customers').delete().or(sbCustPatterns);

            // B. Local DB 삭제
            let localDeletedCount = 0;
            if (localTx.length > 0) {
                db.transactions = db.transactions.filter(t => !localTx.includes(t));
                localDeletedCount += localTx.length;
            }
            if (localCyl.length > 0) {
                db.cylinders = db.cylinders.filter(c => !localCyl.includes(c));
                localDeletedCount += localCyl.length;
            }
            if (localCust.length > 0) {
                db.customers = db.customers.filter(c => !localCust.includes(c));
                localDeletedCount += localCust.length;
            }

            // 변경사항 저장
            if (localDeletedCount > 0) {
                await db.save(); 
            }

            return NextResponse.json({
                success: true,
                message: `[실행 완료] Cloud 데이터와 Local 데이터 ${localDeletedCount}건을 포함하여 모두 영구 삭제했습니다.`,
                deleted: report.found
            });
        }

    } catch (e: any) {
        return NextResponse.json({ success: false, message: e.message }, { status: 500 });
    }
}
