import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ========================================
// RBAC (Role-Based Access Control) 정의
// ========================================

const ROLE_PERMISSIONS = {
    ADMIN: ['*'],
    MANAGER: ['read:*', 'write:work', 'write:master', 'read:reports', 'write:system'],
    WORKER: ['read:work', 'write:work', 'read:master'],
    VIEWER: ['read:*']
} as const;

type UserRole = keyof typeof ROLE_PERMISSIONS;

function normalizeRole(role: string): UserRole {
    const roleMap: Record<string, UserRole> = {
        '관리자': 'ADMIN',
        '매니저': 'MANAGER',
        '작업자': 'WORKER',
        '조회자': 'VIEWER',
        'ADMIN': 'ADMIN',
        'MANAGER': 'MANAGER',
        'WORKER': 'WORKER',
        'VIEWER': 'VIEWER'
    };
    return roleMap[role] || 'VIEWER';
}

function hasPermission(role: UserRole, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    
    if (permissions.includes('*')) return true;
    if (permissions.includes(permission)) return true;
    
    const [action] = permission.split(':');
    if (permissions.includes(`${action}:*` as never)) return true;
    
    return false;
}

function getRequiredPermission(pathname: string): string | null {
    if (pathname.startsWith('/api/admin/')) {
        if (pathname.includes('/reports/') || pathname.includes('/stats')) {
            return 'read:admin';
        }
        return 'write:admin';
    }
    
    if (pathname.startsWith('/api/system/')) {
        if (pathname.includes('/reports/')) {
            return 'read:reports';
        }
        return 'write:system';
    }
    
    if (pathname.startsWith('/api/work/')) {
        return 'write:work';
    }
    
    if (pathname.startsWith('/api/master/')) {
        if (pathname.includes('/search') || pathname.includes('/list')) {
            return 'read:master';
        }
        return 'write:master';
    }
    
    if (pathname.startsWith('/api/dashboard/')) {
        return 'read:dashboard';
    }
    
    return null;
}

// ========================================
// 경로 정의
// ========================================

const protectedPaths = [
  '/dashboard',
  '/work',
  '/master',
  '/system',
  '/admin',
];

const adminOnlyPaths = [
  '/master/users',
  '/system',
  '/admin',
];

const publicApiPaths = [
  '/api/auth/login',
  '/api/auth/qr-login',
  '/api/auth/session',
  '/api/auth/logout',
];

// ========================================
// 미들웨어 메인 로직
// ========================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ========================================
  // 1. API 경로 보호
  // ========================================
  if (pathname.startsWith('/api/')) {
    // [SUPER ROBUST FIX] Allow automated backup to bypass session check
    // The API route itself handles its own secret verification via TransactionValidator
    if (pathname.includes('/system/backup/now')) {
      console.log(`[Middleware] CRON/BACKUP Path Allowed: ${pathname}`);
      return NextResponse.next();
    }

    // 공개 API는 통과 (Whitelisted)
    if (publicApiPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // [ROBUST FIX] Secret Key Master Bypass (for Cron/Automated tasks)
    const cronSecret = request.headers.get('x-cron-auth') || 
                       request.nextUrl.searchParams.get('secret') ||
                       request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (cronSecret && cronSecret === process.env.CRON_SECRET) {
      console.log(`[Middleware] Cron Secret Authorized: ${pathname}`);
      return NextResponse.next();
    }

    // 세션 체크
    const userCookie = request.cookies.get('user');
    
    if (!userCookie) {
      return NextResponse.json(
        { 
          success: false, 
          message: '인증이 필요합니다. 다시 로그인해주세요.',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      );
    }

    try {
      const user = JSON.parse(userCookie.value);
      
      // RBAC 체크
      const requiredPermission = getRequiredPermission(pathname);
      
      if (requiredPermission) {
        const userRole = normalizeRole(user.role);
        
        if (!hasPermission(userRole, requiredPermission)) {
          return NextResponse.json(
            { 
              success: false, 
              message: '이 작업을 수행할 권한이 없습니다.',
              code: 'FORBIDDEN'
            },
            { status: 403 }
          );
        }
      }

      return NextResponse.next();
      
    } catch (error) {
      console.error('[Middleware] API Auth Error:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: '인증 정보가 올바르지 않습니다.',
          code: 'INVALID_SESSION'
        },
        { status: 401 }
      );
    }
  }

  // ========================================
  // 2. 페이지 경로 보호
  // ========================================
  
  if (pathname === '/login' || 
      pathname.startsWith('/auth/') || 
      pathname === '/' || 
      pathname === '/menu') {
    return NextResponse.next();
  }

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  const userCookie = request.cookies.get('user');
  
  if (!userCookie) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  try {
    const user = JSON.parse(userCookie.value);

    const isAdminPath = adminOnlyPaths.some(path => pathname.startsWith(path));
    
    if (isAdminPath && user.role !== '관리자') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('[Middleware] Page Auth Error:', error);
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/work/:path*',
    '/master/:path*',
    '/system/:path*',
    '/admin/:path*',
  ],
};
