import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';

export const dynamic = 'force-dynamic';


export async function GET() {
    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        const mapped = TransactionValidator.sanitizeCustomers(customers || []);

        return NextResponse.json(
            { success: true, data: mapped },
            { 
                headers: { 
                    'Cache-Control': 'no-store, no-cache',
                    'Pragma': 'no-cache'
                } 
            }
        );
    } catch (e) {
        console.error('Customer Fetch Error:', e);
        return NextResponse.json({ success: false, message: 'Failed to fetch customers' }, { status: 500 });
    }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, representative, phone, address, businessNumber, ledgerNumber, type, paymentType } = body;

    if (!name) {
        return NextResponse.json({ success: false, message: '상호명은 필수입니다.' }, { status: 400 });
    }

    const { data: existing } = await supabase.from('customers')
        .select('id, name')
        .eq('name', name)
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ success: false, message: `이미 등록된 거래처입니다. (상호명 중복: ${name})` }, { status: 409 });
    }

    const newId = `C${Date.now()}`;
    
    // [Unified Mapping] Use TransactionValidator
    const customerObj = {
        id: newId,
        name,
        phone: phone || '',
        address: address || '',
        representative: representative || '', // Handled by Validator (maps to manager)
        businessNumber: businessNumber || '',
        ledgerNumber: ledgerNumber || '',
        type: type || 'BUSINESS',
        paymentType: paymentType || 'card',
        balance: 0,
        createdAt: new Date().toISOString()
    };

    const payload = TransactionValidator.toCustomerDB(customerObj);

    const { error } = await supabase.from('customers').insert(payload);
    if (error) throw error;

    return NextResponse.json({ 
        success: true, 
        message: '거래처가 성공적으로 등록되었습니다.', 
        data: TransactionValidator.sanitizeCustomers([payload])[0]
    });

  } catch (e: unknown) {
    console.error(e);
    const msg = e instanceof Error ? e.message : '등록 실패';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: Record<string, any>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
    }

    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ success: false, message: 'ID가 필요합니다.' }, { status: 400 });

    try {
        // [Unified Mapping] Use TransactionValidator
        // We convert updates (which might be mixed keys) to a Partial<Customer> structure 
        // that Validator recognizes (CamelCase)
        
        const updateObj: Record<string, any> = {};
        if (updates.name) updateObj.name = updates.name;
        if (updates.phone) updateObj.phone = updates.phone;
        if (updates.address) updateObj.address = updates.address;
        
        // Map potential incoming keys to Validator expected keys
        if (updates.representative) updateObj.representative = updates.representative;
        if (updates.manager) updateObj.representative = updates.manager; // Handle both
        
        if (updates.businessNumber) updateObj.businessNumber = updates.businessNumber;
        if (updates.ledgerNumber) updateObj.ledgerNumber = updates.ledgerNumber;
        
        if (updates.type) updateObj.type = updates.type;
        if (updates.paymentType) updateObj.paymentType = updates.paymentType;
        if (updates.corporateId) updateObj.corporateId = updates.corporateId;
        if (updates.fax) updateObj.fax = updates.fax;

        // Convert to DB Payload
        const payload = TransactionValidator.toCustomerDB(updateObj);
        
        // Remove ID from payload to avoid PK update error (though safe usually)
        delete payload.id;

        const { error } = await supabase.from('customers').update(payload).eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true, message: '거래처 정보가 수정되었습니다.' });

    } catch (e: unknown) {
        console.error('Update Error:', e);
        const msg = (e as Error).message || 'Unknown Error';
        return NextResponse.json({ success: false, message: `수정 실패: ${msg}`, error: msg }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idsParam = searchParams.get('ids') || searchParams.get('id');

        if (!idsParam) return NextResponse.json({ success: false, message: 'ID가 필요합니다.' }, { status: 400 });
        const ids = idsParam.split(',');

        const { error } = await supabase.from('customers').delete().in('id', ids);
        if (error) throw error;

        return NextResponse.json({ success: true, message: `${ids.length}개의 거래처가 삭제되었습니다.` });

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '삭제 실패';
        return NextResponse.json({ success: false, message: msg }, { status: 500 });
    }
}
