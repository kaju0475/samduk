import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
    // 1. 보안 검사 (Secret Key 확인)
    const authHeader = request.headers.get('authorization');
    const cronSecretHeader = request.headers.get('x-cron-auth');
    const querySecret = request.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'production' && expectedSecret) {
        const isAuthorized = 
            (authHeader === `Bearer ${expectedSecret}`) || 
            (cronSecretHeader === expectedSecret) || 
            (querySecret === expectedSecret);

        if (!isAuthorized) {
            console.error('[Backup] Auth Failed:', {
                hasAuthHeader: !!authHeader,
                hasCronHeader: !!cronSecretHeader,
                hasQuerySecret: !!querySecret,
                match: false
            });
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
// console.log('[Backup] Starting streaming backup...');

        // 2. [STREAMING ARCHITECTURE]
        // Bypass Vercel 4.5MB Body Limit by streaming the response.
        // We manually construct the JSON string and push it to the stream.

        const encoder = new TextEncoder();
        
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // A. Start JSON
                    const metadata = {
                        timestamp: new Date().toISOString(),
                        version: '4.0 (Auth Unified)',
                        environment: process.env.NODE_ENV
                    };
                    controller.enqueue(encoder.encode(`{"metadata":${JSON.stringify(metadata)},"data":{`));

                    // B. Fetch & Stream Sections Helper
                    const streamSection = async (key: string, table: string, mapper?: (item: any) => any) => {
                        try {
                            controller.enqueue(encoder.encode(`"${key}":[`));
                            
                            const { supabase } = await import('@/lib/supabase');
                            
                            // Check if table exists by fetching 1 row
                            // If table missing, Supabase usually throws immediately on first fetch
                        
                            // [OPTIMIZATION] Increase Batch Size to 10,000
                            // 30k records = 3 requests (vs 30 requests with 1000).
                            // This dramatically reduces Network RTT (Round Trip Time) impact.
                            // Memory impact: 10k * 0.5KB = ~5MB per batch (Safe).
                            const BATCH_SIZE = 10000;
                            let offset = 0;
                            let hasMore = true;
                            let firstItem = true;

                            while (hasMore) {
                                const { data, error } = await supabase
                                    .from(table)
                                    .select('*')
                                    .range(offset, offset + BATCH_SIZE - 1);
                                
                                if (error) {
                                    // Ignore missing table error
                                    if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
                                        console.warn(`[Backup] Table '${table}' missing. Skipping.`);
                                        break;
                                    }
                                    throw error;
                                }
                                
                                if (!data || data.length === 0) {
                                    hasMore = false;
                                    break;
                                }

                                for (const item of data) {
                                    const finalItem = mapper ? mapper(item) : item;
                                    if (!firstItem) controller.enqueue(encoder.encode(','));
                                    controller.enqueue(encoder.encode(JSON.stringify(finalItem)));
                                    firstItem = false;
                                }

                                offset += BATCH_SIZE;
                                if (data.length < BATCH_SIZE) hasMore = false;
                            }
                            
                            controller.enqueue(encoder.encode(`]`));
                        } catch (e) {
                            console.error(`[Backup] Error streaming ${table}:`, e);
                            // Close usage array if error occurred mid-stream to maintain valid JSON
                            // But since we are inside "key":[ ... ], if we crash here, the JSON is malformed.
                            // The best we can do is try to close the array if not closed.
                            // Ideally, we catch before opening or handle specifically.
                            // For now, we trust the inner loop catch for PGRST205.
                            // If unexpected error, we rethrow to fail the backup (better than corrupt data).
                            throw e;
                        }
                    };

                    // C. Stream Each Table (Sequential to save DB connection pool)
                    // 1. Users
                    await streamSection('users', 'users');
                    controller.enqueue(encoder.encode(`,`));

                    // 2. Customers (Mapped)
                    await streamSection('customers', 'customers', (c) => ({
                        id: c.id, name: c.name, phone: c.phone || '', address: c.address || '',
                        representative: c.manager || '', tanks: c.tanks || [], balance: c.balance || 0,
                        type: c.type || 'General', paymentType: c.payment_type || 'Monthly', isDeleted: c.is_deleted || false
                    }));
                    controller.enqueue(encoder.encode(`,`));

                    // 3. Cylinders (Mapped) - THE BIG ONE
                    await streamSection('cylinders', 'cylinders', (c) => ({
                        id: c.id, serialNumber: c.serial_number || c.serialNumber || '',
                        gasType: c.gas_type || c.gasType || 'Oxygen', status: c.status || 'Unknown',
                        currentHolderId: c.location || '삼덕공장', owner: c.owner || 'SAMDUK',
                        chargingExpiryDate: c.charging_expiry_date || null, lastInspectionDate: c.last_inspection_date || null,
                        capacity: c.capacity || '40L', containerType: c.container_type || 'General',
                        isDeleted: c.is_deleted || false, workId: c.work_id || null
                    }));
                    controller.enqueue(encoder.encode(`,`));

                    // 4. Transactions (Mapped) - ALSO BIG
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
                    
                    // 7. Config (Single)
                    const { supabase } = await import('@/lib/supabase');
                    const { data: sysConfig } = await supabase.from('system_config').select('*').single();
                    controller.enqueue(encoder.encode(`"systemConfig":${JSON.stringify(sysConfig || { backupSchedule: '0 * * * *' })}`));
                    controller.enqueue(encoder.encode(`,`));

                    // 8. Company Settings (Static)
                    const companySettings = { companyName: '삼덕가스공업(주)', aliases: ['삼덕', 'SDG', '삼덕가스'] };
                    controller.enqueue(encoder.encode(`"companySettings":${JSON.stringify(companySettings)}`));

                    // END JSON
                    controller.enqueue(encoder.encode(`}}`));
                    controller.close();

                } catch (e) {
                    console.error('[Backup] Stream Error:', e);
                    controller.error(e);
                }
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'application/json',
                'Transfer-Encoding': 'chunked'
            }
        });

    } catch (error) {
        console.error('[Backup] Critical Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }

}

// POST handler (for manual triggers if needed)
export async function POST(request: NextRequest) {
    return GET(request);
}
