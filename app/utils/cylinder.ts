import { Cylinder, CylinderStatus, Transaction } from '@/lib/types';

interface CylinderState {
    status: CylinderStatus;
    currentHolderId: string;
}

/**
 * Derives the current state (Status & Holder) of a cylinder 
 * by replaying its transaction history.
 * 
 * @param cylinder - The cylinder object (for fallback values)
 * @param transactions - List of ALL transactions (will be filtered for this cylinder)
 * @returns { status, currentHolderId } - The calculated state
 */
export function deriveCylinderState(cylinder: Cylinder, transactions: Transaction[]): CylinderState {
    // 1. Filter and Sort Transactions for this specific cylinder
    // (Assuming transactions are passed in bulk for performance, or pre-filtered)
    // If passed bulk, we filter. If passed filtered, we just sort.
    // Ideally, caller passes relevant transactions to avoid O(N) per cylinder in a loop.
    // But for safety, we filter.
    // 1. Filter and Sort Transactions for this specific cylinder
    // (Assuming transactions are passed in bulk for performance, or pre-filtered)
    // If passed bulk, we filter. If passed filtered, we just sort.
    // [ROBUST MATCH] Use trim() and toUpperCase() to handle whitespace/case mismatches from legacy inputs
    const targetSerial = cylinder.serialNumber ? cylinder.serialNumber.trim().toUpperCase() : '';
    
    const relevantTxs = transactions
        .filter(t => t.cylinderId && t.cylinderId.trim().toUpperCase() === targetSerial)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 0. Safety Check: If ANY transaction is '폐기', the cylinder is permanently scrapped.
    // (Unless we implement a "Scrap Recovery" later, but for now it's terminal)
    const isScrapped = relevantTxs.some(t => t.type === '폐기');
    if (isScrapped) {
        return { status: '폐기', currentHolderId: '폐기' };
    }

    const lastTx = relevantTxs[0];

    // Default Fallback (Existing State or Factory)
    let status: CylinderStatus = cylinder.status;
    let currentHolderId: string = cylinder.currentHolderId || '삼덕공장';

    if (lastTx) {
        // Logic Source of Truth
        if (lastTx.type === '납품') {
            status = '납품';
            currentHolderId = lastTx.customerId || '미확인';
        } else if (lastTx.type === '회수' || lastTx.type === '회수(실병)') {
            const isFull = lastTx.type === '회수(실병)' || (lastTx.memo && lastTx.memo.includes('실병'));
            status = isFull ? '실병' : '공병';
            currentHolderId = '삼덕공장';
        } else if (lastTx.type === '충전시작') {
            status = '충전중';
            currentHolderId = '삼덕공장';
        } else if (lastTx.type === '충전완료') {
            status = '실병';
            currentHolderId = '삼덕공장';
        } else if (lastTx.type === '검사출고') {
            status = '검사중';
            currentHolderId = 'INSPECTION_AGENCY';
        } else if (lastTx.type === '검사입고') {
            status = '공병';
            currentHolderId = '삼덕공장';
        } else if (lastTx.type === '폐기') { // Fallback if isScrapped check above missed (redundant but safe)
            status = '폐기';
            currentHolderId = '폐기';
        }
    } else {
        // If no history, ensure defaults are sane
        if (!status) status = '공병';
        if (!currentHolderId) currentHolderId = '삼덕공장';
    }

    return { status, currentHolderId: currentHolderId.trim() };
}
