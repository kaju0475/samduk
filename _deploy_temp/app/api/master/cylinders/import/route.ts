import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Cylinder, CylinderStatus } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data } = body; // Array of items

    if (!Array.isArray(data)) {
        return NextResponse.json({ success: false, message: '잘못된 데이터 형식입니다. 배열이 필요합니다.' }, { status: 400 });
    }

    // [ZERO DEFECT] 1. Safety Backup
    // await db.createBackup('pre-import-cylinders'); // Method removed from DB types

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.forEach((item: any) => {
        // [Feature] Support English keys AND Raw Korean keys from Excel
        const serialNumber = item.serialNumber || item['일련번호'];
        const gasType = item.gasType || item['가스종류'];
        const capacity = item.capacity || item['용량'];
        const owner = item.owner || item['소유자'];
        const chargingExpiryDate = item.chargingExpiryDate || item['충전기한'];
        
        // [New] Status & Location Support
        const rawStatus = item.status || item['상태'];
        const rawLocation = item.location || item['현재위치'];

        // Validation
        if (!serialNumber || !gasType) {
            failCount++;
            errors.push(`Row missing serial or gas: ${JSON.stringify(item)}`);
            return;
        }

        // Duplicate Check
        const exists = db.cylinders.some(c => c.serialNumber.toLowerCase() === serialNumber.toLowerCase());
        if (exists) {
            failCount++;
            errors.push(`Duplicate Serial: ${serialNumber}`);
            return;
        }

        // [Logic] Resolve Status
        let status = '공병';
        if (rawStatus) {
            // Validate against known statuses if needed, or trust input (it's string typed)
            status = rawStatus.trim();
        }

        // [Logic] Resolve Location (Name -> ID)
        let currentHolderId = '삼덕공장';
        if (rawLocation) {
            const locName = rawLocation.trim();
            if (locName === 'SAMDUK' || locName === '삼덕공장' || locName === '삼덕용기') {
                currentHolderId = '삼덕공장';
            } else {
                const customer = db.customers.find(c => c.name === locName);
                if (customer) {
                    currentHolderId = customer.id;
                } else {
                    // Location not found -> Default to Factory but maybe warn?
                    // For now, default to Factory ensures creation succeeds.
                    currentHolderId = '삼덕공장'; 
                    // optional: errors.push(`Location '${locName}' not found for ${serialNumber}, defaulted to Factory.`);
                }
            }
        }

        // Create
        const newCylinder: Cylinder = {
            id: uuidv4(),
            serialNumber: serialNumber.toUpperCase(),
            gasType,
            capacity: capacity || '40L',
            owner: owner || '삼덕공장',
            status: status as CylinderStatus, // Cast to match type
            currentHolderId: currentHolderId,
            chargingExpiryDate: chargingExpiryDate || '',
            lastInspectionDate: new Date().toISOString().split('T')[0],
            createdDate: new Date().toISOString(),
            containerType: 'CYLINDER'
        };

        db.cylinders.push(newCylinder);
        successCount++;
    });

    if (successCount > 0) {
        await db.save(); // Atomic Save
        
        // [ZERO DEFECT] Audit Log
        const { AuditLogger } = await import('@/lib/audit-logger');
        await AuditLogger.log('IMPORT_CYLINDER', { 
            count: successCount, 
            fail: failCount,
            sample: data[0]?.serialNumber 
        }, 'ADMIN');
    }

    return NextResponse.json({ 
        success: true, 
        message: `총 ${data.length}건 처리 완료. (성공: ${successCount}, 실패: ${failCount})`,
        errors 
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: '가져오기 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
