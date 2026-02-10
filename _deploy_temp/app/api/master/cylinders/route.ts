import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { getGasColor } from '@/app/utils/gas';
import { normalizeCompanyOwner, isCompanyAlias } from '@/lib/company';
// import { db } from '@/lib/db'; // [OPTIMIZATION] Removed heavy DB init


// [OPTIMIZATION] Removed heavy DB init


// Define DB Types removed (Use TransactionValidator)


export const dynamic = 'force-dynamic';

export async function GET(request: Request) {

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = (searchParams.get('search') || '').trim();
    const filter = (searchParams.get('filter') || 'ALL').toUpperCase();
    const sortField = searchParams.get('sortField') || 'created_at'; // Default DB column
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    // Pagination Range
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('cylinders').select('*', { count: 'exact' });

    // 1. Base Filter
    // query = query.eq('is_deleted', false); // Column missing

    // 2. Search Logic (Safe ILIKE)
    if (search) {
        // Search by Serial, Gas Type, Owner, or Location
        // [FIX] Use consistent field names for search
        query = query.or(`serial_number.ilike.%${search}%,gas_type.ilike.%${search}%,ownership.ilike.%${search}%,location.ilike.%${search}%`);
    }

    // 3. Status/Type Filter
    if (filter !== 'ALL') {
        if (filter === 'FACTORY') {
             // Include aliases in query or just canonical? 
             // Ideally data is normalized. We check canonical.
             query = query.eq('location', '삼덕공장');
        } else if (filter === 'PARTNER') {
             query = query.neq('location', '삼덕공장').neq('location', 'INSPECTION_AGENCY');
        } else if (filter === 'NEEDS_INSPECTION') {
             // Expiry <= Today + 30
             const today = new Date();
             const targetDate = new Date();
             targetDate.setDate(today.getDate() + 30);
             const isoDate = targetDate.toISOString().split('T')[0];
             
             // Logic: expiry <= date OR expiry is null
             query = query.or(`charging_expiry_date.lte.${isoDate},charging_expiry_date.is.null`);
        } else if (filter === 'LOST') {
             query = query.eq('status', '분실');
        }
    }

    // 4. Sorting
    // Map frontend sort fields to DB columns
    const colMap: Record<string, string> = {
        'serialNumber': 'serial_number',
        'gasType': 'gas_type',
        'capacity': 'capacity',
        'location': 'location', // Mapped from currentHolderId
        'status': 'status',
        'expiryDate': 'charging_expiry_date',
        'owner': 'owner',
        'createdDate': 'created_at'
    };
    const dbSortCol = colMap[sortField] || 'created_at';
    
    query = query.order(dbSortCol, { ascending: sortDirection === 'asc' });

    // 5. Execute with Pagination
    const { data: rawData, count, error } = await query.range(from, to);

    if (error) throw error;

    // 6. Map Data (Hydrate Names)
    // To be efficient, we fetch unique Customer IDs from the result and load Names
    const uniqueCustIds = new Set<string>();
    rawData?.forEach((r: any) => {
        if (r.owner && !isCompanyAlias(r.owner)) uniqueCustIds.add(r.owner);
        if (r.location && !isCompanyAlias(r.location) && r.location !== 'INSPECTION_AGENCY' && r.location !== '폐기' && r.location !== '확인불가') uniqueCustIds.add(r.location);
    });

    const { data: customers } = await supabase.from('customers').select('id, name').in('id', Array.from(uniqueCustIds));
    const custMap = new Map((customers || []).map((c: any) => [c.id, c.name]));

    const mappedData = (rawData || []).map((c: any) => {
         // ownership vs owner: DB has 'ownership'
         const ownerId = c.ownership; 
         const ownerName = isCompanyAlias(ownerId)
            ? ('삼덕가스공업(주)') 
            : custMap.get(ownerId) || ownerId;

         const locationName = c.status === '분실' 
            ? '확인불가'
            : isCompanyAlias(c.location)
                ? '삼덕공장'
                : c.location === 'INSPECTION_AGENCY' 
                    ? '검사소' 
                    : custMap.get(c.location) || c.location;

         return {
            id: c.id, 
            serialNumber: c.serial_number || c.memo || c.id, // Guarantee a human-readable identifier
            gasType: c.gas_type,
            capacity: c.volume || c.capacity || '', 
            owner: ownerId,
            ownerName: ownerName,
            location: c.location,
            locationName: locationName,
            status: c.status,
            chargingExpiryDate: c.charging_expiry_date, 
            manufactureDate: c.manufacture_date, 
            lastInspectionDate: c.last_inspection_date, 
            containerType: c.container_type || c.containerType || 'CYLINDER',
            updatedAt: c.updated_at,
            gasColor: getGasColor(c.gas_type),
            parentRackId: c.parent_rack_id
        };
    });

    return NextResponse.json({ 
        success: true, 
        data: mappedData,
        pagination: {
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize)
        }
    }, {
        headers: { 'Cache-Control': 'no-store, no-cache', 'Pragma': 'no-cache' }
    });

  } catch (e) {
    console.error('API Error:', e);
    return NextResponse.json({ success: false, message: 'Failed to fetch cylinders' }, { status: 500 });
  }
}

import { TransactionValidator } from '@/lib/transaction-validator';

// ... (GET logic remains mostly same but we can check it later)

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
        serialNumber, gasType, owner: rawOwner,
        containerType, bundleCount, childSerials, capacity,
        chargingExpiryDate, manufactureDate // Added these back
    } = body;

    const owner = rawOwner ? normalizeCompanyOwner(rawOwner) : undefined;

    if (!serialNumber || !gasType) {
      return NextResponse.json({ success: false, message: 'Serial Number and Gas Type are required' }, { status: 400 });
    }

    // Check Duplicate
    const { data: existing } = await supabase.from('cylinders')
        .select('id')
        .eq('serial_number', serialNumber)
        .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, message: `이미 등록된 용기 번호입니다: ${serialNumber}` }, { status: 409 });
    }

    // [RACK LOGIC]
    if (containerType === 'RACK') {
        const children = childSerials || [];
        const count = bundleCount || 0;
        
        if (children.length !== count) {
             return NextResponse.json({ success: false, message: `기준 수량(${count})과 선택된 용기 수량(${children.length})이 일치하지 않습니다.` }, { status: 400 });
        }
                
        const rackId = uuidv4();
        const now = new Date().toISOString();

        // Use Validator for Dual Write
        const newRack = TransactionValidator.toCylinderDB({
            id: rackId,
            serialNumber: serialNumber.toUpperCase(),
            gasType: gasType,
            owner: owner || '삼덕공장',
            status: '공병',
            currentHolderId: '삼덕공장',
            containerType: 'RACK',
            createdAt: now
        });
        
        // Ensure memo is set for Serial Search compatibility in legacy
        if (!newRack.memo) newRack.memo = serialNumber.toUpperCase();

        const { error: insertError } = await supabase.from('cylinders').insert(newRack);
        if (insertError) throw insertError;

        // Update Children
        if (children.length > 0) {
             const { data: childRows } = await supabase.from('cylinders').select('id').in('serial_number', children);
             const childIds = childRows?.map((c: any) => c.id) || [];
             
             if (childIds.length > 0) {
                 await supabase.from('cylinders').update({
                     parent_rack_id: rackId
                 }).in('id', childIds);
             }
        }
        
        return NextResponse.json({ success: true, data: newRack });
    }

    const normalizedOwner = normalizeCompanyOwner(owner || '삼덕공장');

    // [NORMAL CYLINDER]
    // Use Validator for Dual Write
    const newCylinder = TransactionValidator.toCylinderDB({
        id: uuidv4(),
        serialNumber: serialNumber.toUpperCase(),
        gasType: gasType,
        owner: normalizedOwner,
        status: '공병',
        currentHolderId: '삼덕공장',
        capacity: capacity,
        chargingExpiryDate: chargingExpiryDate, // Pass even if DB might reject specific column (safe retry logic needed?)
        manufactureDate: manufactureDate,
        containerType: containerType || 'CYLINDER',
        createdAt: new Date().toISOString()
    });
    
    // Ensure memo
    if (!newCylinder.memo) newCylinder.memo = serialNumber.toUpperCase();

    const { error: insertError } = await supabase.from('cylinders').insert(newCylinder);
    if (insertError) throw insertError;

    return NextResponse.json({ success: true, data: newCylinder });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, message: (e as Error).message || 'Failed to create cylinder' }, { status: 500 });
  }
}

// PUT: Update
export async function PUT(request: Request) {
    let body: Record<string, any>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
    }

    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    try {
        // [CENTRAL CONTROL] Use TransactionValidator
        const payload = TransactionValidator.toCylinderDB({
            serialNumber: updates.serialNumber,
            gasType: updates.gasType,
            status: updates.status,
            currentHolderId: updates.location || updates.currentHolderId, // Map input to Standard
            capacity: updates.capacity,
            owner: updates.owner ? normalizeCompanyOwner(updates.owner) : undefined,
            memo: updates.memo,
            chargingExpiryDate: updates.chargingExpiryDate,
            manufactureDate: updates.manufactureDate,
            lastInspectionDate: updates.lastInspectionDate,
        });

        // Add update timestamp
        payload.updated_at = new Date().toISOString();

        // Logic check: Rename duplicate serial?
        if (payload.serial_number) {
             const { data: dup } = await supabase.from('cylinders').select('id').eq('serial_number', payload.serial_number).neq('id', id).maybeSingle();
             if (dup) return NextResponse.json({ success: false, message: 'Serial number exists' }, { status: 409 });
        }

        // Update
        const { error } = await supabase.from('cylinders').update(payload).eq('id', id);
        if (error) throw error;

        // Rack Logic (Sync Children) if provided
        if (updates.childSerials) {
            await supabase.from('cylinders').update({ parent_rack_id: null }).eq('parent_rack_id', id);
            const newChildrenSerials = updates.childSerials as string[];
            if (newChildrenSerials.length > 0) {
                 const { data: childRows } = await supabase.from('cylinders').select('id').in('serial_number', newChildrenSerials);
                 const childIds = childRows?.map((c: any) => c.id) || [];
                 if (childIds.length > 0) {
                     await supabase.from('cylinders').update({ parent_rack_id: id }).in('id', childIds);
                 }
            }
        }

        return NextResponse.json({ success: true, data: { id, ...payload } });
        
    } catch (e: unknown) {
        console.error('Cylinder Update Error:', e);
        
        // Use Type Assertion for Supabase Error Structure
        const err = e as { code?: string, message?: string };

        // [Retry Logic] Check for various "Column Missing" error patterns
        const isColumnError = 
            err.code === '42703' || 
            (err.message && (
                err.message.includes('Could not find') && err.message.includes('column') || 
                err.message.includes('does not exist') ||
                err.message.includes('schema cache')
            ));

        if (isColumnError) {
            console.warn('⚠️ Missing Columns in Cylinder Table. Retrying with Base Schema...');
             try {
                // Safe Payload: Only core columns found in schema.sql
                // Enforce Dual Write here too
                const holder = updates.location || updates.currentHolderId;
                const owner = updates.owner ? normalizeCompanyOwner(updates.owner) : undefined;
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const safePayload: Record<string, any> = {};
                if (updates.serialNumber) safePayload.serial_number = updates.serialNumber;
                if (updates.gasType) safePayload.gas_type = updates.gasType;
                if (updates.status) safePayload.status = updates.status;
                if (holder) {
                    safePayload.location = holder;
                    safePayload.current_holder_id = holder; // [FIX] Sync
                }
                if (updates.memo) safePayload.memo = updates.memo;
                if (owner) safePayload.ownership = owner;
                
                // Exclude: volume, charging_expiry_date, manufacture_date, last_inspection_date

                const { error: retryError } = await supabase.from('cylinders').update(safePayload).eq('id', id);
                if (retryError) throw retryError;

                return NextResponse.json({ 
                    success: true, 
                    message: '용기 기본 정보는 수정되었으나, 충전기한/제조일 등 일부 항목은 DB 버전 문제로 저장되지 않았습니다.', 
                    warning: true 
                });

             } catch (retryE: unknown) {
                 const retryMsg = (retryE as { message?: string })?.message || 'Unknown Retry Error';
                 return NextResponse.json({ success: false, message: `기본 수정 실패: ${retryMsg}`, error: retryMsg }, { status: 500 });
             }
        }

        const msg = err.message || 'Update failed';
        return NextResponse.json({ success: false, message: msg }, { status: 500 });
    }
}

// DELETE
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idsParam = searchParams.get('ids') || searchParams.get('id');
        
        if (!idsParam) return NextResponse.json({ success: false, message: 'IDs required' }, { status: 400 });

        const ids = idsParam.split(',');
        
        // Soft Delete
        /* Column missing
        const { error } = await supabase.from('cylinders').update({
            is_deleted: true,
            status: '폐기',
            updated_at: new Date().toISOString()
        }).in('id', ids);
        */
        // Use Hard Delete
        const { error } = await supabase.from('cylinders').delete().in('id', ids);

        if (error) throw error;

        return NextResponse.json({ success: true, message: `${ids.length} Deleted` });

    } catch {
        return NextResponse.json({ success: false, message: 'Delete failed' }, { status: 500 });
    }
}
