
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Fetch Data (Simulating the Master List Page Logic)
        const { data: cylinders, error } = await supabase.from('cylinders').select('*').ilike('serial_number', 'SD-TEST-%').limit(200);
        
        if (error) throw error;
        if (!cylinders || cylinders.length === 0) {
            return NextResponse.json({ message: 'No data to test' });
        }

        // 2. Prepare Results
        let fullPass = true;
        const results = {
            totalChecked: 0,
            passed: 0,
            failed: 0,
            failures: [] as string[]
        };

        // 3. Test Logic (Mirroring the Frontend/API Logic)
        cylinders.forEach((c: { id: string; ownership: string; location: string; serial_number?: string; memo?: string }) => {
            results.totalChecked++;
            
            // Logic being tested
            const ownerId = c.ownership;
            const locationId = c.location;

            // Resolve Names
            const ownerName = (ownerId === 'SAMDUK' || ownerId === '삼덕공장') ? '삼덕용기' : 'OTHER';
            const locationName = (locationId === 'SAMDUK' || locationId === '삼덕공장') ? '삼덕공장' : 'OTHER';

            // Verification Rules
            let recordPass = true;
            let failReason = '';

            // Rule 1: Owner "Samduk" must be "삼덕용기"
            if ((ownerId === 'SAMDUK' || ownerId === '삼덕공장') && ownerName !== '삼덕용기') {
                recordPass = false;
                failReason += `[Owner Mismatch] ID=${ownerId} -> Name=${ownerName} (Expected: 삼덕용기) `;
            }

            // Rule 2: Location "Samduk" must be "삼덕공장"
            if ((locationId === 'SAMDUK' || locationId === '삼덕공장') && locationName !== '삼덕공장') {
                recordPass = false;
                failReason += `[Location Mismatch] ID=${locationId} -> Name=${locationName} (Expected: 삼덕공장) `;
            }

            // Rule 3: Storage Normalization Check
            if (ownerId === '삼덕가스공업(주)' || ownerId === '삼덕용기') {
                recordPass = false;
                failReason += `[Normalization Failed] Stored ID=${ownerId} (Expected: 삼덕공장) `;
                results.failures.push(`FULL_RECORD: ${JSON.stringify(c)}`); // Debug Dump
            }

            if (recordPass) {
                results.passed++;
            } else {
                results.failed++;
                fullPass = false;
                results.failures.push(`Record ${c.serial_number || c.id}: ${failReason}`);
            }
        });

        // 4. Return Report
        return NextResponse.json({
            success: fullPass,
            report: results,
            message: fullPass 
                ? `SUCCESS: Checked ${results.totalChecked} variables. All display logic is correct.` 
                : `FAILURE: ${results.failed} errors found.`
        });

    } catch (e) {
        return NextResponse.json({ success: false, error: (e as Error).message });
    }
}
