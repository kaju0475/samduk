import { NextResponse } from 'next/server';
import { db } from '@/lib/db';  // Fixed: Use named import (db.ts has no default export)

/**
 * API 오류 처리 유틸리티
 * 모든 API에서 일관된 오류 응답 제공
 */
export function handleApiError(error: unknown, context: string) {
  console.error(`[${context}] Error:`, error);
  
  // 에러 타입별 처리
  if (error instanceof Error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Server Internal Error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { success: false, message: 'Server Internal Error' }, 
    { status: 500 }
  );
}

/**
 * DB reload를 자동으로 수행하는 API 핸들러 래퍼
 * 
 * @example
 * ```typescript
 * export const GET = withDbReload('Dashboard Stats', async (request) => {
 *   const stats = calculateStats();
 *   return NextResponse.json({ success: true, data: stats });
 * });
 * ```
 */
export function withDbReload<T extends unknown[]>(
  context: string,
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      db.reload();
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, context);
    }
  };
}

/**
 * API 응답 헬퍼 - 성공
 */
export function apiSuccess<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

/**
 * API 응답 헬퍼 - 실패
 */
export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

/**
 * 인증 검증 유틸리티
 */
export function validateWorkerId(workerId: string | null | undefined): string | null {
  if (!workerId || workerId === 'WORKER-DEFAULT') {
    return null;
  }
  return workerId;
}
