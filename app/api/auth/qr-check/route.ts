import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ success: false, message: 'Code is required' }, { status: 400 });
    }

    try {
        // Direct query to Supabase to avoid hydration race conditions in the DB singleton
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', code)
            .maybeSingle();

        if (user) {
            return NextResponse.json({ 
                success: true, 
                username: user.username,
                password: user.password 
            });
        }

        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    } catch (error) {
        console.error('QR Check Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
