// API 인증 헬퍼 함수
import { cookies } from 'next/headers';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: '관리자' | '사용자';
}

/**
 * API Route에서 사용자 인증 확인
 * @returns 인증된 사용자 정보 또는 null
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    if (!userCookie) {
      return null;
    }

    const user = JSON.parse(userCookie.value) as AuthUser;
    return user;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * 관리자 권한 확인
 * @param user - 사용자 정보
 * @returns 관리자 여부
 */
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === '관리자';
}

/**
 * API Route에서 인증 필수 체크
 * @throws 인증되지 않은 경우 에러
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

/**
 * API Route에서 관리자 권한 필수 체크
 * @throws 권한이 없는 경우 에러
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  
  if (!isAdmin(user)) {
    throw new Error('Admin access required');
  }
  
  return user;
}
