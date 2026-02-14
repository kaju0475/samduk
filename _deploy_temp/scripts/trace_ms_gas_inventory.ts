const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    'https://gedsuetwuxqrrboqobdj.supabase.co', 
    'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7'
);

// Mock the exact logic from app/utils/cylinder.ts
function deriveCylinderState(cylinder, transactions) {
    console.log(`\n[Logic Trace] Deriving state for ${cylinder.serialNumber}`);
    
    // 1. Filter
    const relevantTxs = transactions
        .filter(t => {
            const match = t.cylinderId && t.cylinderId.toLowerCase() === cylinder.serialNumber.toLowerCase();
            if (!match && t.cylinderId?.includes('TEST')) console.log(`   - Mismatch: '${t.cylinderId}' vs '${cylinder.serialNumber}'`);
            return match;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log(`   - Found ${relevantTxs.length} relevant transactions.`);
    if (relevantTxs.length > 0) {
        console.log(`   - Latest Tx: Type=${relevantTxs[0].type}, Customer=${relevantTxs[0].customerId}, Date=${relevantTxs[0].created_at}`);
    }

    const lastTx = relevantTxs[0];
    let currentHolderId = cylinder.current_holder_id || '삼덕공장'; // DB Value

    if (lastTx) {
        if (lastTx.type === '납품') {
            currentHolderId = lastTx.customerId || '미확인';
            console.log(`   - Logic: Delivery -> Holder set to ${currentHolderId}`);
        } else if (['회수', '충전시작', '충전완료'].includes(lastTx.type)) {
            currentHolderId = '삼덕공장';
            console.log(`   - Logic: Return/Charging -> Holder set to Factory`);
        }
    } else {
        console.log(`   - No History. Using DB Default: ${currentHolderId}`);
    }
    
    return currentHolderId;
}

async function trace() {
    const output = [];
    const log = (msg) => { console.log(msg); output.push(msg); };

    const targetId = 'C1768578467547-s1up7'; // MS Gas
    log(`Target Customer ID: ${targetId}`);

    // 1. Find Transactions for this customer
    const { data: txs } = await supabase.from('transactions')
        .select('*')
        .eq('customerId', targetId)
        .order('created_at', { ascending: false })
        .limit(5);

    log(`Transactions found for MS Gas: ${txs?.length}`);
    
    if (!txs || txs.length === 0) {
        log('No transactions found. This is the root cause?');
        // Check if transactions exist with whitespace?
        return;
    }

    // 2. Pick the first cylinder from transactions
    const sampleTx = txs[0];
    const sampleSerial = sampleTx.cylinderId;
    log(`Tracing specific cylinder from Tx: ${sampleSerial}`);

    // 3. Fetch Cylinder
    const { data: cyls } = await supabase.from('cylinders')
        .select('*')
        .ilike('serial_number', sampleSerial); // Case insensitive fetch

    if (!cyls || cyls.length === 0) {
        log(`Cylinder ${sampleSerial} NOT FOUND in cylinders table.`);
        return;
    }
    const cylinder = cyls[0];
    log(`Cylinder Found: ID=${cylinder.id}, Serial=${cylinder.serial_number}`);

    // 4. Fetch ALL transactions for this cylinder (to simulate full replay)
    const { data: allTxs } = await supabase.from('transactions')
        .select('*')
        .eq('cylinderId', cylinder.serial_number); // Exact match first

    // 5. Run Logic
    const derivedHolder = deriveCylinderState(
        { serialNumber: cylinder.serial_number, current_holder_id: cylinder.current_holder_id }, 
        allTxs || []
    );

    log(`\nFinal Derived Holder: ${derivedHolder}`);
    log(`Equal to Target? ${derivedHolder === targetId}`);

    fs.writeFileSync('trace_output.txt', output.join('\n'));
}

trace();
