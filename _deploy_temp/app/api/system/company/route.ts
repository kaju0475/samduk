import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'company')
            .single();

        if (error) {
            console.warn('[System/Company] Settings not found, using default.', error.message);
            // Default Fallback
            return NextResponse.json({ 
                success: true, 
                data: {
                    companyName: '삼덕가스공업(주)',
                    aliases: ['삼덕', 'SDG', '삼덕가스']
                } 
            });
        }

        return NextResponse.json({ success: true, data: data.value });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Failed to load settings' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { companyName, aliases } = body;

        if (!companyName || !Array.isArray(aliases)) {
             return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
        }

        // Upsert to Supabase
        const { error } = await supabase
            .from('settings')
            .upsert({ 
                key: 'company', 
                value: { companyName, aliases },
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('[System/Company] Save Error:', error);
            throw error;
        }

        return NextResponse.json({ success: true, message: 'Settings saved' });
    } catch (error) {
        console.error('[System/Company] POST Error:', error);
        return NextResponse.json({ success: false, message: 'Failed to save settings' }, { status: 500 });
    }
}
