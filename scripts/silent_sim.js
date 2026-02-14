
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Status File Helper
const STATUS_FILE = path.join(process.cwd(), 'logs', 'sim_silent_status.txt');
function logStatus(msg) {
    // Append to file, No Console Output
    try {
        fs.appendFileSync(STATUS_FILE, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) { /* Ignore file write errors to prevent crash */ }
}

try {
    // Initialize Status File
    if (!fs.existsSync(path.join(process.cwd(), 'logs'))) fs.mkdirSync(path.join(process.cwd(), 'logs'));
    fs.writeFileSync(STATUS_FILE, "STARTED: Simulation Initialized\n");

    // Load Env
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
        logStatus("FAILURE: .env.local not found");
        process.exit(1);
    }
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // Helpers
    function toCustomerDB(c) {
        return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            manager: c.representative,
            business_number: c.businessNumber,
            ledger_number: c.ledgerNumber,
            type: c.type,
            payment_type: c.paymentType,
            created_at: c.created_at
        };
    }

    function toCylinderDB(c) {
        return {
            id: c.id,
            serial_number: c.serialNumber,
            gas_type: c.gasType,
            status: c.status,
            location: c.currentHolderId,
            ownership: c.owner || 'SAMDUK',
            owner_id: (c.owner === '자사' || c.owner === 'SAMDUK') ? 'SAMDUK' : ('EXTERNAL'),
            capacity: c.capacity,
            volume: c.capacity,
            charging_expiry_date: c.chargingExpiryDate,
            container_type: 'CYLINDER'
        };
    }

    function toTransactionDB(t) {
        const now = t.timestamp || new Date().toISOString();
        return {
            id: t.id || uuidv4(),
            type: t.type,
            cylinderId: t.cylinderId,
            workerId: t.workerId,
            customerId: t.customerId,
            created_at: now,
            date: now
        };
    }

    async function batchInsert(table, items) {
        const batchSize = 25;
        for (let i = 0; i < items.length; i += batchSize) {
            const chunk = items.slice(i, i + batchSize);
            const { error } = await supabase.from(table).insert(chunk);
            if (error) {
                logStatus(`ERROR: Batch ${Math.floor(i/batchSize)+1} Failed - ${error.message}`);
            } else {
                logStatus(`PROGRESS: ${table} Batch ${Math.floor(i/batchSize)+1} OK`);
            }
            // 200ms Delay to stay cool
            await new Promise(r => setTimeout(r, 200));
        }
    }

    async function run() {
        const ITERATIONS = 100;
        
        // Cleanup
        logStatus("PHASE 0: Cleanup...");
        await supabase.from('customers').delete().like('id', 'SIM-CUS-%');
        await supabase.from('cylinders').delete().like('serial_number', 'SIM-CYL-%');
        await supabase.from('transactions').delete().eq('workerId', 'WORKER-SIM');

        // Customers
        logStatus("PHASE 1: Preparing Customers...");
        const cus = [];
        const ids = [];
        for(let i=0; i<ITERATIONS; i++) {
            const id = `SIM-CUS-${Date.now()}-${i}`;
            cus.push(toCustomerDB({
                id, name: `SimCus ${i}`, phone: '000', address: 'Sim', representative: 'SimMgr',
                businessNumber: `000-${i}`, ledgerNumber: `L${i}`, type: 'BUSINESS', paymentType: 'card', created_at: new Date().toISOString()
            }));
            ids.push(id);
        }
        await batchInsert('customers', cus);

        // Cylinders
        logStatus("PHASE 2: Preparing Cylinders...");
        const cyl = [];
        const serials = [];
        for(let i=0; i<ITERATIONS; i++) {
            const sn = `SIM-CYL-${i}`;
            cyl.push(toCylinderDB({
                id: uuidv4(), serialNumber: sn, gasType: 'O2', status: '공병', currentHolderId: '삼덕공장', owner: '삼덕공장',
                capacity: '40L', chargingExpiryDate: '2030-12-31'
            }));
            serials.push(sn);
        }
        await batchInsert('cylinders', cyl);

        // Transactions
        logStatus("PHASE 3: Preparing Transactions...");
        const tx = [];
        for(let i=0; i<ITERATIONS; i++) {
            tx.push(toTransactionDB({
                type: '납품', cylinderId: serials[i], workerId: 'WORKER-SIM', customerId: ids[i]
            }));
        }
        await batchInsert('transactions', tx);

        // Verify
        logStatus("PHASE 4: Verification...");
        const { data: vCus } = await supabase.from('customers').select('id').in('id', ids.slice(0,5));
        const { data: vTx } = await supabase.from('transactions').select('id').in('cylinderId', serials.slice(0,5));
        logStatus(`VERIFY: Customers Found ${vCus?.length}/5`);
        logStatus(`VERIFY: Transactions Found ${vTx?.length}/5`);

        // Cleanup
        logStatus("PHASE 5: Final Cleanup...");
        await supabase.from('transactions').delete().eq('workerId', 'WORKER-SIM');
        for (let i=0; i<ids.length; i+=50) await supabase.from('customers').delete().in('id', ids.slice(i, i+50));
        for (let i=0; i<serials.length; i+=50) await supabase.from('cylinders').delete().in('serial_number', serials.slice(i, i+50));

        logStatus("SUCCESS: Simulation Complete");
    }

    run().catch(e => {
        logStatus(`CRITICAL FAILURE: ${e.message}`);
        process.exit(1);
    });

} catch (globalErr) {
    fs.writeFileSync('logs/sim_silent_crash.txt', globalErr.message);
}
