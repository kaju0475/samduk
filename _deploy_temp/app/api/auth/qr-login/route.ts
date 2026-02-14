import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decryptToken } from '@/app/lib/crypto';

export const dynamic = 'force-dynamic';

// [Security] Use Service Role Key to bypass RLS for Authentication
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = serviceRoleKey 
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }) 
    : supabase; // Fallback (warning: will fail RLS)

if (!serviceRoleKey) {
    console.warn('[QR Login] Missing SUPABASE_SERVICE_ROLE_KEY. RLS might block user lookup.');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    let targetUsername = '';

    if (!token) {
        return NextResponse.json({ success: false, message: 'Invalid Request', errorCode: 'ERR_NO_TOKEN' }, { status: 400 });
    }

    // [Method 2] Encrypted QR Token
    if (token.startsWith('ENC-')) {
        try {
            const encryptedPart = token.replace('ENC-', '');
            const decryptedString = decryptToken(encryptedPart);
            
            if (!decryptedString) {
                return NextResponse.json({ success: false, message: 'Invalid QR Token', errorCode: 'ERR_DECRYPT_EMPTY' }, { status: 401 });
            }

            targetUsername = decryptedString;
            
            if (!targetUsername || targetUsername.length < 2) {
                 return NextResponse.json({ success: false, message: 'Invalid QR Payload', errorCode: 'ERR_PAYLOAD_INVALID' }, { status: 401 });
            }

// console.log('[QR Login] Encrypted Token Decrypted → ID:', targetUsername);

        } catch (e: any) {
            console.error('[QR Login] Decryption Failed:', e);
            return NextResponse.json({ success: false, message: 'Invalid Token', errorCode: 'ERR_TOKEN_INVALID' }, { status: 401 });
        }
    } 
    // [Legacy/Fallback]
    else if (token.startsWith('TOKEN-')) {
        targetUsername = token.replace('TOKEN-', '').toLowerCase();
    } else if (token.startsWith('USER-')) {
        targetUsername = token.replace('USER-', '');
    } else {
        targetUsername = token;
    }

    // [Fix] Flexible ID Search: Check BOTH raw ID and USER- prefixed ID
    // This handles cases where the QR token might be missing the prefix (older versions/migrations)
    // or the DB has the prefix but the token logic stripped it.
    const possibleIds = [targetUsername];
    if (!targetUsername.startsWith('USER-')) {
        possibleIds.push(`USER-${targetUsername}`);
    }

    // Construct OR clause: username=T OR name=T OR id=T OR id=USER-T
    const orConditions = [
        `username.ilike.${targetUsername}`,
        `name.eq.${targetUsername}`,
        ...possibleIds.map(id => `id.eq.${id}`)
    ].join(',');
    
    // [Fix] Use adminClient to ensure we can find the user regardless of RLS
    const { data: user } = await adminClient
        .from('users')
        .select('*')
        .or(orConditions)
        .maybeSingle();

    if (user) {
        // Return user info (exclude password)
        const userInfo = { ...user };
        delete userInfo.password;
        
        const response = NextResponse.json({ success: true, user: userInfo });
        response.cookies.set('user', JSON.stringify(userInfo), {
            httpOnly: false, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });
        return response;
    } else {
        return NextResponse.json({ 
            success: false, 
            message: '유효하지 않은 QR 코드입니다.', 
            errorCode: 'ERR_USER_NOT_FOUND',
            debugId: targetUsername // Optional: Return what we tried to find (if safe)
        }, { status: 401 });
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Error';
    console.error('QR Login Error:', error);
    return NextResponse.json({ success: false, message: '서버 오류', errorCode: 'ERR_INTERNAL', debug: errorMessage }, { status: 500 });
  }
}
