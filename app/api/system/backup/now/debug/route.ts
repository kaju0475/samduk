import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    const expectedSecret = process.env.CRON_SECRET;
    
    // 1. 보안 체크 결과
    const authResult = {
        hasHeader: !!authHeader,
        headerStart: authHeader?.substring(0, 10),
        secretConfigured: !!expectedSecret,
        match: authHeader === `Bearer ${expectedSecret}`
    };

    // 2. 환경 체크
    const envResult = {
        nodeEnv: process.env.NODE_ENV,
        hasStorage: !!process.env.SUPABASE_URL,
        tmpWritable: false
    };

    try {
        fs.writeFileSync('/tmp/test.txt', 'web write test');
        envResult.tmpWritable = true;
    } catch (e) {}

    return NextResponse.json({
        status: 'debug_info',
        auth: authResult,
        env: envResult,
        message: "이 화면을 찍어서 저에게 보여주세요!"
    });
}
