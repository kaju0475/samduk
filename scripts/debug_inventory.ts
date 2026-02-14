const { createClient } = require('@supabase/supabase-js');
// Mocking the helper for script execution
function deriveCylinderState(cylinder, history) {
    let status = cylinder.status;
    let currentHolderId = cylinder.currentHolderId;

    // Simple replay logic (simplified from actual util)
    if (history && history.length > 0) {
        const lastTx = history[0];
        if (['납품', '충전완료'].includes(lastTx.type) && lastTx.customerId) {
            currentHolderId = lastTx.customerId;
        } else if (['회수', '회수(실병)', '충전시작', '충전', '폐기'].includes(lastTx.type)) {
            currentHolderId = '삼덕공장'; // simplified
        }
    }
    return { status, currentHolderId };
}

const supabase = createClient(
    'https://gedsuetwuxqrrboqobdj.supabase.co', 
    'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7'
);

async function debugInventory() {
    console.log("Starting Debug...");

    // 1. Find MS Gas
    const { data: msGas } = await supabase.from('customers').select('*').ilike('name', '%MS%').limit(5);
    console.log("MS Gas Candidates:", msGas.map(c => ({ id: c.id, name: c.name })));

    // 2. Find Mystery ID
    const mysteryId = 'C1768578467547-s1up7';
    const { data: mysteryCust } = await supabase.from('customers').select('*').eq('id', mysteryId);
    console.log("Mystery ID Customer:", mysteryCust);

    // 3. Find Cylinders with this holder
    const { data: cylinders } = await supabase.from('cylinders').select('id, serial_number, current_holder_id').eq('current_holder_id', mysteryId).limit(5);
    console.log(`Cylinders held by ${mysteryId}:`, cylinders ? cylinders.length : 0);
    if (cylinders && cylinders.length > 0) console.log("Sample:", cylinders[0]);

    // 4. Find Transactions for this holder
    const { data: txs } = await supabase.from('transactions').select('*').eq('customerId', mysteryId).limit(5);
    console.log(`Transactions for ${mysteryId}:`, txs ? txs.length : 0);
}

debugInventory();
