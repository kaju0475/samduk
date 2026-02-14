'use client';

import { Paper, Title, Text, SimpleGrid, Group, Button, Stack, FileButton, Table, ScrollArea, LoadingOverlay } from '@mantine/core';
import { DateInput, DatesProvider } from '@mantine/dates';
import { IconDownload, IconUpload, IconFileSpreadsheet, IconCalendar, IconAlertTriangle } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import 'dayjs/locale/ko';

import { formatExpiryDate } from '@/app/utils/display';

type ActionType = 'IMPORT' | 'EXPORT';
type DataType = 'CYLINDER' | 'CUSTOMER' | 'USER' | 'DELIVERY' | 'CHARGING' | 'INSPECTION' | 'INVENTORY' | 'LEDGER';

interface DataModule {
    id: DataType;
    label: string;
    description: string;
    supportsImport: boolean;
    supportsExport: boolean;
}

const MODULES: DataModule[] = [
    { id: 'CYLINDER', label: '용기 관리', description: '용기 대장 및 상세 정보', supportsImport: true, supportsExport: true },
    { id: 'CUSTOMER', label: '거래처 관리', description: '거래처 주소록 및 단가', supportsImport: true, supportsExport: true },
    { id: 'USER', label: '사용자 관리', description: '직원 및 작업자 명단', supportsImport: true, supportsExport: true },
    { id: 'DELIVERY', label: '납품/회수', description: '납품 및 회수 이력', supportsImport: false, supportsExport: true }, 
    { id: 'CHARGING', label: '충전 관리', description: '충전 작업 이력', supportsImport: false, supportsExport: true },
    { id: 'INSPECTION', label: '검사 관리', description: '검사 입고/출고 이력', supportsImport: false, supportsExport: true },
    { id: 'INVENTORY', label: '재고 현황', description: '거래처별 현재 보유량', supportsImport: false, supportsExport: true },
    { id: 'LEDGER', label: '매출 원장', description: '월별 거래 명세서', supportsImport: false, supportsExport: true },
];

export function DataManagement() {
    const [action, setAction] = useState<ActionType | null>(null);
    const [selectedModule, setSelectedModule] = useState<DataType | null>(null);
    const [loading, setLoading] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [file, setFile] = useState<File | null>(null);

    // Date Range State (Default: Last 30 days)
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    useEffect(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        setStartDate(d);
        setEndDate(new Date());
    }, []);

    // Export Logic
    const handleExport = async () => {
        if (!selectedModule) return;
        setLoading(true);
        try {
            // Determine API Endpoint based on Module
            let endpoint = '';
            
            // Date Query
            const startStr = startDate ? startDate.toISOString().split('T')[0] : '';
            const endStr = endDate ? endDate.toISOString().split('T')[0] : '';
            const dateQuery = `?startDate=${startStr}&endDate=${endStr}`;

            switch (selectedModule) {
                case 'CYLINDER': endpoint = '/api/master/cylinders'; break;
                case 'CUSTOMER': endpoint = '/api/master/customers'; break;
                case 'DELIVERY': endpoint = `/api/work/delivery${dateQuery}`; break; 
                case 'LEDGER': endpoint = `/api/work/delivery${dateQuery}`; break; // Ledger uses Delivery Data
                case 'CHARGING': endpoint = `/api/work/charging${dateQuery}`; break;
                case 'INSPECTION': endpoint = `/api/work/inspection/history${dateQuery}`; break;
                case 'INVENTORY': endpoint = '/api/master/inventory'; break; // Snapshot, ignores date
                // Add others later
                default: throw new Error('지원되지 않는 모듈입니다.');
            }

            // Fetch Data
            const res = await fetch(endpoint);
            const json = await res.json();

            if (!json.success) throw new Error(json.message || '데이터 조회 실패');

            let rawData = [];
            if (Array.isArray(json.data)) {
                 rawData = json.data;
            } else if (json.data && Array.isArray(json.data.history)) {
                 // Charging API returns { history: [] }
                 rawData = json.data.history;
            } else if (selectedModule === 'INSPECTION' && json.data) {
                 // Inspection History returns { outbound: [], inbound: [] }
                 // Need to merge
                 const outbound = (json.data.outbound || []).map((i: { timestamp: string; [key: string]: unknown }) => ({ ...i, type: '검사출고' }));
                 const inbound = (json.data.inbound || []).map((i: { timestamp: string; [key: string]: unknown }) => ({ ...i, type: '검사입고' }));
                 rawData = [...outbound, ...inbound].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            } else {
                 rawData = [];
            }

            // Process Data for Korean Headers
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = rawData.map((item: any) => {
                // Mapping Logic (To be expanded)
                if (selectedModule === 'CYLINDER') {
                    return {
                        '일련번호': item.serialNumber,
                        '가스종류': item.gasType,
                        '용량': item.capacity,
                        '소유자': item.owner,
                        '상태': item.status, 
                        '현재위치': item.currentHolderId,
                        '충전기한': formatExpiryDate(item.chargingExpiryDate),
                    };
                }
                else if (selectedModule === 'CUSTOMER') {
                     return {
                        '거래처명': item.name,
                        '구분': item.type === 'BUSINESS' ? '사업자' : '개인',
                        '사업자번호': item.businessNumber,
                        '대표자': item.representative,
                        '전화번호': item.phone,
                        '주소': item.address,
                    };
                }
                else if (selectedModule === 'DELIVERY' || selectedModule === 'LEDGER') {
                    return {
                        '날짜': item.date,
                        '구분': item.type, // 납품, 회수
                        '거래처': item.customer,
                        '용기번호': item.cylinderId,
                        '가스종류': item.gas,
                        '작업자': item.worker,
                        '비고': item.memo
                    };
                }
                else if (selectedModule === 'CHARGING') {
                    return {
                        '날짜': item.date,
                        '작업': item.type, // 충전시작, 충전완료
                        '용기번호': item.cylinderId,
                        '가스종류': item.gasType,
                        '작업자': item.workerId,
                        '비고': item.memo
                    };
                }
                else if (selectedModule === 'INSPECTION') {
                     return {
                        '시각': item.timestamp ? new Date(item.timestamp).toLocaleString('ko-KR') : '-',
                        '구분': item.type,
                        '용기번호': item.cylinderId,
                        '가스종류': item.gasType,
                        '작업자': item.workerId,
                        '비고': item.memo
                     };
                }
                else if (selectedModule === 'INVENTORY') {
                    // Inventory Stats structure
                    return {
                        '거래처명': item.customerName,
                        '구분': item.customerType,
                        '보유수량': item.total,
                        // Expand details or just summary? 
                        // For basic export, summary is fine. 
                        // If user needs details, we might need flattening.
                        // Let's dump inventory map as string for now or just main columns
                        '산소': item.inventory['산소'] || 0,
                        '질소': item.inventory['질소'] || 0,
                        '아르곤': item.inventory['아르곤'] || 0,
                        '탄산': item.inventory['탄산'] || 0,
                    };
                }
                // Fallback
                return item;
            });

            // Generate Excel
            const wb = XLSX.utils.book_new();



            // [Fix] Standardize Export Format for Seamless Import
            // Remove "Report Style" Title Row. Start with Headers at Row 1 (A1).
            const ws = XLSX.utils.json_to_sheet(data);

            // 3. Configure Sheet Properties (AutoFilter, Column Widths)
            
            // Calculate Range
            const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
            const colCount = range.e.c + 1;

            // Apply AutoFilter to Header Row (Row 0 -> Index 0)
            ws['!autofilter'] = { 
                ref: XLSX.utils.encode_range({ 
                    s: { r: 0, c: 0 }, 
                    e: { r: 0, c: colCount - 1 } 
                }) 
            };

            // 5. Auto-width columns (Simple heuristic)
            const wscols = [];
            for (let i = 0; i < colCount; i++) {
                wscols.push({ wch: 20 }); // Default width 20 chars
            }
            // Adjust specific columns if possible? For now, uniform width is better than default.
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, "Data");
            
            // Download
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `${selectedModule}_${dateStr}.xlsx`);

            notifications.show({ title: '완료', message: '데이터 내보내기 성공 (필터 적용됨)', color: 'green' });

        } catch (error) {
             console.error(error);
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             const err = error as any;
             notifications.show({ title: '오류', message: err.message || '오류가 발생했습니다', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    // Import Preview Logic
    const handleFileChange = async (payload: File | null) => {
        if (!payload) return;
        setFile(payload);
        setLoading(true);
        try {
            const data = await payload.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // [Fix] Smart Header Detection
            // 1. Read as Array of Arrays to scan for headers
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
            let headerRowIndex = 0;
            
            // 2. Scan first 10 rows for known header keywords
            const knownHeaders = [
                '거래처명', '거래처', '상호명', '상호', 'Name', 'Customer Name', 'name', 'customer', // Name
                '사업자번호', '사업자등록번호', 'Business Number', 'businessNumber', // ID
                '일련번호', 'Serial Number', '용기번호', 'serialNumber' // Cylinder
            ];
            
            for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
                const row = rawRows[i];
                // Check if any cell in this row matches a known header
                const hasMatch = row.some(cell => 
                    typeof cell === 'string' && knownHeaders.includes(cell.trim())
                );
                
                if (hasMatch) {
                    headerRowIndex = i;
                    break;
                }
            }

            // 3. Read with correct range
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
            
            setPreviewData(jsonData);
            
            if (jsonData.length === 0) {
                 notifications.show({ title: '주의', message: '데이터가 없습니다. (헤더만 존재하거나 빈 파일)', color: 'yellow' });
            } else {
                 notifications.show({ title: '파일 로드', message: `${jsonData.length}건의 데이터를 읽었습니다. (헤더: ${headerRowIndex + 1}행)`, color: 'blue' });
            }

        } catch (error) {
            console.error(error);
            notifications.show({ title: '오류', message: '파일을 읽을 수 없습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    // [Helper] Fuzzy Key Matcher to handle whitespace in Excel Headers
    // e.g. row[" 거래처 명 "] -> matched by "거래처명"
    const getValue = (row: Record<string, unknown>, keys: string[]) => {
        const rowKeys = Object.keys(row);
        
        // Normalize helper: Remove all spaces, lowercase
        const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();

        for (const k of keys) {
            const target = normalize(k);
            
            // 1. Find matching key in row
            const foundKey = rowKeys.find(rk => normalize(rk) === target);
            
            if (foundKey && row[foundKey] !== undefined) {
                // Return trimmed value if string
                const val = row[foundKey];
                return typeof val === 'string' ? val.trim() : val;
            }
        }
        return undefined;
    };

    const handleImportCommit = async () => {
        if (!selectedModule || previewData.length === 0) {
             if (previewData.length === 0) notifications.show({ title: '오류', message: '가져올 데이터가 없습니다.', color: 'red' });
             return;
        }
        setLoading(true);

        try {
            let endpoint = '';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let mappedData: any[] = [];

            if (selectedModule === 'CYLINDER') {
                endpoint = '/api/master/cylinders/import';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                mappedData = previewData.map((row: any) => ({
                    serialNumber: getValue(row, ['일련번호', '용기번호', 'Serial Number', 'serialNumber', 'Serial']),
                    gasType: getValue(row, ['가스종류', 'Gas', 'Gas Type']),
                    capacity: getValue(row, ['용량', 'Capacity']),
                    owner: getValue(row, ['소유자', 'Owner']),
                    chargingExpiryDate: getValue(row, ['충전기한', 'Expiry Date']),
                }));
            } else if (selectedModule === 'CUSTOMER') {
                endpoint = '/api/master/customers/import';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                mappedData = previewData.map((row: any) => ({
                    name: getValue(row, ['거래처명', '거래처', '상호명', '상호', 'Name', 'name', 'Customer Name']),
                    type: (getValue(row, ['구분', 'Type']) === '개인' || getValue(row, ['구분', 'Type']) === 'INDIVIDUAL') ? 'INDIVIDUAL' : 'BUSINESS', 
                    businessNumber: getValue(row, ['사업자번호', '사업자등록번호', 'Business Number', 'businessNumber', 'Registration Number']),
                    representative: getValue(row, ['대표자', '대표자명', 'Representative', 'Owner']),
                    phone: getValue(row, ['전화번호', '연락처', '휴대폰', 'Phone', 'Tel', 'Mobile']),
                    address: getValue(row, ['주소', 'Address', 'Location']),
                }));
                
                // Client-side validation
                const validRows = mappedData.filter(d => d.name);
                if (validRows.length === 0) {
                     notifications.show({ title: '오류', message: '데이터 매핑 실패. 엑셀 헤더를 확인해주세요. (값 없음)', color: 'red' });
                     setLoading(false);
                     return;
                }
            } else {
                 notifications.show({ title: '알림', message: '이 모듈은 아직 가져오기를 지원하지 않습니다.', color: 'yellow' });
                 setLoading(false);
                 return;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: mappedData })
            });

            const json = await res.json();

            if (json.success) {
                // Determine color based on message content safely? 
                // Or just trust the backend.
                // If message says "Imported 0", warn the user.
                const isZeroSuccess = json.message && (json.message.includes('Imported 0') || json.message.includes('성공: 0'));
                notifications.show({ 
                    title: isZeroSuccess ? '알림' : '성공', 
                    message: json.message || '데이터 가져오기 성공', 
                    color: isZeroSuccess ? 'orange' : 'green' 
                });
                // Reset
                setPreviewData([]);
                setFile(null);
            } else {
                notifications.show({ title: '실패', message: json.message || '데이터 가져오기 실패', color: 'red' });
            }

        } catch (error) {
            console.error(error);
            notifications.show({ title: '오류', message: '서버 통신 중 오류가 발생했습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };


    return (
        <Stack gap="xl">
            <Group justify="space-between" align="center">
                <div>
                     <Title order={3} c="white">데이터 관리 센터 (Data Center)</Title>
                     <Text c="dimmed" size="sm">시스템 데이터를 엑셀로 내보내거나 가져옵니다.</Text>
                </div>
            </Group>

            {/* 1. Select Action */}
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <Paper 
                    p="md" 
                    radius="md" 
                    style={{ 
                        cursor: 'pointer',
                        backgroundColor: action === 'IMPORT' ? 'rgba(51, 154, 240, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: action === 'IMPORT' ? '1px solid #339AF0' : '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.2s'
                    }}
                    onClick={() => { setAction('IMPORT'); setSelectedModule(null); setPreviewData([]); setFile(null); }}
                >
                    <Group>
                        <IconUpload size={28} color={action === 'IMPORT' ? '#339AF0' : 'gray'} />
                        <div>
                            <Text size="md" fw={700} c={action === 'IMPORT' ? 'white' : 'dimmed'}>가져오기 (Import)</Text>
                            <Text size="xs" c="dimmed">엑셀 파일을 업로드하여 데이터를 등록합니다.</Text>
                        </div>
                    </Group>
                </Paper>

                <Paper 
                    p="md" 
                    radius="md" 
                    style={{ 
                        cursor: 'pointer',
                        backgroundColor: action === 'EXPORT' ? 'rgba(81, 207, 102, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: action === 'EXPORT' ? '1px solid #51CF66' : '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.2s'
                    }}
                    onClick={() => { setAction('EXPORT'); setSelectedModule(null); setPreviewData([]); setFile(null); }}
                >
                    <Group>
                        <IconDownload size={28} color={action === 'EXPORT' ? '#51CF66' : 'gray'} />
                        <div>
                            <Text size="md" fw={700} c={action === 'EXPORT' ? 'white' : 'dimmed'}>내보내기 (Export)</Text>
                            <Text size="xs" c="dimmed">시스템 데이터를 엑셀 파일로 다운로드합니다.</Text>
                        </div>
                    </Group>
                </Paper>

                <Paper 
                    p="md" 
                    radius="md" 
                    style={{ 
                        cursor: 'pointer',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.2s'
                    }}
                    onClick={async () => {
                         if (!confirm('마지막 납품일로부터 24개월이 경과한 용기를 \n[분실(미아)] 상태로 일괄 변경하시겠습니까?')) return;
                         
                         setLoading(true);
                         try {
                              const res = await fetch('/api/batch/lost-detection', { method: 'POST' });
                              const json = await res.json();
                              if (json.success) {
                                  notifications.show({ title: '완료', message: json.message, color: 'blue' });
                              } else {
                                  notifications.show({ title: '오류', message: json.message, color: 'red' });
                              }
                         } catch {
                              notifications.show({ title: '오류', message: '서버 통신 오류', color: 'red' });
                         } finally {
                              setLoading(false);
                         }
                    }}
                >
                    <Group>
                        {/* Icon for Lost/Search */}
                        <IconCalendar size={28} color="orange" />
                        <div>
                            <Text size="md" fw={700} c="dimmed">미아 용기 일괄 분류</Text>
                            <Text size="xs" c="dimmed">24개월 이상 미회수 용기 자동 분류</Text>
                        </div>
                    </Group>
                </Paper>


                {/* System Initialization (Production Reset) */}
                <Paper 
                    p="md" 
                    radius="md" 
                    style={{ 
                        cursor: 'pointer',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        border: '1px solid #FF6B6B',
                        transition: 'all 0.2s'
                    }}
                    onClick={async () => {
                         if (!confirm('경고: 시스템을 [실사용(Production)] 모드로 초기화하시겠습니까?\\n\\n이 작업은 모든 거래처, 용기, 이력을 삭제하고 [관리자 계정]만 남깁니다.\\n지워진 데이터는 복구할 수 없습니다 (자동 백업됨).')) return;
                         
                         // Double Confirm
                         const input = prompt("초기화를 진행하려면 '초기화'라고 입력하세요.");
                         if (input !== '초기화') return;

                         setLoading(true);
                         try {
                              const res = await fetch('/api/system/initialize', { 
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'INITIALIZE_PRODUCTION', confirm: true })
                              });
                              
                              // Check status manually since fetch doesn't throw on 500
                              if (!res.ok) {
                                  const text = await res.text();
                                  throw new Error(res.status === 500 ? 'Server Error (Try Restarting Server)' : text);
                              }

                              const json = await res.json();
                              if (json.success) {
                                  notifications.show({ title: '초기화 완료', message: '시스템이 초기화되었습니다. 페이지를 새로고침합니다.', color: 'red' });
                                  setTimeout(() => window.location.reload(), 2000);
                              } else {
                                  notifications.show({ title: '오류', message: json.message, color: 'red' });
                              }
                         } catch (e: unknown) {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const err = e as any;
                              notifications.show({ title: '오류', message: err.message || '초기화 실패', color: 'red' });
                         } finally {
                              setLoading(false);
                         }
                    }}
                >
                    <Group>
                        <IconAlertTriangle size={28} color="#FF6B6B" />
                        <div>
                            <Text size="md" fw={700} c="#FF6B6B">시스템 초기화</Text>
                            <Text size="xs" c="dimmed">운영 데이터 전체 삭제 (실사용 전환)</Text>
                        </div>
                    </Group>
                </Paper>
            </SimpleGrid>

            {/* 2. Select Module */}
            {action && (
                <Stack gap="xs">
                     <Text size="md" fw={700} c="white">대상 선택</Text>
                     <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
                        {MODULES.map(mod => {
                            const disabled = (action === 'IMPORT' && !mod.supportsImport) || (action === 'EXPORT' && !mod.supportsExport);
                            return (
                                <Paper 
                                    key={mod.id}
                                    p="sm"
                                    radius="md"
                                    style={{
                                        cursor: disabled ? 'not-allowed' : 'pointer',
                                        opacity: disabled ? 0.3 : 1,
                                        backgroundColor: selectedModule === mod.id ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                        border: selectedModule === mod.id ? '1px solid white' : '1px solid rgba(255, 255, 255, 0.05)'
                                    }}
                                    onClick={() => !disabled && setSelectedModule(mod.id)}
                                >
                                    <Stack gap={2} align="center">
                                        <IconFileSpreadsheet size={20} color="gray" />
                                        <Text fw={600} c="white" size="sm">{mod.label}</Text>
                                        <Text size="10px" c="dimmed" ta="center">{mod.description}</Text>
                                    </Stack>
                                </Paper>
                            );
                        })}
                     </SimpleGrid>
                </Stack>
            )}

            {/* 3. Execution Area */}
            {selectedModule && (
                <Paper p="xl" radius="md" bg="#1A1B1E" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                     <Stack>
                        <Group justify="space-between" align="end">
                            <Stack gap="xs">
                                <Text size="lg" fw={700} c="white">작업 실행: {MODULES.find(m => m.id === selectedModule)?.label}</Text>
                                {/* Date Range Picker for Work History Modules */}
                                {action === 'EXPORT' && ['DELIVERY', 'CHARGING', 'INSPECTION', 'INVENTORY', 'LEDGER'].includes(selectedModule) && (
                                    <Group align="flex-end">
                                        <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] }}>
                                            <Group gap="xs" align="center">
                                                <DateInput
                                                    value={startDate}
                                                    onChange={(date) => {
                                                        if (typeof date === 'string') setStartDate(new Date(date));
                                                        else setStartDate(date);
                                                    }}
                                                    valueFormat="YYYY. MM. DD."
                                                    placeholder="시작일"
                                                    popoverProps={{ withinPortal: true, position: 'bottom-start' }}
                                                    inputMode="none"
                                                    leftSection={<IconCalendar size={18} />}
                                                    locale="ko"
                                                    size="sm"
                                                    w={140}
                                                    styles={{
                                                        input: {
                                                            backgroundColor: '#1A1B1E', 
                                                            border: '1px solid #373A40',
                                                            color: 'white',
                                                            fontSize: '14px',
                                                            textAlign: 'center'
                                                        }
                                                    }}
                                                />
                                                <Text c="dimmed">~</Text>
                                                <DateInput
                                                    value={endDate}
                                                    onChange={(date) => {
                                                        if (typeof date === 'string') setEndDate(new Date(date));
                                                        else setEndDate(date);
                                                    }}
                                                    valueFormat="YYYY. MM. DD."
                                                    placeholder="종료일"
                                                    popoverProps={{ withinPortal: true, position: 'bottom-start' }}
                                                    inputMode="none"
                                                    leftSection={<IconCalendar size={18} />}
                                                    locale="ko"
                                                    size="sm"
                                                    w={140}
                                                    styles={{
                                                        input: {
                                                            backgroundColor: '#1A1B1E', 
                                                            border: '1px solid #373A40',
                                                            color: 'white',
                                                            fontSize: '14px',
                                                            textAlign: 'center'
                                                        }
                                                    }}
                                                />
                                            </Group>
                                        </DatesProvider>
                                    </Group>
                                )}
                            </Stack>
                            
                            {action === 'EXPORT' ? (
                                <Button 
                                    leftSection={<IconDownload size={18} />} 
                                    color="green" 
                                    onClick={handleExport} 
                                    loading={loading}
                                >
                                    엑셀 다운로드
                                </Button>
                            ) : (
                                <Group>
                                     <FileButton onChange={handleFileChange} accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel">
                                        {(props) => <Button {...props} variant="light" leftSection={<IconUpload size={18} />}>파일 선택</Button>}
                                      </FileButton>
                                      {file && <Text size="sm" c="dimmed">{file.name}</Text>}
                                      
                                      {previewData.length > 0 && (
                                          <Button onClick={handleImportCommit} color="blue" size="sm" variant="filled">
                                              데이터 반영하기 ({previewData.length}건)
                                          </Button>
                                      )}
                                </Group>
                            )}
                        </Group>

                        {/* Preview for Import */}
                        {action === 'IMPORT' && previewData.length > 0 && (
                            <Stack mt="md">
                        <ScrollArea h={300} type="always">
                                    <Table withTableBorder withColumnBorders variant="vertical">
                                        <Table.Thead>
                                            <Table.Tr>
                                                {Object.keys(previewData[0]).map(key => (
                                                    <Table.Th key={key}>{key}</Table.Th>
                                                ))}
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {previewData.slice(0, 10).map((row, i) => (
                                                <Table.Tr key={i}>
                                                    {Object.values(row).map((val: unknown, j) => (
                                                        <Table.Td key={j}>{String(val)}</Table.Td>
                                                    ))}
                                                </Table.Tr>
                                            ))}
                                        </Table.Tbody>
                                    </Table>
                                    {previewData.length > 10 && <Text c="dimmed" ta="center" size="xs" mt="xs">... 외 {previewData.length - 10}건</Text>}
                                </ScrollArea>
                            </Stack>
                        )}
                        <LoadingOverlay visible={loading} />
                     </Stack>
                </Paper>
            )}

        </Stack>
    );
}
