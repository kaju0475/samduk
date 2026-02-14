import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TransactionValidator } from '@/lib/transaction-validator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'ALL';

    // 1. Build Query
    let query = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false }) // Assuming 'date' is the timestamp column
      .limit(50); // Fetch a bit more to handle dedup if needed

    // 2. Apply Filters (Client logic mapped to DB filters)
    if (filter === 'DELIVERY') {
        query = query.in('type', ['납품', '회수']);
    } else if (filter === 'CHARGING') {
        query = query.in('type', ['충전시작', '충전완료', '충전']);
        // Note: '충전 시작' might be stored as 'START' or '충전시작' depending on legacy. 
        // Based on restore script, we just copied what was in DB.
    } else if (filter === 'INSPECTION') {
        query = query.in('type', ['검사입고', '검사출고', '폐기', '재검사']);
    }

    const { data: transactions, error } = await query;
    if (error) throw error;

    if (!transactions || transactions.length === 0) {
        return NextResponse.json([]);
    }

    // 3. Deduplicate by Cylinder ID (Client side logic kept)
    const uniqueCylinders = new Set();
    const uniqueTransactions = [];
    for (const tx of transactions) {
        if (!uniqueCylinders.has(tx.cylinderId)) {
            uniqueCylinders.add(tx.cylinderId);
            uniqueTransactions.push(tx);
        }
        if (uniqueTransactions.length >= 20) break;
    }

    // 4. Fetch Related Data (Cylinders, Customers, Users)
    // 4. Fetch Related Data (Cylinders, Customers, Users)
    const cylinderIds = [...new Set(uniqueTransactions.map(t => t.cylinderId).filter(Boolean))];
    const customerIds = [...new Set(uniqueTransactions.map(t => t.customerId).filter(Boolean))];
    const workerIds = [...new Set(uniqueTransactions.map(t => t.workerId).filter(Boolean))];

    // [FIX] Lookup cylinders by 'serial_number' because transactions.cylinderId stores the Serial Number (CSN)
    const [cylindersRes, customersRes, usersRes] = await Promise.all([
        cylinderIds.length > 0 ? supabase.from('cylinders').select('*').in('serial_number', cylinderIds) : { data: [] },
        customerIds.length > 0 ? supabase.from('customers').select('id, name').in('id', customerIds) : { data: [] },
        workerIds.length > 0 ? supabase.from('users').select('id, name').in('id', workerIds) : { data: [] }
    ]);

    // [FIX] Map by serial_number
    const cylinderMap = new Map(cylindersRes.data?.map((c: any) => [c.serial_number, c]) || []);
    const customerMap = new Map(customersRes.data?.map((c: any) => [c.id, c]) || []);
    const userMap = new Map(usersRes.data?.map((u: any) => [u.id, u]) || []);

    // 5. Map to Response Format
    const logs = uniqueTransactions.map(tx => {
      let typeKr = '';
      let color = 'gray';
      let desc = '';
      
      const customer = customerMap.get(tx.customerId);
      let custName = customer ? customer.name : (tx.customerId === '폐기' ? '폐기' : (tx.customerName || 'Unknown'));
      
      if (custName === '삼덕공장' || custName === 'SAMDUK') {
          custName = '삼덕공장';
      }

      const workerUser = userMap.get(tx.workerId);
      const workerName = workerUser ? workerUser.name : '관리자';

      // Type Mapping
      const tType = tx.type;
      if (tType === '납품' || tType === 'DELIVERY') {
          typeKr = '납품'; color = 'blue'; desc = `거래처(${custName}) 납품`;
      } else if (tType === '회수' || tType === 'COLLECTION') {
          typeKr = '회수'; color = 'orange'; desc = `공병 회수 (from ${custName})`;
      } else if (tType === '충전' || tType === 'COMPLETE') {
          typeKr = '충전'; color = 'green'; desc = `공장 내 충전 완료`;
      } else if (tType === '검사출고' || tType === 'INSPECTION_OUT') {
          typeKr = '검사출고'; color = 'red'; desc = `검사소 위탁 반출`;
      } else if (tType === '검사입고' || tType === 'INSPECTION_IN') {
          typeKr = '검사입고'; color = 'teal'; desc = `검사 완료 입고`;
      } else if (tType === '충전시작' || tType === 'START') {
          typeKr = '충전시작'; color = 'orange'; desc = '충전 작업 시작'; // Orange confirmed
      } else if (tType === '충전완료' || tType === 'COMPLETE') { // Handle dup if any
          typeKr = '충전완료'; color = 'teal'; desc = '충전 작업 완료';
      } else {
          typeKr = tType; desc = tx.status || '-';
      }

      const d = new Date(tx.date); // Using 'date' column
      const timeStr = `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;

      const rawCylinder = cylinderMap.get(tx.cylinderId);
      const cylinder = rawCylinder ? TransactionValidator.sanitizeCylinders([rawCylinder])[0] : null;      
      const serialNumber = cylinder ? cylinder.serialNumber : (tx.cylinderId || 'Unknown');

      return {
        type: typeKr,
        rawType: tx.type,
        code: serialNumber,
        desc: desc,
        time: timeStr,
        color: color,
        worker: workerName,
        customerId: tx.customerId || null,
        cylinderId: tx.cylinderId,
        workerId: tx.workerId,
        gasType: cylinder ? cylinder.gasType : (tx.gasType || 'Unknown'),
        gasTypeColor: 'gray' // Simplification
      };
    });

    return NextResponse.json(logs);

  } catch (error) {
    console.error('Dashboard Logs Error:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
