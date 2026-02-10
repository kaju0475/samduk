
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { deriveCylinderState } from '@/app/utils/cylinder';
import { Transaction, Cylinder, Customer } from '@/lib/types'; // Ensure types import

export const dynamic = 'force-dynamic';

type SearchResult = {
    id: string;
    type: 'CYLINDER' | 'CUSTOMER' | 'MENU';
    title: string;
    subtitle: string;
    link: string;
    relevance: number; // For sorting
};

const MENU_ITEMS = [
    { title: '대시보드', keywords: ['dashboard', '대시보드', '메인', 'home'], link: '/dashboard', subtitle: '전체 현황 모니터링' },
    { title: '납품/회수', keywords: ['delivery', '납품', '회수', '배송', '운송', '등록', '추가'], link: '/work/delivery', subtitle: '용기 납품 및 회수 처리' },
    { title: '충전 관리', keywords: ['charging', '충전', '생산', '충전소', '등록', '추가'], link: '/work/charging', subtitle: '용기 충전 및 생산 관리' },
    { title: '검사 관리', keywords: ['inspection', '검사', '재검', '검사소', '등록', '추가'], link: '/work/inspection', subtitle: '용기 검사 입고/출고' },
    { title: '재고 현황', keywords: ['inventory', '재고', '보유', '현황', '통계'], link: '/master/customers?tab=inventory', subtitle: '거래처별 용기 보유 현황' },
    { title: '용기 관리', keywords: ['cylinder', 'master', '용기', '등록', '수정', '추가', '신규'], link: '/master/cylinders', subtitle: '용기 마스터 데이터 관리' },
    { title: '거래처 관리', keywords: ['customer', 'client', '거래처', '업체', '등록', '수정', '추가', '신규'], link: '/master/customers', subtitle: '거래처 정보 관리' },
    { title: '시스템 설정', keywords: ['system', 'setting', '설정', '백업', '계정'], link: '/system', subtitle: '시스템 설정 및 백업' },
    { title: '납품 대장', keywords: ['ledger', '대장', '장부', '거래원장', '인쇄', '출력'], link: '/master?action=ledger', subtitle: '월간 거래처 납품 대장 출력' },
    { title: '가스 관리', keywords: ['gas', '품목', '가스', '단가', '용량'], link: '/master/gases', subtitle: '가스 종류 및 표준 용량 관리' },
    { title: '사용자 관리', keywords: ['user', 'account', '계정', '직원', '비밀번호'], link: '/master/users', subtitle: '시스템 사용자 및 권한 관리' },
];

const INTENT_MAP = {
    HISTORY: ['이력', '내역', '조회', 'history', 'log', '기록', '언제', '과거', '사용 내역', '거래 장부'],
    INVENTORY: ['재고', '현황', '보유', 'inventory', 'stock', '통계', '잔량', '몇개', '얼마나', '수량'],
    DELIVERY: ['납품', 'delivery', '배송', '운송', '출고', '가져다', '보내'],
    LOCATION: ['위치', '어디', '거래처', '소유자', '장소', 'location', 'where', '누구', '찾아'],
    CREATE: ['등록', '신규', '추가', '생성', '만들기', '입력', '새로운', 'create', 'register', 'new', 'add', '접수'],
    REPORT: ['출력', '인쇄', '다운로드', '엑셀', 'report', 'print', 'excel', 'qr', '큐알', 'pdf', '보고서', '뽑아'],
    MANAGEMENT: ['관리', '수정', '변경', 'edit', 'manage', 'setting', '설정']
};

const STOP_WORDS = ['용기', '통', '가스', '번호', '이름', '검색', '찾아줘', '알려줘', '보여줘', '현황', '상태', '어때', '정보', '가격', '단가'];

function detectIntent(rawQuery: string) {
    let intent = null;
    const tokens = rawQuery.split(/\s+/);
    const meaningfulTokens: string[] = [];

    for (const token of tokens) {
        let isIntent = false;
        let isStopWord = false;

        for (const [key, keywords] of Object.entries(INTENT_MAP)) {
            if (keywords.some(k => token.includes(k))) {
                intent = key;
                isIntent = true;
                break;
            }
        }

        if (!isIntent) {
            if (STOP_WORDS.some(sw => token.includes(sw))) isStopWord = true;
        }

        if (!isIntent && !isStopWord) meaningfulTokens.push(token);
    }

    const entity = meaningfulTokens.join(' ');
    return { intent, entity };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawQuery = searchParams.get('q')?.toLowerCase().trim();

        if (!rawQuery) {
            return NextResponse.json({ success: true, data: [] });
        }

        const { intent, entity } = detectIntent(rawQuery);
        const effectiveQuery = (entity.length > 0) ? entity : rawQuery;

        const results: SearchResult[] = [];

        // 1. Menu Search (Local Static)
        MENU_ITEMS.forEach(item => {
            const isMatch = item.title.toLowerCase().includes(effectiveQuery) || item.keywords.some(k => k.includes(effectiveQuery));
            if (isMatch) {
                let link = item.link;
                let subtitle = item.subtitle;
                let actionLabel = '';

                if (intent === 'CREATE' && (item.link.includes('customers') || item.link.includes('cylinders'))) {
                    link += '?action=create';
                    subtitle = `AI 명령: ${item.title} 신규 등록 창을 엽니다.`;
                    actionLabel = ' [신규 등록]';
                } else if (intent === 'REPORT' && (item.link.includes('customers') || item.link.includes('cylinders'))) {
                    link += '?action=qr';
                    subtitle = `AI 명령: ${item.title} QR/보고서 출력 창을 엽니다.`;
                    actionLabel = ' [출력]';
                }

                results.push({
                    id: `menu-${item.link}`,
                    type: 'MENU',
                    title: item.title + actionLabel,
                    subtitle: subtitle,
                    link: link,
                    relevance: item.title === effectiveQuery ? 100 : (intent ? 95 : 50)
                });
            }
        });

        // 2. Parallel Database Search
        const isNumeric = /^\d+$/.test(effectiveQuery);
        const looksLikeSerial = effectiveQuery.length >= 3;

        const promises = [];

        // A. Search Cylinders
        if (looksLikeSerial) {
            promises.push(
                supabase.from('cylinders')
                .select('*')
                .ilike('serial_number', `%${effectiveQuery}%`)
                .limit(10)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .then(async ({ data: rawCylinders }: { data: any[] | null }) => {
                    if (!rawCylinders || rawCylinders.length === 0) return;

                    // [Fix] Map Supabase snake_case to CamelCase (Typescript Safety)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cylinders: Cylinder[] = rawCylinders.map((rc: Record<string, any>) => ({
                        ...(rc),
                        serialNumber: rc.serial_number, // explicit map
                        gasType: rc.gas_type,
                        currentHolderId: rc.location || rc.current_holder_id, 
                        status: rc.status,
                        owner: rc.owner_id
                    })) as Cylinder[];

                    // Fetch associated transactions for status derivation
                    const serials = cylinders.map(c => c.serialNumber);
                    const { data: rawTxs } = await supabase
                        .from('transactions')
                        .select('*')
                        .in('cylinder_id', serials)
                        .order('created_at', { ascending: false });

                    // Map Transactions
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const txs: Transaction[] = (rawTxs || []).map((rt: Record<string, any>) => ({
                        ...(rt),
                        cylinderId: rt.cylinder_id,
                        customerId: rt.customer_id,
                        workerId: rt.worker_id,
                        timestamp: rt.created_at || rt.date, // Check DB column
                        type: rt.type,
                        memo: rt.memo
                    })) as Transaction[];

                    // Fetch Holder Customer Names needed for display
                    const neededCustomerIds = new Set<string>();
                    
                    cylinders.forEach((c: Cylinder) => {
                       const relevant = txs.filter((t: Transaction) => t.cylinderId === c.serialNumber);
                       const { currentHolderId } = deriveCylinderState(c, relevant);
                       if (currentHolderId && currentHolderId !== '삼덕공장' && currentHolderId !== '폐기' && currentHolderId !== 'INSPECTION_AGENCY') {
                           neededCustomerIds.add(currentHolderId);
                       }
                    });

                    const customerNameMap = new Map<string, string>();
                    if (neededCustomerIds.size > 0) {
                        const { data: holders } = await supabase.from('customers').select('id, name').in('id', Array.from(neededCustomerIds));
                        holders?.forEach((h: { id: string; name: string }) => customerNameMap.set(h.id, h.name));
                    }

                    // Build Results
                    cylinders.forEach((c: Cylinder) => {
                        const relevant = (txs || []).filter((t: Transaction) => t.cylinderId === c.serialNumber);
                        const { status, currentHolderId } = deriveCylinderState(c, relevant);
                        
                        let location = currentHolderId;
                        if (currentHolderId === '삼덕공장') location = '삼덕가스 공장';
                        else if (customerNameMap.has(currentHolderId)) location = customerNameMap.get(currentHolderId)!;

                        // [NLP] Location Cross-Ref
                        if ((intent === 'LOCATION' || intent === 'DELIVERY' || rawQuery.includes('거래처')) && customerNameMap.has(currentHolderId)) {
                             results.push({
                                id: `rel-${currentHolderId}-${c.id}`,
                                type: 'CUSTOMER',
                                title: `${location} (${c.serialNumber} 보유)`,
                                subtitle: `AI 추천: ${c.serialNumber} 용기가 위치한 거래처입니다.`,
                                link: `/master/customers?search=${location}`,
                                relevance: 85
                            });
                        }

                        results.push({
                            id: c.id,
                            type: 'CYLINDER',
                            title: `용기 #${c.serialNumber} (${c.gasType})`,
                            subtitle: `${status} | 위치: ${location}`,
                            link: `/master/cylinders?search=${c.serialNumber}`,
                            relevance: c.serialNumber.toLowerCase() === effectiveQuery ? 90 : 70
                        });
                    });
                })
            );
        }

        // B. Search Customers
        if (!isNumeric || effectiveQuery.length > 1) {
             const custQuery = supabase.from('customers')
                .select('*')
                .or(`name.ilike.%${effectiveQuery}%,phone.ilike.%${effectiveQuery}%`)
                .limit(5);
            
            promises.push(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                custQuery.then(({ data: customers }: { data: any[] | null }) => {
                    customers?.forEach((cust: Customer) => {
                         let title = cust.name;
                        let subtitle = `${cust.address || '주소 미지정'} | ${cust.representative || '대표자 없음'}`;
                        let link = `/master/customers?search=${cust.name}`;
                        let relevance = cust.name.toLowerCase() === effectiveQuery ? 80 : 60;

                        if (intent === 'HISTORY') {
                            title = `${cust.name} (거래 이력 조회)`;
                            subtitle = `AI 추천: ${cust.name}의 상세 거래 내역을 확인합니다.`;
                            link += '&tab=history'; 
                            relevance += 25; 
                        } else if (intent === 'INVENTORY') {
                            title = `${cust.name} (보유 재고 확인)`;
                            subtitle = `AI 추천: 현재 보유 중인 용기 현황을 조회합니다.`;
                            link += '&tab=inventory';
                            relevance += 20;
                        } else if (intent === 'REPORT') {
                            title = `${cust.name} (QR/보고서 출력)`;
                            subtitle = `AI 명령: ${cust.name} 관련 문서를 출력합니다.`;
                            link += '&action=qr';
                            relevance += 20;
                        } else if (intent === 'MANAGEMENT') {
                            subtitle = `AI 추천: ${cust.name} 정보를 수정/관리합니다.`;
                            link += '&tab=info';
                            relevance += 10;
                        }

                        results.push({
                            id: cust.id,
                            type: 'CUSTOMER',
                            title,
                            subtitle,
                            link,
                            relevance
                        });
                    });
                })
            );
        }

        await Promise.all(promises);

        results.sort((a, b) => b.relevance - a.relevance);

        return NextResponse.json({ success: true, data: results });

    } catch (e) {
        console.error('Search API Error:', e);
        return NextResponse.json({ success: false, message: 'Search failed' }, { status: 500 });
    }
}
