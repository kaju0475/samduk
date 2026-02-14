import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyPassword } from '@/app/lib/auth/password';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, password } = body;

    // [FIX] Support Login by ID (Case-insensitive) OR Name
    // Using Supabase Client (Correct for Production)
    // [FIX] Support Login by ID (Any format: UUID/Legacy), Username, or Name
    const queryFilter = `username.ilike.${id},name.eq.${id},id.eq.${id}`;
    
    const { data: user } = await supabase
        .from('users')
        .select('*')
        .or(queryFilter)
        .maybeSingle();
    
    if (user) {
        // Verify Password
        const isValid = await verifyPassword(password, user.password);
        
        if (isValid) {
             // Return user info (exclude password for safety)
            const userInfo = { ...user };
            delete userInfo.password;
            
            // [CRITICAL] Set cookie for middleware authentication
            const response = NextResponse.json({ success: true, user: userInfo });
            response.cookies.set('user', JSON.stringify(userInfo), {
              httpOnly: false, // Allow client-side access
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            });
            
            return response;
        }
    }

    // Fallback for invalid user or password
    return NextResponse.json({ success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });

  } catch (err) {
    console.error('Login Error:', err);
    return NextResponse.json({ success: false, message: '서버 오류' }, { status: 500 });
  }
}
