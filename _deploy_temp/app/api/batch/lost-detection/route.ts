import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { safeCompare } from '@/app/utils/data-safety';

export async function POST() {
    try {
        let updateCount = 0;
        const THRESHOLD_MONTHS = 24;
        
        // Calculate cutoff date (24 months ago)
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - THRESHOLD_MONTHS);

        const updates: { serial: string, reason: string }[] = [];

        db.cylinders.forEach(cylinder => {
            // content: Skip if already SCRAP or LOST
            if (['폐기', '분실'].includes(cylinder.status)) return;

            // 1. Check Last Delivery Transaction (Priority Criteria: > 24 Months)
            // We need to find the *latest* '납품' transaction to determine when it was last sent out.
            const deliveryTxs = db.transactions
                .filter(t => 
                    safeCompare(t.cylinderId, cylinder.serialNumber) && 
                    t.type === '납품'
                )
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const lastDelivery = deliveryTxs[0];

            // Condition: Must have a delivery history AND that delivery must be older than cutoff
            if (lastDelivery) {
                const deliveryDate = new Date(lastDelivery.timestamp);
                
                if (deliveryDate < cutoffDate) {
                    // Logic Met: > 24 Months since last delivery
                    // (Expiry check removed as per user request: "Display even if just 24 months passed")
                    cylinder.status = '분실';
                    updateCount++;
                    updates.push({ serial: cylinder.serialNumber, reason: `Last Delivery: ${deliveryDate.toISOString().split('T')[0]}` });

                    // Log System Transaction
                    db.transactions.push({
                        id: uuidv4(),
                        timestamp: new Date().toISOString(),
                        type: '분실', // 'LOST'
                        cylinderId: cylinder.serialNumber,
                        customerId: lastDelivery.customerId || '미확인', // Last known location
                        workerId: 'SYSTEM',
                        memo: `장기 미회수 자동 분류 (${THRESHOLD_MONTHS}개월 경과)`
                    });
                }
            }
        });

        if (updateCount > 0) {
            await db.save();
        }

        return NextResponse.json({ 
            success: true, 
            message: `총 ${updateCount}개의 용기가 '분실(미아)' 상태로 분류되었습니다.`,
            count: updateCount,
            details: updates 
        });

    } catch (e) {
        console.error('Batch Error:', e);
        return NextResponse.json({ success: false, message: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
    }
}
