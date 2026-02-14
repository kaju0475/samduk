import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Generators (Moved from frontend to API for consistency)
const generateTestUsers = () => Array.from({ length: 20 }).map((_, i) => ({
    id: `TEST-USER-${i + 1}`,
    username: `testuser${i + 1}`,
    name: `테스트 유저 ${i + 1}`,
    role: i === 0 ? '관리자' : '사용자' as const,
    password: '123'
}));

const generateTestCustomers = () => Array.from({ length: 20 }).map((_, i) => ({
    id: i < 10 ? `TEST-BIZ-${i + 1}` : `TEST-IND-${i + 1}`,
    name: i < 10 ? `(주) 테스트 기업 ${i + 1}` : `개인 고객 ${i + 1}`,
    type: i < 10 ? 'BUSINESS' : 'INDIVIDUAL' as const,
    paymentType: 'card' as const,
    address: '테스트 주소',
    phone: '010-0000-0000',
    businessNumber: i < 10 ? '123-45-67890' : '',
    balance: 0
}));

const generateTestCylinders = () => Array.from({ length: 24 }).map((_, i) => {
    const gasTypes = ['O2-40L', 'N2-40L', 'Ar-40L', 'CO2-20K'];
    const statuses = ['공병', '실병', '납품', '회수', '검사대상', '폐기'] as const;
    const gas = gasTypes[i % gasTypes.length];
    
    // Test logic for expiry
    let expiry = ''; // Default
    const today = new Date();
    if (i >= 20) expiry = new Date(today.setDate(today.getDate() - 5)).toISOString().substring(0, 7); // Expired
    else if (i >= 16) expiry = new Date(today.setDate(today.getDate() + 10)).toISOString().substring(0, 7); // Imminent
    else expiry = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString().substring(0, 7); // Valid

    return {
        id: `CYL-TEST-${1000 + i}`,
        serialNumber: `CYL-TEST-${1000 + i}`,
        gasType: gas,
        capacity: '40L',
        owner: 'SAMDUK',
        status: statuses[i % statuses.length],
        currentHolderId: '삼덕공장',
        chargingExpiryDate: expiry,
        lastInspectionDate: '2023-01-01',
        createdDate: new Date().toISOString()
    };
});

export async function POST(request: Request) {
    try {
        const { action } = await request.json();

        if (action === 'INJECT_TEST') {
            // 1. Inject Test Data
            const users = generateTestUsers();
            const customers = generateTestCustomers();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cylinders = generateTestCylinders();

            // Merge avoiding duplicates (simple id check)
            users.forEach(u => {
                if (!db.users.find(x => x.id === u.id)) db.users.push(u as any);
            });
            customers.forEach(c => {
                if (!db.customers.find(x => x.id === c.id)) db.customers.push(c as any);
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cylinders.forEach((c: any) => {
                if (!db.cylinders.find(x => x.id === c.id)) db.cylinders.push(c as any);
            });

            await db.save();
            return NextResponse.json({ success: true, message: '테스트 데이터가 생성되었습니다.' });
        }

        if (action === 'CLEAR_TEST') {
            // 2. Clear ONLY Test Data (Prefix based)
            // Filter in place
            // Requires direct access to arrays to reassign, or splice inverse
            // db.users is a getter/setter proxy? accessing property returns reference. 
            // In lib/db.ts, getters return reference to this.data.users. So modifying array works.
            // But replacing array needs a setter or splice.
            
            const isNotTest = (id: string) => !id.startsWith('TEST-') && !id.startsWith('CYL-TEST-');

            // We need to modify the arrays in place strictly if db.ts doesn't expose setters
            // Strategy: splice from end
            for (let i = db.users.length - 1; i >= 0; i--) {
                if (!isNotTest(db.users[i].id)) db.users.splice(i, 1);
            }
            for (let i = db.customers.length - 1; i >= 0; i--) {
                if (!isNotTest(db.customers[i].id)) db.customers.splice(i, 1);
            }
            for (let i = db.cylinders.length - 1; i >= 0; i--) {
                if (!isNotTest(db.cylinders[i].id)) db.cylinders.splice(i, 1);
            }
            // Clear test logs
             for (let i = db.transactions.length - 1; i >= 0; i--) {
                if (db.transactions[i].cylinderId.startsWith('CYL-TEST-')) db.transactions.splice(i, 1);
            }

            await db.save();
            return NextResponse.json({ success: true, message: '테스트 데이터가 삭제되었습니다.' });
        }

        if (action === 'FACTORY_RESET') {
            // 3. Factory Reset (Wipe All except Admin)
            const defaultAdmin = db.users.find(u => u.username === 'admin') || { 
                id: 'admin', username: 'admin', name: '관리자', role: '관리자', password: 'admin' 
            };
            
            // Preserve Gas Items
            // The 'gasItems' variable is declared but not used after its declaration.
            // It was likely intended for a different logic flow or is a remnant.
 

            // WIPE
            // Using splice to clear arrays in place
            db.users.splice(0, db.users.length);
            db.users.push(defaultAdmin as any);

            db.customers.splice(0, db.customers.length);
            db.cylinders.splice(0, db.cylinders.length);
            db.transactions.splice(0, db.transactions.length);
            db.dailyLedgerNotes.splice(0, db.dailyLedgerNotes.length);

            // Restore Gas Items logic if needed, but we didn't touch them.
            // (db.gasItems reference is stable?) 
            // Better to re-assign if possible, but splice clear is safe.
            // Actually gasItems are rarely changed by user, mostly static config. 
            // We kept them.

            await db.save();
            return NextResponse.json({ success: true, message: '시스템이 초기화되었습니다. (관리자 계정 유지)' });
        }

        return NextResponse.json({ success: false, message: 'Invalid Action' }, { status: 400 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, message: 'Server Error' }, { status: 500 });
    }
}
