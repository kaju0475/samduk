import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: '로그아웃 되었습니다.' });
  
  // Clear the user cookie
  response.cookies.set('user', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  });
  
  // Set cache control headers to prevent back button access
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}
