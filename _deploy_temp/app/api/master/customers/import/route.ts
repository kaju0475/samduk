import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Customer } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data } = body; 

    if (!Array.isArray(data)) {
        return NextResponse.json({ success: false, message: '데이터 형식이 올바르지 않습니다 ("data" 배열 필요)' }, { status: 400 });
    }

    // [ZERO DEFECT] 1. Safety Backup (Scrapped for Supabase)
    // await db.createBackup('pre-import-customer');

    // [ZERO DEFECT] 2. Reload latest DB state (Scrapped for Supabase)
    // db.reload();

    let successCount = 0;
    let failCount = 0;

    // Pre-calculate max ledgers
    // Note: This simple max calculation is still vulnerable if 2 simultaneous imports happen.
    // For Production: Ideally lock the entire operation.
    // Given the single-threaded Node.js server nature + Mutex on Save, we are relatively safe *IF* we save immediately.
    // But here we process internal array then save.
    // Mitigation: We rely on the fact that Import is a "Admin" infrequent action.
    
    const existingBusiness = db.customers.filter(c => c.type === 'BUSINESS');
    let maxBusiness = existingBusiness.reduce((max, c) => Math.max(max, parseInt(c.ledgerNumber || '0', 10)), 0);

    const existingIndividual = db.customers.filter(c => c.type === 'INDIVIDUAL');
    let maxIndividual = existingIndividual.reduce((max, c) => Math.max(max, parseInt(c.ledgerNumber || '0', 10)), 0);

    // Filter valid items first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validItems = data.filter((item: any) => item.name);
    failCount = data.length - validItems.length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validItems.forEach((item: any) => {
        const { name, type, businessNumber, representative, phone, address } = item;
        
        const targetType = (type === '개인' || type === 'INDIVIDUAL') ? 'INDIVIDUAL' : 'BUSINESS';
        
        let nextLedger = '000';
        if (targetType === 'BUSINESS') {
            maxBusiness++;
            nextLedger = maxBusiness.toString().padStart(3, '0');
        } else {
            maxIndividual++;
            nextLedger = maxIndividual.toString().padStart(3, '0');
        }

        const newCustomer: Customer = {
            id: `C${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
            name,
            type: targetType, 
            paymentType: 'card', 
            address: address || '',
            phone: phone || '',
            businessNumber: businessNumber || '',
            ledgerNumber: nextLedger,
            corporateId: '',
            representative: representative || '',
            balance: 0, 
        };

        db.customers.push(newCustomer);
        successCount++;
    });

    if (successCount > 0) {
        await db.save(); // Atomic Save via Mutex
        
        // [ZERO DEFECT] Audit Log
        const { AuditLogger } = await import('@/lib/audit-logger');
        await AuditLogger.log('IMPORT_CUSTOMER', { 
            count: successCount, 
            fail: failCount,
            sample: validItems[0]?.name 
        }, 'ADMIN');
    }

    return NextResponse.json({ success: true, message: `총 ${successCount}건 가져오기 완료. (실패: ${failCount}건)` });

  } catch (error) {
    console.error('Import Error:', error);
    return NextResponse.json({ success: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
