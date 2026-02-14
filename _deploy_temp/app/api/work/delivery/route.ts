import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Direct Supabase Usage
import { v4 as uuidv4 } from 'uuid';
import { TransactionType, Cylinder, Customer, Transaction } from '@/lib/types';
import { getGasColor } from '@/app/utils/gas';
import { deriveCylinderState } from '@/app/utils/cylinder'; // Pure function
import { TransactionValidator } from '@/lib/transaction-validator'; // Pure function
import { parseSmartScan, generateCustomerCandidates, generateCylinderCandidates } from '@/lib/smart-scan-logic'; // Pure function
import { isCompanyAlias } from '@/lib/company';
import { db } from '@/lib/db';
import { Mutex } from 'async-mutex';

// Cache Buster
export const dynamic = 'force-dynamic';

// Helper: Fetch Gas Name on demand (Simple Cache could be added if needed)
async function getGasName(gasId: string): Promise<string> {
    const { data } = await supabase.from('gas_items').select('name').eq('id', gasId).single();
    return data ? data.name : gasId;
}

// Helper: Fetch Holder Display Name
async function getHolderDisplayName(holderId: string): Promise<string> {
    if (isCompanyAlias(holderId)) return db.companySettings?.companyName || '삼덕공장';
    if (holderId === 'INSPECTION_AGENCY') return '검사소';
    if (holderId === '폐기') return '폐기';
    
    // Try Customer
    const { data } = await supabase.from('customers').select('name').eq('id', holderId).single();
    if (data) return data.name;
    
    return holderId;
}

// [Concurrency Control] Global Mutex for Serialize Requests
const postMutex = new Mutex();

export async function POST(request: Request) {
  // Use runExclusive to serialize all POST requests to this endpoint
  return await postMutex.runExclusive(async () => {
      try {
        const body = await request.json();
        const { type, qrCode, customerId, workerId, workMode, force } = body;

        // ... (나머지 로직 그대로 유지) ...
        // Validate Worker ID
        if (!workerId || workerId === 'WORKER-DEFAULT') {
            return NextResponse.json({ success: false, message: '작업자 정보가 없습니다. 다시 로그인해주세요.' }, { status: 400 });
        }
    
        // --- SMART SCAN RESOLUTION (On-Demand) ---
        const parse = parseSmartScan(qrCode);
        
        // 1. Customer Scan Handling
        if (type === 'SMART_SCAN' || type === 'CUSTOMER') {
            if (!parse) return NextResponse.json({ success: false, message: '잘못된 QR 코드입니다.', code: 'INVALID_QR' }, { status: 400 });
    
            let customer: Customer | null = null;
            
            // A. Attempt Lookup by ID/Code
            const candidates = generateCustomerCandidates(parse);
            if (candidates.length > 0) {
                // Construct OR query for all candidates across possible fields
                // Supabase OR syntax: column.eq.value,column2.eq.value
                // We need to check id, ledgerNumber, businessNumber against candidates
                // This can be complex in one query. Simplest is strict ID match first.
                
                // Priority 1: ID Match
                const { data: idMatch } = await supabase.from('customers')
                    .select('*')
                    .in('id', candidates)
                    .single(); // Assuming unique ID
                
                if (idMatch) customer = TransactionValidator.sanitizeCustomers([idMatch])[0];
                
                // Priority 2: Secondary Fields (if no ID match)
                if (!customer) {
                     // Try searching by other fields using the raw digits/clean target
                     // We iterate manually or make a broader query?
                     // Let's do a broader query for the 'cleanTarget' if it looks like a number
                     const target = parse.cleanTarget;
                     const { data: secondary } = await supabase.from('customers')
                        .select('*')
                        // Search by name or manager (representative mapped to manager)
                        // Removed business_number and ledger_number as they don't exist in Supabase schema
                        .or(`name.eq.${target},manager.eq.${target}`)
                        .limit(1);
                     
                     if (secondary && secondary.length > 0) {
                         customer = TransactionValidator.sanitizeCustomers(secondary)[0];
                     }
                }
            }
    
            // B. Fuzzy Search (Last Resort for Manual Input)
            if (!customer && type === 'SMART_SCAN' && !parse.isNumeric && parse.cleanTarget.length > 1) {
                const { data: fuzzy } = await supabase.from('customers')
                    .select('*')
                    .ilike('name', `%${parse.cleanTarget}%`)
                    .limit(1);
                if (fuzzy && fuzzy.length > 0) {
                    customer = TransactionValidator.sanitizeCustomers(fuzzy)[0];
                }
            }
    
            if (customer) {
                 return NextResponse.json({ success: true, message: `거래처 선택: ${customer.name}`, data: customer, entityType: 'CUSTOMER' });
            }
            
            // If type was explicitly CUSTOMER, fail. If SMART_SCAN, fall through to Cylinder.
            if (type === 'CUSTOMER') {
                 return NextResponse.json({ success: false, message: `거래처를 찾을 수 없습니다. (값: ${parse.cleanTarget})`, code: 'NOT_FOUND' }, { status: 404 });
            }
        }
    
        // 2. Cylinder Scan Handling
        let cylinder: Cylinder | null = null;
        let cylinderTxHistory: Transaction[] = [];
    
        if (parse) {
             // A. Lookup Cylinder
             const candidates = generateCylinderCandidates(parse);
             // Most likely matches serialNumber or id
                // [FIX] Use OR syntax between ID and Serial Number (stored in 'memo')
                const candidatesStr = candidates.map(c => `"${c}"`).join(',');
                const { data: cylData } = await supabase.from('cylinders')
                    .select('*')
                    .or(`memo.in.(${candidatesStr}),id.in.(${candidatesStr})`)
                    .maybeSingle();
                
             if (cylData) {
                 cylinder = TransactionValidator.sanitizeCylinders([cylData])[0];
                 
                 // B. Fetch Recent History for State Derivation
                 const { data: txData } = await supabase.from('transactions')
                    .select('*')
                    .ilike('cylinderId', cylinder.serialNumber)
                    .order('created_at', { ascending: false })
                    .limit(10); // Last 10 is enough for state
                 
                 if (txData) {
                     cylinderTxHistory = TransactionValidator.sanitizeTransactions(txData);
                 }
             }
        }
    
        if (!cylinder) {
            return NextResponse.json({ success: false, message: `용기를 찾을 수 없습니다. (${qrCode})`, code: 'NOT_FOUND' }, { status: 404 });
        }
    
        // 3. State Derivation & Validation
        const { status: derivedStatus, currentHolderId: derivedHolder } = deriveCylinderState(cylinder, cylinderTxHistory);
        
        // Sync logic state
        const logicalStatus = (['분실', '불량', '폐기'].includes(cylinder.status)) ? cylinder.status : derivedStatus;
        if (logicalStatus) cylinder.status = logicalStatus;
        if (derivedHolder) cylinder.currentHolderId = derivedHolder;
    
        if (!customerId) return NextResponse.json({ success: false, message: '거래처가 선택되지 않았습니다.' }, { status: 400 });
    
        // Fetch Full Customer Details (needed for validation)
        const { data: customerData } = await supabase.from('customers').select('*').eq('id', customerId).single();
        if (!customerData) return NextResponse.json({ success: false, message: '유효하지 않은 거래처ID입니다.' }, { status: 400 });
        const customer = TransactionValidator.sanitizeCustomers([customerData])[0];
    
        // --- BUSINESS LOGIC (ACTION DETERMINATION) ---
        let action: TransactionType | null = null;
        let message = '';
        
        if (workMode === 'DELIVERY') {
              const valResult = TransactionValidator.validateDelivery(cylinder, customer);
    
              if (!valResult.success) {
                   // Critical Errors
                   if (valResult.code === 'DISCARDED' || valResult.code === 'EXPIRY_LIMIT') {
                       return NextResponse.json({ success: false, message: valResult.error }, { status: 400 });
                   }
    
                   // Forceable Errors
                   // [SECURITY] Strict Boolean Check to prevent 'truthy' strings bypassing validation
                   if (force !== true) {
                       const extraInfo: Record<string, string> = {};
                       let finalErrorMessage = valResult.error || '';
    
                       if (valResult.code === 'LOCATION_MISMATCH' || valResult.code === 'STATUS_MISMATCH' || valResult.code === 'ALREADY_DELIVERED') {
                            if (cylinder.currentHolderId && cylinder.currentHolderId !== '삼덕공장') {
                                const holderName = await getHolderDisplayName(cylinder.currentHolderId);
                                extraInfo.currentHolder = holderName;
                                extraInfo.currentHolderId = cylinder.currentHolderId;
    
                                if (finalErrorMessage.includes(cylinder.currentHolderId)) {
                                    finalErrorMessage = finalErrorMessage.replace(cylinder.currentHolderId, holderName);
                                }
                            }
                       }
    
                       const isDuplicate = valResult.code === 'ALREADY_DELIVERED';
                       const suffix = isDuplicate ? '' : ' (강제 납품하시겠습니까?)';
    
                       return NextResponse.json({ 
                           success: false, 
                           message: `${finalErrorMessage}${suffix}`,
                           code: valResult.code,
                           ...extraInfo
                       }, { status: 400 });
                   }
              }
               
              if (valResult.warning) message = `[주의] ${valResult.warning}`;
              else message = `납품 완료: ${await getGasName(cylinder.gasType)} (${cylinder.serialNumber})`;
    
              action = '납품';
              cylinder.status = '납품';
              cylinder.currentHolderId = customer.id;
    
        } else if (workMode === 'COLLECTION_EMPTY' || workMode === 'COLLECTION_FULL') {
              const valResult = TransactionValidator.validateCollection(cylinder, customerId);
    
              if (!valResult.success) {
                    if (valResult.code === 'DISCARDED' || valResult.code === 'EXPIRY_LIMIT') {
                         return NextResponse.json({ success: false, message: valResult.error }, { status: 400 });
                    }
                    // [SECURITY] Strict Boolean Check
                    if (force !== true) {
                         const extraInfo: Record<string, string> = {};
                         let finalErrorMessage = valResult.error || '';
    
                         if (valResult.code === 'LOCATION_MISMATCH' || valResult.code === 'STATUS_MISMATCH' || valResult.code === 'ALREADY_DELIVERED' || valResult.code === 'ALREADY_COLLECTED' || valResult.code === 'LOCATION_AGENCY') {
                              if (cylinder.currentHolderId && cylinder.currentHolderId !== customerId) {
                                   const holderName = await getHolderDisplayName(cylinder.currentHolderId);
                                   extraInfo.currentHolder = holderName;
                                   if (finalErrorMessage.includes(cylinder.currentHolderId)) {
                                       finalErrorMessage = finalErrorMessage.replace(cylinder.currentHolderId, holderName);
                                   }
                              }
                         }
                         const isDuplicate = valResult.code === 'ALREADY_DELIVERED' || valResult.code === 'ALREADY_COLLECTED';
                         const suffix = isDuplicate ? '' : ' (강제 회수하시겠습니까?)';
    
                         return NextResponse.json({
                             success: false,
                             message: `${finalErrorMessage}${suffix}`,
                             code: valResult.code,
                             ...extraInfo
                         }, { status: 400 });
                    }
              }
    
              action = (workMode === 'COLLECTION_FULL') ? '회수(실병)' : '회수';
              cylinder.status = (workMode === 'COLLECTION_FULL') ? '실병' : '공병';
              cylinder.currentHolderId = '삼덕공장';
              const typeStr = (action === '회수(실병)') ? '실병' : '공병';
              
              if (valResult.warning) message = `[주의] ${valResult.warning}`;
              else message = `회수(${typeStr}) 완료: ${await getGasName(cylinder.gasType)} (${cylinder.serialNumber})`;
    
        } else {
              return NextResponse.json({ success: false, message: '작업 모드를 선택해주세요.' }, { status: 400 });
        }
    
        // 4. Record Transaction & Update Cylinder (Atomic-ish)
        if (action) {
          const isCollection = action === '회수' || action === '회수(실병)';
          const methodStr = (action === '회수(실병)') ? '실병' : (isCollection ? '공병' : '');
          const baseActionName = isCollection ? `회수(${methodStr})` : action;
          
          const baseMemo = action === '납품' ? '납품 완료' : `${baseActionName} 완료`;
          const memoStr = `${baseMemo}: ${customer.name}`;
          const txTimestamp = new Date().toISOString();
          const txId = uuidv4();
    
          const txObj: Transaction = {
              id: txId,
              timestamp: txTimestamp,
              type: action,
              cylinderId: cylinder.serialNumber, 
              customerId: customer.id,
              workerId: workerId,
              memo: memoStr
          };
    
          try {
              // [Transaction Lock] Atomic Update for both TX and Cylinder
              await db.transaction(data => {
                  data.transactions = [txObj, ...data.transactions];
                  data.cylinders = data.cylinders.map(c => 
                      c.id === cylinder.id 
                      ? { ...c, status: cylinder.status, currentHolderId: cylinder.currentHolderId } 
                      : c
                  );
              });
              
// console.log(`✅ [Delivery] Mutex-protected update success: ${cylinder.serialNumber}`);
          } catch (err) {
              console.error('❌ [Delivery] Atomic Update Failed:', err);
              return NextResponse.json({ success: false, message: '데이터 업데이트 중 충돌이 발생했습니다. 다시 시도해 주세요.' }, { status: 500 });
          }
    
          // Audit Log (Fire and Forget)
          import('@/lib/audit-logger').then(({ AuditLogger }) => {
              AuditLogger.log(
                 workMode === 'DELIVERY' ? 'TRANSACTION_DELIVERY' : 'TRANSACTION_COLLECTION', 
                 { cylinder: cylinder?.serialNumber, customer: customer.name, memo: memoStr }, 
                 workerId
              ).catch(e => console.error('Audit Log Error:', e));
          });
        }
    
        return NextResponse.json({ success: true, message, action, data: cylinder });
    
      } catch (error: unknown) {
        console.error('❌ [API/Delivery] Critical Error:', error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        return NextResponse.json({ success: false, message: `서버 내부 오류: ${errorMessage}` }, { status: 500 });
      }
  }); // End of runExclusive
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build Query
    let query = supabase.from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); // [OPTIMIZATION] Limit to 100 recent items default

    if (customerId) {
        query = query.eq('customerId', customerId);
    }

    if (startDate && endDate) {
        // Simple string comparison for dates works if ISO format
        // KST Aware Date Filter
        query = query.gte('created_at', `${startDate}T00:00:00+09:00`)
                     .lte('created_at', `${endDate}T23:59:59+09:00`);
    }

    const { data: rawData, error } = await query;

    if (error) throw error;
    if (!rawData) return NextResponse.json({ success: true, data: [] });

    const transactions = TransactionValidator.sanitizeTransactions(rawData);

    // Hydrate Data (N+1 Optimization required? For 100 items, doing it robustly)
    // We need Cylinder, Customer, and Worker info.
    // Collect IDs
    const cylinderIds = Array.from(new Set(transactions.map(t => t.cylinderId)));
    const customerIds = Array.from(new Set(transactions.map(t => t.customerId).filter(Boolean)));
    const workerIds = Array.from(new Set(transactions.map(t => t.workerId)));

    // Bulk Fetch
    const [cylRes, cusRes, userRes, gasRes] = await Promise.all([
        supabase.from('cylinders').select('*').in('id', cylinderIds),
        supabase.from('customers').select('*').in('id', customerIds),
        supabase.from('users').select('*').in('id', workerIds),
        supabase.from('gas_items').select('*') // Small table, fetch all? Or IDs?
    ]);

    const cylinderMap = new Map((cylRes.data || []).map(c => [c.id, c]));
    const customerMap = new Map((cusRes.data || []).map(c => [c.id, c]));
    const userMap = new Map((userRes.data || []).map(u => [u.id, u]));
    const gasMap = new Map((gasRes.data || []).map(g => [g.id, g]));

    // Helper for Gas
    const getGasInfo = (gasType: string) => {
        // Try finding by ID first
        const item = gasMap.get(gasType);
        if (item) return { name: item.name, color: item.color || getGasColor(gasType) };
        // If not found, it might be a raw code
        return { name: gasType, color: getGasColor(gasType) };
    };

    const history = transactions.map(t => {
        const rawCylinder = cylinderMap.get(t.cylinderId);
        const cylinder = rawCylinder ? TransactionValidator.sanitizeCylinders([rawCylinder])[0] : undefined;
        // Note: Transaction Sanitizer maps 'customer_id' to 'customerId'.
        const customer = t.customerId ? customerMap.get(t.customerId) : undefined;
        const user = userMap.get(t.workerId);

        // [FIX] KST Conversion (Store as ISO UTC -> Add 9h -> Format YYYY-MM-DD HH:mm:ss)
        const dateObj = new Date(t.timestamp);
        dateObj.setHours(dateObj.getHours() + 9);
        const dateStr = dateObj.toISOString().replace('T', ' ').substring(0, 19);

        const gasInfo = cylinder ? getGasInfo(cylinder.gasType) : { name: '미확인', color: 'gray' };

        // [FIX] Consistently prioritize Serial Number for UI Display
        const displaySerial = cylinder ? (cylinder.serialNumber || t.cylinderId) : t.cylinderId;

        return {
            id: t.id,
            date: dateStr,
            cylinderId: displaySerial, // Use Serial instead of UUID
            gas: gasInfo.name,
            gasColor: gasInfo.color,
            type: t.type,
            customer: customer ? customer.name : (t.customerId === 'UNKNOWN' ? '미확인' : t.customerId),
            customerId: t.customerId,
            worker: user ? (user.name || user.username || t.workerId) : t.workerId,
            memo: t.memo,
            containerType: cylinder ? cylinder.containerType : 'CYLINDER',
            capacity: cylinder ? cylinder.capacity : '-', // [NEW] Added for Ledger
            gasType: cylinder ? cylinder.gasType : '-'    // [NEW] Fixed Gas Type
        };
    });

    return NextResponse.json({ success: true, data: history });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
