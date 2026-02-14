
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
// import { supabase } from '@/lib/supabase';
import { UserRole } from '@/lib/types';
import { hashPassword } from '@/app/lib/auth/password';

export const dynamic = 'force-dynamic';

type UserUpdatePayload = {
    password?: string;
    username?: string;
    name?: string;
    role?: UserRole;
};

export async function GET() {
  try {
    const { data: users, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, data: users || [] });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, message: '사용자 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, name, role, password } = body;

    if (!username || !name || !role || !password) {
        return NextResponse.json({ success: false, message: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    // Check duplicate
    const { data: existing } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    
    if (existing) {
        return NextResponse.json({ success: false, message: '이미 존재하는 사용자명(ID)입니다.' }, { status: 400 });
    }

    const newUser = {
        id: `USER-${Date.now()}`,
        username,
        name,
        role: role as UserRole,
        password: await hashPassword(password),
        created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('users').insert(newUser);
    if (error) throw error;

    return NextResponse.json({ success: true, message: '사용자가 등록되었습니다.', data: newUser });

  } catch (error) {
    console.error('Error adding user:', error);
    return NextResponse.json({ success: false, message: '사용자 추가에 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, password, ...updates } = body;

        if (!id) return NextResponse.json({ success: false, message: '사용자 ID가 필요합니다.' }, { status: 400 });

        const payload: UserUpdatePayload = { ...updates };
        if (password && password.trim() !== '') {
            payload.password = await hashPassword(password);
        }

        const { error } = await supabase.from('users').update(payload).eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true, message: '사용자 정보가 수정되었습니다.' });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, message: '사용자 수정에 실패했습니다.' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idsParam = searchParams.get('ids') || searchParams.get('id');

        if (!idsParam) return NextResponse.json({ success: false, message: '사용자 ID가 필요합니다.' }, { status: 400 });

        const ids = idsParam.split(',');

        const { error } = await supabase.from('users').delete().in('id', ids);
        if (error) throw error;

        return NextResponse.json({ success: true, message: `${ids.length}명의 사용자가 삭제되었습니다.` });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, message: '사용자 삭제에 실패했습니다.' }, { status: 500 });
    }
}

