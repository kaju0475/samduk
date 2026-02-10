import { NextResponse } from 'next/server';
import { encryptToken } from '@/app/lib/crypto';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userIds } = body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ success: false, message: 'Invalid User IDs' }, { status: 400 });
        }

        // 1. Verify users exist (Optional but good practice)
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username')
            .in('id', userIds);

        if (error || !users) {
            return NextResponse.json({ success: false, message: 'Users not found' }, { status: 404 });
        }

        // 2. Generate Encrypted Tokens
        const tokens: Record<string, string> = {};
        
        // Log key hash (first 8 chars of MD5) to verify cross-env consistency
        try {
            await import('@/app/lib/crypto'); // Just to trigger logging
        } catch {}

        users.forEach(user => {
            // [CRITICAL: Immutability] Use internal 'user.id' as the ONLY payload.
            // Usernames can be edited by admins, which would change the QR image.
            // Internal IDs are permanent until deletion, satisfying the "Fixed Unique Image" requirement.
            const payload = user.id; 
            const encrypted = encryptToken(payload);
            
            // Format: ENC-[Base64String]
            tokens[user.id] = `ENC-${encrypted}`;
        });

        return NextResponse.json({ success: true, tokens });

    } catch (error) {
        console.error('Token Generation Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
