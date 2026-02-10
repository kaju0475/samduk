
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type GasUpdatePayload = {
    name?: string;
    capacity?: string;
    color?: string;
};

export async function GET() {
  try {
    const { data, error } = await supabase.from('gas_items').select('*');
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, data: data || [] });

  } catch (error) {
    console.error('Gas Fetch Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch gas items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, capacity, color } = body;

    if (!name || !capacity) {
        return NextResponse.json({ success: false, message: 'Name and Capacity are required' }, { status: 400 });
    }

    const payload = {
        id: `GAS-${Date.now()}`,
        name,
        capacity,
        color: color || '#228BE6', // Default Blue
    };

    const { error } = await supabase.from('gas_items').insert(payload);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Gas item added', data: payload });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, message: 'Failed to add gas item' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    try {
      const body = await request.json();
      const { id, name, capacity, color } = body;
  
      if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

      const updates: GasUpdatePayload = {};
      if (name) updates.name = name;
      if (capacity) updates.capacity = capacity;
      if (color) updates.color = color;

      const { error } = await supabase.from('gas_items').update(updates).eq('id', id);
      if (error) throw error;
  
      return NextResponse.json({ success: true, message: 'Gas item updated', data: { id, ...updates } });
  
    } catch {
      return NextResponse.json({ success: false, message: 'Failed to update gas item' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idsParam = searchParams.get('ids') || searchParams.get('id');

        if (!idsParam) return NextResponse.json({ success: false, message: 'ID or IDs required' }, { status: 400 });

        const ids = idsParam.split(',').filter(Boolean);

        if (ids.length === 0) {
             return NextResponse.json({ success: false, message: 'No valid IDs provided' }, { status: 400 });
        }
        
        const { error } = await supabase.from('gas_items').delete().in('id', ids);
        if (error) throw error;

        return NextResponse.json({ success: true, message: `Deleted ${ids.length} items` });

    } catch {
        return NextResponse.json({ success: false, message: 'Failed to delete gas item' }, { status: 500 });
    }
}

