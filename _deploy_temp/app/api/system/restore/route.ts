import { NextResponse } from 'next/server';
import { restoreSystem, restoreFromGitHub } from '@/app/lib/system/backup';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, url } = body;

    // 1. Cloud Restore
    if (url) {
        console.log('[API] Starting Cloud Restore from:', url);
        // Pass the token from env if available (secure server-side)
        const token = process.env.GITHUB_TOKEN;
        const result = await restoreFromGitHub(url, token);
        
        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 500 });
        }
        return NextResponse.json(result);
    }

    // 2. Local Restore
    if (!filename) {
      return NextResponse.json({ error: 'Filename or URL is required' }, { status: 400 });
    }

    const result = await restoreSystem(filename);
    
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
