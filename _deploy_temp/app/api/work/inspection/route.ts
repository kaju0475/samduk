import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType, Cylinder, Transaction } from '@/lib/types';
import { deriveCylinderState } from '@/app/utils/cylinder';
import { TransactionValidator } from '@/lib/transaction-validator';
import { parseSmartScan } from '@/lib/smart-scan-logic';
import { db } from '@/lib/db';
import { Mutex } from 'async-mutex';

export const dynamic = 'force-dynamic';

// [Concurrency Control] Global Mutex to prevent race conditions
const postMutex = new Mutex();

export async function POST(request: Request) {
  // [Concurrency Control] Serialize all POST requests to prevent race conditions
  return await postMutex.runExclusive(async () => {
    try {
    const body = await request.json();
    const { qrCode, action, nextInspectionDate, workerId, memo } = body;

    // Validate Worker ID
    if (!workerId || workerId === 'WORKER-DEFAULT') {
        return NextResponse.json({ success: false, message: '작업자 정보가 없습니다. 다시 로그인해주세요.' }, { status: 400 });
    }

    // 1. Resolve QR / Find Cylinder
    const parse = parseSmartScan(qrCode);
    const targetQr = parse && parse.intent === 'CYLINDER' ? parse.cleanTarget : (qrCode ? qrCode.trim() : '');

    // Fetch Cylinder
    const { data: cylData } = await supabase.from('cylinders')
        .select('*')
        .ilike('id', targetQr)
        .maybeSingle();

    let cylinder: Cylinder | null = null;
    if (cylData) {
        cylinder = TransactionValidator.sanitizeCylinders([cylData])[0];
    } else {
        // Fallback check serial
        const { data: serialMock } = await supabase.from('cylinders').select('*').or(`memo.eq.${targetQr},id.ilike.${targetQr}`).maybeSingle();
        if (serialMock) cylinder = TransactionValidator.sanitizeCylinders([serialMock])[0];
    }
    
    if (!cylinder) {
        const displayQr = (qrCode || '').replace(/^https?:\/\/[^\/]+\/(cylinders\/)?/i, '');
        return NextResponse.json({ success: false, message: `용기를 찾을 수 없습니다. (${displayQr})` }, { status: 404 });
    }

    // 2. Fetch History for State Derivation
    const { data: recentTxs } = await supabase.from('transactions')
        .select('*')
        .ilike('cylinderId', cylinder.serialNumber)
        .order('created_at', { ascending: false })
        .limit(10);
    
    const cylinderTxHistory = TransactionValidator.sanitizeTransactions(recentTxs || []);

    // 3. Derived State Logic
    const { status: derivedStatus, currentHolderId: derivedHolder } = deriveCylinderState(cylinder, cylinderTxHistory);

    if (derivedStatus) cylinder.status = derivedStatus;
    if (derivedHolder) cylinder.currentHolderId = derivedHolder;

    let message = '';

    // --- Action Logic ---
    if (action === 'OUT') {
        const valResult = TransactionValidator.validateInspectionOutbound(cylinder);

        if (!valResult.success) {
            return NextResponse.json({ success: false, message: valResult.error, code: valResult.code }, { status: 400 });
        }

        // Action: OUT
        cylinder.currentHolderId = 'INSPECTION_AGENCY';
        cylinder.status = '검사중'; 
        
        message = `검사 출고 완료: ${cylinder.gasType} (${cylinder.serialNumber})`;
    } else if (action === 'SCRAP') {
        const valResult = TransactionValidator.validateInspectionScrap(cylinder);
        if (!valResult.success) {
             return NextResponse.json({ success: false, message: valResult.error }, { status: 400 });
        }
        
        cylinder.currentHolderId = '폐기'; 
        cylinder.status = '폐기';
        
        message = `폐기 처리 완료: ${cylinder.gasType} (${cylinder.serialNumber})`;
    } else if (action === 'REINSPECT') {
        const valResult = TransactionValidator.validateInspectionReinspect(cylinder);
        if (!valResult.success) {
             return NextResponse.json({ success: false, message: valResult.error }, { status: 400 });
        }
        
        cylinder.currentHolderId = '삼덕공장';
        cylinder.status = '불량'; 
        
        message = `재검사(불량) 처리 완료: ${cylinder.gasType} (${cylinder.serialNumber})`;
    } else if (action === 'IN') {
        const valResult = TransactionValidator.validateInspectionInbound(cylinder);
        
        if (!valResult.success) {
             return NextResponse.json({ 
                 success: false, 
                 message: valResult.error,
                 subMessage: (valResult.code === 'LOCATION_ERROR' ? '검사 출고를 먼저 진행해주세요.' : ''),
                 code: valResult.code 
             }, { status: 400 });
        }

        if (!nextInspectionDate) {
            return NextResponse.json({ success: false, message: '차기 검사일(갱신됨)이 필요합니다.' }, { status: 400 });
        }

        cylinder.currentHolderId = '삼덕공장';
        cylinder.status = '공병';
        cylinder.chargingExpiryDate = nextInspectionDate;
        // Last inspection date = today
        const today = new Date().toISOString().split('T')[0];
        cylinder.lastInspectionDate = today; 

    } else {
        return NextResponse.json({ success: false, message: 'Invalid Action' }, { status: 400 });
    }

    // 4. Record Transaction & Update Cylinder (Atomic-ish)
    if (action) {
      const txTimestamp = new Date().toISOString();
      const txId = uuidv4();

      const txObj: Transaction = {
          id: txId,
          timestamp: txTimestamp,
          type: action as TransactionType,
          cylinderId: cylinder.serialNumber, 
          customerId: '삼덕공장',
          workerId: workerId,
          memo: memo || message
      };

      try {
          await db.transaction(data => {
              // 1. Update Transactions
              data.transactions = [txObj, ...data.transactions];
              
              // 2. Update Cylinder
              data.cylinders = data.cylinders.map(c => 
                  c.id === cylinder!.id 
                  ? { 
                      ...c, 
                      status: cylinder!.status, 
                      currentHolderId: cylinder!.currentHolderId,
                      chargingExpiryDate: nextInspectionDate || c.chargingExpiryDate,
                      lastInspectionDate: (action === 'IN') ? new Date().toISOString().split('T')[0] : c.lastInspectionDate 
                    } 
                  : c
              );
          });
          
// console.log(`✅ [Inspection] Mutex-protected update success: ${cylinder.serialNumber}`);
      } catch (err) {
          console.error('❌ [Inspection] Atomic Update Failed:', err);
          return NextResponse.json({ success: false, message: '데이터 업데이트 중 충돌이 발생했습니다.' }, { status: 500 });
      }

      // Audit Log
      import('@/lib/audit-logger').then(({ AuditLogger }) => {
          AuditLogger.log(
             'TRANS_INSPECTION_UPDATE', 
             { cylinder: cylinder?.serialNumber, action, memo: message }, 
             workerId
          ).catch(console.error);
      });
    }

    return NextResponse.json({ success: true, message, data: cylinder });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
  }
  }); // End of postMutex.runExclusive
}
