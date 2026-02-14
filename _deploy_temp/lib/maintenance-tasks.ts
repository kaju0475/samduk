import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { safeCompare } from '@/app/utils/data-safety';

/**
 * Automatically classifies cylinders that haven't been returned for 24+ months as 'LOST' (분실).
 */
export async function runLostDetection() {
    let updateCount = 0;
    const THRESHOLD_MONTHS = 24;
    
    // Calculate cutoff date (24 months ago)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - THRESHOLD_MONTHS);

    const updates: { serial: string, reason: string }[] = [];

    db.cylinders.forEach(cylinder => {
        // Skip if already SCRAP (폐기) or LOST (분실)
        if (['폐기', '분실'].includes(cylinder.status)) return;

        // Find the LATEST '납품' (Delivery) transaction for this cylinder
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
                // Classify as LOST
                cylinder.status = '분실';
                updateCount++;
                updates.push({ 
                    serial: cylinder.serialNumber, 
                    reason: `Last Delivery: ${deliveryDate.toISOString().split('T')[0]}` 
                });

                // Log a system-generated transaction for the status change
                db.transactions.push({
                    id: uuidv4(),
                    timestamp: new Date().toISOString(),
                    type: '분실',
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

    return {
        success: true,
        count: updateCount,
        details: updates
    };
}
