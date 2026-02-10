import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const today = new Date();
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(today.getDate() + 30);

        // 1. Parallel Request (Fetch only needed columns to save bandwidth)
        const { data: cylinders, error: cylErr } = await supabase
            .from('cylinders')
            .select('status, location, container_type, charging_expiry_date');
        
        if (cylErr) throw cylErr;

        const totalCylinders = cylinders.length;
        const totalRacks = cylinders.filter((c: any) => c.container_type === 'RACK').length;

        // 2. Location Based (Factory vs Partner)
        const atFactoryCount = cylinders.filter((c: any) => 
            (c.location === '삼덕공장' || c.location === 'SAMDUK') && 
            (c.status !== '분실' && c.status !== '불량' && c.status !== '폐기')
        ).length;

        // 3. Status Based
        const lostCount = cylinders.filter((c: any) => 
            c.status === '분실' || c.status === '불량' || c.status === '폐기'
        ).length;

        const atPartnerCount = Math.max(0, totalCylinders - atFactoryCount - lostCount);

        // 4. Inspection Alert
        const needsInspectionCount = cylinders.filter((c: any) => {
            if (c.status === '분실' || c.status === '불량' || c.status === '폐기') return false;
            if (!c.charging_expiry_date) return true; // Treat null as urgent
            const expiry = new Date(c.charging_expiry_date);
            return expiry <= thirtyDaysLater;
        }).length;

        // 5. Today's Delivery (Real-time Transaction Count)
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const { count: todayDelivery, error: txErr } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('type', '납품')
            .gte('date', startOfToday.toISOString());

        if (txErr) console.error('Today Delivery Count Error:', txErr);

        return NextResponse.json({
            totalCylinders: totalCylinders,
            totalRacks: totalRacks,
            atPartner: atPartnerCount,
            atFactory: atFactoryCount,
            needsInspection: needsInspectionCount,
            lostCount: lostCount,
            todayDelivery: todayDelivery || 0
        });

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard stats' },
            { status: 500 }
        );
    }
}
