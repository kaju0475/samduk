
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://gedsuetwuxqrrboqobdj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ANpZi22_0n41XQ_PsrspJg_u2hZFyf7';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) {
    console.log(msg);
    fs.appendFileSync('streaming_simulation_log.txt', msg + '\n');
}

async function simulateStreaming() {
    fs.writeFileSync('streaming_simulation_log.txt', '');
    const outputFile = 'streaming_backup_test.json';
    const writeStream = fs.createWriteStream(outputFile);

    log('🚀 [Simulation] Starting Streaming Logic Test...');

    try {
        // Mock Controller
        const controller = {
            enqueue: (chunk) => {
                // Chunk is Uint8Array (from TextEncoder), write to file
                writeStream.write(chunk);
            },
            close: () => {
                writeStream.end();
                log('   ✅ Stream Closed.');
            },
            error: (e) => {
                log('   ❌ Stream Error: ' + e);
                writeStream.end();
            }
        };

        const encoder = new TextEncoder();

        // LOGIC FROM ROUTE.TS (REPLICATED EXACTLY)
        // A. Start JSON
        const metadata = {
            timestamp: new Date().toISOString(),
            version: '3.0 (Streaming Simulation)',
            environment: 'simulation'
        };
        controller.enqueue(encoder.encode(`{"metadata":${JSON.stringify(metadata)},"data":{`));

        // B. Helper
        const streamSection = async (key, table, mapper) => {
            controller.enqueue(encoder.encode(`"${key}":[`));
            
            // Fetch in batches of 1000
            const BATCH_SIZE = 1000;
            let offset = 0;
            let hasMore = true;
            let firstItem = true;
            let totalCount = 0;

            while (hasMore) {
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .range(offset, offset + BATCH_SIZE - 1);
                
                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const item of data) {
                    const finalItem = mapper ? mapper(item) : item;
                    if (!firstItem) controller.enqueue(encoder.encode(','));
                    controller.enqueue(encoder.encode(JSON.stringify(finalItem)));
                    firstItem = false;
                    totalCount++;
                }

                offset += BATCH_SIZE;
                if (data.length < BATCH_SIZE) hasMore = false;
            }
            
            controller.enqueue(encoder.encode(`]`));
            log(`   📦 Streamed ${table}: ${totalCount} records`);
        };

        // C. Stream Sections
        // 1. Users
        await streamSection('users', 'users');
        controller.enqueue(encoder.encode(`,`));

        // 2. Customers
        await streamSection('customers', 'customers', (c) => ({
             id: c.id, name: c.name, phone: c.phone || '', address: c.address || '',
             representative: c.manager || '', tanks: c.tanks || [], balance: c.balance || 0,
             type: c.type || 'General', paymentType: c.payment_type || 'Monthly', isDeleted: c.is_deleted || false
        }));
        controller.enqueue(encoder.encode(`,`));

        // 3. Cylinders
        await streamSection('cylinders', 'cylinders', (c) => ({
             id: c.id, serialNumber: c.serial_number || c.serialNumber || '',
             gasType: c.gas_type || c.gasType || 'Oxygen', status: c.status || 'Unknown',
             currentHolderId: c.location || '삼덕공장', owner: c.owner || 'SAMDUK',
             chargingExpiryDate: c.charging_expiry_date || null, lastInspectionDate: c.last_inspection_date || null,
             capacity: c.capacity || '40L', containerType: c.container_type || 'General',
             isDeleted: c.is_deleted || false, workId: c.work_id || null
        }));
        controller.enqueue(encoder.encode(`,`));

        // 4. Transactions
        await streamSection('transactions', 'transactions', (t) => ({
             id: t.id, timestamp: t.date || t.timestamp || new Date().toISOString(),
             type: t.type, cylinderId: t.cylinderId,
             customerId: t.customerId || '삼덕공장', workerId: t.workerId || 'SYSTEM', isManual: t.is_manual || false
        }));
        controller.enqueue(encoder.encode(`,`));

        // 5. Gas Items
        await streamSection('gasItems', 'gas_items');
        controller.enqueue(encoder.encode(`,`));

        // 6. Ledger Notes
        await streamSection('dailyLedgerNotes', 'daily_ledger_notes');
        controller.enqueue(encoder.encode(`,`));

        // 7. Config
        const { data: sysConfig } = await supabase.from('system_config').select('*').single();
        controller.enqueue(encoder.encode(`"systemConfig":${JSON.stringify(sysConfig || { backupSchedule: '0 * * * *' })}`));
        controller.enqueue(encoder.encode(`,`));

        // 8. Company Settings
        const companySettings = { companyName: '삼덕가스공업(주)', aliases: ['삼덕', 'SDG', '삼덕가스'] };
        controller.enqueue(encoder.encode(`"companySettings":${JSON.stringify(companySettings)}`));

        // End
        controller.enqueue(encoder.encode(`}}`));
        controller.close();

        // VALIDATION
        writeStream.on('finish', () => {
            log('   🔍 Validating JSON Structure...');
            try {
                const content = fs.readFileSync(outputFile, 'utf8');
                JSON.parse(content);
                log('   ✅ JSON is VALID. Streaming Logic is Perfect.');
                
                const stats = fs.statSync(outputFile);
                log(`   scales: Final Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (e) {
                log('   ❌ JSON Validation Failed: ' + e.message);
            }
        });

    } catch (e) {
        log('   ❌ Simulation Error: ' + JSON.stringify(e, null, 2));
        if (controller.error) controller.error(e);
    }
}

simulateStreaming();
