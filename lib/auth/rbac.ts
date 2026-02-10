/**
 * RBAC (Role-Based Access Control) System
 * 역할 기반 접근 제어 시스템
 */

export const ROLE_PERMISSIONS = {
    ADMIN: ['*'], // 모든 권한
    MANAGER: [
        'read:*',
        'write:work',
        'write:master',
        'read:reports',
        'write:system'
    ],
    WORKER: [
        'read:work',
        'write:work',
        'read:master'
    ],
    VIEWER: [
        'read:*'
    ]
} as const;

export type UserRole = keyof typeof ROLE_PERMISSIONS;
export type Permission = string;

/**
 * 역할에 권한이 있는지 확인
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    
    // 전체 권한 체크
    if (permissions.includes('*')) return true;
    
    // 정확한 권한 체크
    if (permissions.includes(permission)) return true;
    
    // 와일드카드 권한 체크 (예: read:*)
    const [action] = permission.split(':');
    if (permissions.includes(`${action}:*`)) return true;
    
    return false;
}

/**
 * API 경로에서 필요한 권한 추출
 */
export function getRequiredPermission(pathname: string): Permission | null {
    // Admin APIs
    if (pathname.startsWith('/api/admin/')) {
        // 일부 admin API는 읽기 전용
        if (pathname.includes('/reports/') || pathname.includes('/stats')) {
            return 'read:admin';
        }
        return 'write:admin';
    }
    
    // System APIs
    if (pathname.startsWith('/api/system/')) {
        if (pathname.includes('/reports/')) {
            return 'read:reports';
        }
        return 'write:system';
    }
    
    // Work APIs
    if (pathname.startsWith('/api/work/')) {
        return 'write:work';
    }
    
    // Master Data APIs
    if (pathname.startsWith('/api/master/')) {
        if (pathname.includes('/search') || pathname.includes('/list')) {
            return 'read:master';
        }
        return 'write:master';
    }
    
    // Dashboard APIs
    if (pathname.startsWith('/api/dashboard/')) {
        return 'read:dashboard';
    }
    
    return null;
}

/**
 * 역할 한글명 매핑
 */
export const ROLE_NAMES: Record<UserRole, string> = {
    ADMIN: '관리자',
    MANAGER: '매니저',
    WORKER: '작업자',
    VIEWER: '조회자'
};

/**
 * 한글 역할명을 영문 역할로 변환
 */
export function normalizeRole(role: string): UserRole {
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
