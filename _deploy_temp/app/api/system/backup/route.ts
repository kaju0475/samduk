
import { NextResponse } from 'next/server';
import { performDualBackup, listGitHubBackups } from '@/app/lib/system/backup';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await performDualBackup();
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { backups, status } = await listGitHubBackups();
    return NextResponse.json({ backups, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
