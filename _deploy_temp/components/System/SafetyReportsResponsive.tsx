
import { useState, useEffect } from 'react';
import { Modal, Card, Text, Group, Tabs, Button, Table, Badge, Grid, Select, NumberInput, Box, Stack, useMantineTheme, Drawer, Divider, ScrollArea, ThemeIcon, Autocomplete, NativeSelect, ComboboxItem } from '@mantine/core';
import { DateInput, DatesProvider } from '@mantine/dates';
import { IconFileTypeXls, IconSearch, IconChevronRight, IconChevronDown, IconFilter, IconFileTypePdf, IconBuildingSkyscraper, IconRobot } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import { ReportCharts } from './ReportCharts';
// [FIX] Removed unused generatePDFReport import
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import React from 'react';

import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';
import { CustomerDetailModal } from '@/app/master/customers/CustomerDetailModal';
import { CylinderHistoryModal } from '@/components/History/CylinderHistoryModal';
import { Customer } from '@/lib/types';
import { groupHistoryItems } from '@/lib/utils/grouping';

interface SafetyReportsResponsiveProps {
    opened: boolean;
    onClose: () => void;
}

export interface ReportItem {
    id?: string;
    serial?: string;        // Supply/Supply items
    serialNumber?: string;  // Long-term/Abnormal
    cylinderId?: string;    // Traceability
    
    // Common
    date?: string;
    type?: string;
    customer?: string;
    customerName?: string;
    location?: string;
    worker?: string;
    item?: string;
    gas?: string;
    gasType?: string;
    deliveryDate?: string; // Long-term
    collectionDate?: string;
    chargeDate?: string;
    returner?: string;
    
    // Status/Metrics
    status?: string;
    quantity?: number;
    daysHeld?: number;
    description?: string;
    
    // Hierarchy (Traceability)
    children?: ReportItem[];
}

// API Response Types
interface CustomerApiResponse {
    id: string;
    name: string;
    address?: string;
    representative?: string;
    manager?: string;
}

interface CylinderApiResponse {
    serialNumber: string;
    [key: string]: unknown;
}

// Excel Export Types
interface ExcelCycleData {
    '용기번호': string;
    '납품일자': string;
    '거래처': string;
    '가스종류': string;
    '충전일자': string;
    '회수일자': string;
    '현재상태': string;
    '작업자': string;
}

interface ExcelSupplyData {
    '일자': string;
    '구분': string;
    '거래처': string;
    '품목': string;
    '용기번호': string;
    '작업자': string;
}

interface ExcelLongTermData {
    '거래처': string;
    '용기번호': string;
    '가스종류': string;
    '최종납품일': string;
    '경과일수': string;
}

type ExcelExportData = ExcelCycleData | ExcelSupplyData | ExcelLongTermData;

// Cycle Analysis Types
interface CycleData {
    serial: string;
    gasType?: string;
    chargeDate?: string;
    deliveryDate?: string;
    collectionDate?: string;
    customer?: string;
    worker?: string;
    returner?: string;
    status?: string;
}


// Props Interfaces
interface ReportCardProps {
    item: ReportItem;
    activeTab: string | null;
    expandedItems: Set<string>;
    onSerialClick: (serial: string) => void;
    onToggleExpand: (id: string) => void;
}

interface DesktopTableProps {
    data: ReportItem[];
    activeTab: string | null;
    onCustomerClick: (name: string) => void;
    onSerialClick: (serial: string) => void;
    onFixAction: (serial: string, action: string) => void;
}

interface ReportContentProps {
    data: ReportItem[];
    isMobile: boolean;
    activeTab: string | null;
    expandedItems: Set<string>;
    onSerialClick: (serial: string) => void;
    onCustomerClick: (name: string) => void;
    onFixAction: (serial: string, action: string) => void;
    onToggleExpand: (id: string) => void;
}

// 1. ReportCard Component (Extracted)
const ReportCard = React.memo(({ item, activeTab, expandedItems, onSerialClick, onToggleExpand }: ReportCardProps) => {
    const theme = useMantineTheme();
    
    const cardStyle = {
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        boxShadow: theme.shadows.lg,
        transition: 'all 0.2s ease',
        '&:active': { transform: 'scale(0.98)' }
    };

    if (activeTab === 'long-term') {
        return (
            <Card padding="lg" radius="lg" withBorder mb="md" style={cardStyle}>
                <Group justify="space-between" mb="sm">
                    <Stack gap={2}>
                        <Text size="xs" fw={700} c="blue.4" tt="uppercase" lts={1}>거래처</Text>
                        <Text fw={800} size="lg" c="white" truncate>{item.customerName}</Text>
                    </Stack>
                    <Badge 
                        size="lg"
                        variant="gradient" 
                        gradient={{ from: (item.daysHeld || 0) > 180 ? 'red' : 'orange', to: 'yellow' }}
                    >
                        {item.daysHeld || 0}일 경과
                    </Badge>
                </Group>
                
                <Divider color="rgba(255,255,255,0.08)" mb="sm" />
                
                <Grid gutter="md">
                    <Grid.Col span={6}>
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed" fw={600}>용기번호</Text>
                            <Button 
                                variant="light" 
                                size="compact-sm" 
                                onClick={() => onSerialClick(item.serialNumber || '')}
                                leftSection={<IconSearch size={14} />}
                                radius="md"
                            >
                                {item.serialNumber}
                            </Button>
                        </Stack>
                    </Grid.Col>
                    <Grid.Col span={6}>
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed" fw={600}>가스종류</Text>
                            <Badge variant="dot" color="blue" size="md">{item.gasType}</Badge>
                        </Stack>
                    </Grid.Col>
                    <Grid.Col span={12}>
                        <Group justify="space-between">
                            <Stack gap={2}>
                                <Text size="xs" c="dimmed" fw={600}>최종 납품일</Text>
                                <Text fw={600} size="sm" c="white">{item.deliveryDate ? dayjs(item.deliveryDate).format('YYYY-MM-DD') : '-'}</Text>
                            </Stack>
                            <IconChevronRight size={20} color="gray" style={{ opacity: 0.5 }} />
                        </Group>
                    </Grid.Col>
                </Grid>
            </Card>
        );
    }
    
    if (activeTab === 'traceability') {
        const hasChildren = item.children && item.children.length > 0;
        const keyId = String(item.id || `trace-${item.cylinderId}`);
        const isExpanded = expandedItems.has(keyId);

        return (
            <Card padding="lg" radius="lg" withBorder mb="md" style={cardStyle}>
                <Group justify="space-between" mb="xs">
                    <Stack gap={2}>
                        <Text size="xs" c="dimmed" fw={600}>용기번호</Text>
                        <Text fw={800} size="lg" c="blue.3" onClick={() => onSerialClick(item.cylinderId || '')} style={{ textDecoration: 'underline' }}>{item.cylinderId}</Text>
                    </Stack>
                    <Badge 
                        size="lg"
                        radius="sm"
                        variant="filled" 
                        color={item.type === '납품' ? 'blue' : 'orange'}
                    >
                        {item.type}
                    </Badge>
                </Group>
                
                <Box p="sm" bg="rgba(255,255,255,0.03)" style={{ borderRadius: 12 }}>
                    <Group justify="space-between" align="center">
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed">장소/거래처</Text>
                            <Text size="sm" fw={600} c="white">{item.location}</Text>
                        </Stack>
                        <Stack gap={2} align="flex-end">
                            <Text size="xs" c="dimmed">기록일시</Text>
                            <Text size="xs" fw={500} c="gray.4">{dayjs(item.date).format('YYYY-MM-DD HH:mm')}</Text>
                        </Stack>
                    </Group>
                </Box>

                {hasChildren && (
                    <>
                        <Button 
                            variant="subtle" 
                            size="sm" 
                            fullWidth 
                            mt="md"
                            onClick={() => onToggleExpand(keyId)} 
                            rightSection={isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                            color="blue.3"
                            style={{ border: '1px solid rgba(77, 171, 245, 0.2)' }}
                            radius="md"
                        >
                            번들 구성 용기 ({item.children?.length || 0}개)
                        </Button>
                        {isExpanded && (
                            <Stack gap={4} mt="xs" p="xs" bg="rgba(0,0,0,0.3)" style={{ borderRadius: 12 }}>
                                {item.children?.map((child: ReportItem, idx: number) => (
                                    <Group key={idx} justify="space-between" py={8} px="sm" style={{ borderBottom: idx < (item.children?.length || 0) - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                        <Text size="sm" fw={600} c="blue.2" onClick={() => onSerialClick(child.cylinderId || '')}>{child.cylinderId}</Text>
                                        <Badge variant="dot" size="xs" color="gray">{dayjs(child.date).format('HH:mm')}</Badge>
                                    </Group>
                                ))}
                            </Stack>
                        )}
                    </>
                )}
            </Card>
        );
    }

    // Supply Tab
    if (activeTab === 'supply') {
        return (
            <Card padding="lg" radius="lg" withBorder mb="md" style={cardStyle}>
                <Group justify="space-between" mb="sm">
                    <Stack gap={2}>
                            <Text size="xs" fw={700} c="blue.4" tt="uppercase" lts={1}>일자</Text>
                            <Text fw={800} size="lg" c="white">{dayjs(item.date).format('YYYY-MM-DD')}</Text>
                    </Stack>
                    <Badge 
                        size="lg"
                        variant="filled" 
                        color={item.type === '납품' ? 'blue' : 'red'}
                    >
                        {item.type}
                    </Badge>
                </Group>
                
                <Divider color="rgba(255,255,255,0.08)" mb="sm" />
                
                <Grid gutter="md">
                    <Grid.Col span={12}>
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed" fw={600}>거래처</Text>
                            <Text fw={600} size="sm" c="white" truncate>{item.customerName || item.customer}</Text>
                        </Stack>
                    </Grid.Col>
                    <Grid.Col span={6}>
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed" fw={600}>품목</Text>
                            <Badge variant="dot" color="blue" size="md">{item.item}</Badge>
                        </Stack>
                    </Grid.Col>
                    <Grid.Col span={6}>
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed" fw={600}>용기번호</Text>
                            <Button 
                                variant="light" 
                                size="compact-sm" 
                                onClick={() => onSerialClick(item.serial || '')}
                                leftSection={<IconSearch size={14} />}
                                radius="md"
                            >
                                {item.serial}
                            </Button>
                        </Stack>
                    </Grid.Col>
                    <Grid.Col span={12}>
                            <Group justify="space-between">
                            <Stack gap={2}>
                                <Text size="xs" c="dimmed" fw={600}>작업자</Text>
                                <Text fw={500} size="sm" c="gray.4">{item.worker || '-'}</Text>
                            </Stack>
                            <IconChevronRight size={20} color="gray" style={{ opacity: 0.5 }} />
                        </Group>
                    </Grid.Col>
                </Grid>
            </Card>
        );
    }
    return null;
});
ReportCard.displayName = 'ReportCard';

// 2. DesktopTable Component (Extracted)
const DesktopTable = React.memo(({ data, activeTab, onCustomerClick, onSerialClick, onFixAction }: DesktopTableProps) => {
    return (
        <Table stickyHeader striped highlightOnHover>
            <Table.Thead>
                <Table.Tr>
                    {activeTab === 'long-term' && <><Table.Th>거래처</Table.Th><Table.Th>용기번호</Table.Th><Table.Th>가스</Table.Th><Table.Th>납품일</Table.Th><Table.Th>경과일</Table.Th></>}
                    {activeTab === 'abnormal' && <><Table.Th>용기번호</Table.Th><Table.Th>유형</Table.Th><Table.Th>상세내용</Table.Th><Table.Th>조치</Table.Th></>}
                    {activeTab === 'traceability' && <><Table.Th>일시</Table.Th><Table.Th>구분</Table.Th><Table.Th>용기번호</Table.Th><Table.Th>장소</Table.Th><Table.Th>작업자</Table.Th></>}
                    {activeTab === 'supply' && <><Table.Th>일시</Table.Th><Table.Th>구분</Table.Th><Table.Th>품목</Table.Th><Table.Th>용기번호</Table.Th><Table.Th>수량</Table.Th></>}
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {data.map((item, idx) => (
                    <Table.Tr key={idx}>
                        {activeTab === 'long-term' && (
                            <>
                                <Table.Td onClick={() => onCustomerClick(item.customerName || '')} style={{ cursor: 'pointer' }} c="white">{item.customerName}</Table.Td>
                                <Table.Td onClick={() => onSerialClick(item.serialNumber || '')} style={{ cursor: 'pointer' }} c="blue.3">{item.serialNumber}</Table.Td>
                                <Table.Td c="dimmed">{item.gasType}</Table.Td>
                                <Table.Td c="dimmed">{item.deliveryDate ? dayjs(item.deliveryDate).format('YYYY-MM-DD') : '-'}</Table.Td>
                                <Table.Td><Badge color={(item.daysHeld || 0) > 180 ? 'red' : 'yellow'}>{item.daysHeld || 0}</Badge></Table.Td>
                            </>
                        )}
                        {activeTab === 'supply' && (
                            <>
                                <Table.Td c="dimmed">{dayjs(item.date).format('YYYY-MM-DD')}</Table.Td>
                                <Table.Td c="white">{item.type}</Table.Td>
                                <Table.Td c="white">{item.item}</Table.Td>
                                <Table.Td onClick={() => onSerialClick(item.serial || '')} style={{ cursor: 'pointer' }} c="blue.3">{item.serial}</Table.Td>
                                <Table.Td c="white" fw={700}>{item.quantity}</Table.Td>
                            </>
                        )}
                        {activeTab === 'abnormal' && (
                            <>
                                <Table.Td style={{ cursor: 'pointer' }} c="red.3" onClick={() => onSerialClick(item.serialNumber || '')}>{item.serialNumber}</Table.Td>
                                <Table.Td c="white" fw={700}>{item.type}</Table.Td>
                                <Table.Td c="dimmed">{item.description}</Table.Td>
                                <Table.Td>
                                    <Group gap={5}>
                                        <Button size="xs" color="orange" variant="light" onClick={() => onFixAction(item.serialNumber || '', 'FORCE_RETURN')}>강제회수</Button>
                                        <Button size="xs" color="gray" variant="light" onClick={() => onFixAction(item.serialNumber || '', 'MARK_LOST')}>분실처리</Button>
                                    </Group>
                                </Table.Td>
                            </>
                        )}
                        {activeTab === 'traceability' && (
                            <>
                                <Table.Td c="dimmed">{dayjs(item.date).format('MM-DD HH:mm')}</Table.Td>
                                <Table.Td c="white">{item.type}</Table.Td>
                                <Table.Td onClick={() => onSerialClick(item.cylinderId || '')} style={{ cursor: 'pointer' }} c="blue.3">
                                    {item.cylinderId} {(item.children?.length || 0) > 0 && `(+${item.children?.length})`}
                                </Table.Td>
                                <Table.Td c="dimmed">{item.location}</Table.Td>
                                <Table.Td c="dimmed">{item.worker}</Table.Td>
                            </>
                        )}
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );
});
DesktopTable.displayName = 'DesktopTable';

// 3. ReportContent Component (Extracted)
const ReportContent = React.memo(({ data, isMobile, activeTab, expandedItems, onSerialClick, onCustomerClick, onFixAction, onToggleExpand }: ReportContentProps) => {
    if (data.length === 0) {
        return (
            <Box ta="center" py="xl" c="dimmed">
                <IconSearch size={48} style={{ opacity: 0.3 }} />
                <Text mt="sm">조건을 설정하고 조회 버튼을 눌러주세요.</Text>
            </Box>
        );
    }

    return (
        <Stack>
            <ReportCharts data={data} type={activeTab as 'long-term' | 'abnormal' | 'traceability' | 'supply' | null} />
            
            {isMobile ? (
                <Stack gap="xs">
                    {data.map((item, idx) => (
                            <ReportCard 
                                key={idx} 
                                item={item} 
                                activeTab={activeTab}
                                expandedItems={expandedItems}
                                onSerialClick={onSerialClick}
                                onToggleExpand={onToggleExpand}
                            />
                    ))}
                </Stack>
            ) : (
                <DesktopTable 
                    data={data}
                    activeTab={activeTab}
                    onCustomerClick={onCustomerClick}
                    onSerialClick={onSerialClick}
                    onFixAction={onFixAction}
                />
            )}
        </Stack>
    );
});
ReportContent.displayName = 'ReportContent';

export function SafetyReportsResponsive({ opened, onClose }: SafetyReportsResponsiveProps) {
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
    
    // [UI State]
    const handleClose = useModalBackTrap(opened, onClose, 'safety-reports');
    const [activeTab, setActiveTab] = useState<string | null>('long-term');
    // Drawer also needs back trap to prevent closing parent modal or app
    const [filterDrawerOpen, { open: openFilterDrawer, close: closeFilterDrawer }] = useDisclosure(false);
    const handleDrawerClose = useModalBackTrap(filterDrawerOpen, closeFilterDrawer, 'filter-drawer');

    // [Filter Data]
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
        dayjs().subtract(6, 'month').toDate(), 
        dayjs().toDate()
    ]);
    const [serialSearch, setSerialSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerSearchValue, setCustomerSearchValue] = useState('');
    const [minDays, setMinDays] = useState<number | string>(90);

    // [Report Data]
    const [reportData, setReportData] = useState<ReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<{value: string, label: string, address?: string, manager?: string}[]>([]);
    const [cylinderOptions, setCylinderOptions] = useState<string[]>([]); // For Autocomplete

    // [Detail Modal State]
    const [cylinderModalOpen, { open: openCylinderModal, close: closeCylinderModal }] = useDisclosure(false);
    const [detailModalOpen, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
    const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // [Grouping State for Traceability]
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string | number) => {
        const key = String(id);
        const newSet = new Set(expandedItems);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setExpandedItems(newSet);
    };

    // [Data Handlers]
    useEffect(() => {
        if (opened) {
            // 1. Fetch Customers
            fetch('/api/master/customers')
                .then(res => res.json())
                .then(data => {
                    if (data.success && Array.isArray(data.data)) {
                        const cleanCustomers = data.data.map((c: CustomerApiResponse) => ({ 
                            value: c.id, 
                            label: c.name || '(이름 없음)',
                            address: c.address,
                            manager: c.representative || c.manager 
                        })).filter((c: { value: string; label: string }) => c.value && c.label); // Filter invalid
                        setCustomers(cleanCustomers);
                    }
                })
                .catch(err => console.error("Failed to fetch customers", err));

            // 2. Fetch Cylinders (for Autocomplete) - Limit to recent/active for performance
            // NOTE: Fetching ALL might be heavy. We'll fetch a reasonable limit (e.g. 2000) or assume user searches via API.
            // But User requested "Autocomplete", which implies client-side hints.
            fetch('/api/master/cylinders?pageSize=2000&sortField=updated_at&sortDirection=desc')
                .then(res => res.json())
                .then(data => {
                    if (data.success && Array.isArray(data.data)) {
                        // Extract Serials
                        const serials = data.data.map((row: CylinderApiResponse) => row.serialNumber).filter(Boolean);
                        // Unique
                        setCylinderOptions(Array.from(new Set(serials)));
                    }
                })
                .catch(err => console.error("Failed to fetch cylinders", err));
        }
    }, [opened]);

    // [Performance Optimization] O(1) Lookup Map for Customers
    const customerMap = React.useMemo(() => {
        const map: Record<string, typeof customers[0]> = {};
        customers.forEach(c => {
            map[c.value] = c;
        });
        return map;
    }, [customers]);

    const handleSerialClick = (serial: string) => {
        if (!serial || serial === '-') return;
        setSelectedSerial(serial);
        openCylinderModal();
    };

    const handleCustomerClick = (customerName: string) => {
        if (!customerName || customerName === '-') return;
        const matched = customers.find(c => c.label === customerName);
        if (matched) {
            setSelectedCustomer({ id: matched.value, name: matched.label } as Customer);
            openDetailModal();
        } else {
             notifications.show({ title: '알림', message: '거래처 정보를 찾을 수 없습니다.', color: 'gray' });
        }
    };
    
    // Sync Search Value when External ID changes or Data loads
    useEffect(() => {
        if (customerSearch && customers.length > 0) {
            const matched = customers.find(c => c.value === customerSearch);
            if (matched) setCustomerSearchValue(matched.label);
        }
    }, [customerSearch, customers]);

    const handleSearch = async () => {
        notifications.clean(); // Clear previous toasts
        setLoading(true);
        if (isMobile) closeFilterDrawer(); // Auto close drawer on mobile search
        try {
            const params = new URLSearchParams();
            if (dateRange[0]) params.append('startDate', dayjs(dateRange[0]).format('YYYY-MM-DD'));
            if (dateRange[1]) params.append('endDate', dayjs(dateRange[1]).format('YYYY-MM-DD'));
 
            let url = '';
            if (activeTab === 'long-term') {
                url = '/api/system/reports/long-term';
                if (minDays) params.append('minDays', minDays.toString());
            } else if (activeTab === 'abnormal') {
                url = '/api/system/reports/abnormal';
            } else if (activeTab === 'traceability') {
                url = '/api/system/reports/traceability';
                if (!serialSearch) throw new Error('용기 번호를 입력해주세요.');
                params.append('serial', serialSearch);
            } else if (activeTab === 'supply') {
                url = '/api/system/reports/supply';
                if (!customerSearch) throw new Error('거래처를 선택해주세요.');
                
                
                // [FIX] Customer ID is already in customerSearch (from Select)
                if (customers.some(c => c.value === customerSearch)) {
                    params.append('customerId', customerSearch);
                } else {
                    throw new Error('목록에서 정확한 거래처를 선택해주세요.');
                }
            }

            const res = await fetch(`${url}?${params.toString()}`);
            if (!res.ok) throw new Error('네트워크 응답이 올바르지 않습니다');
            const json = await res.json();
            const data = Array.isArray(json) ? json : (json.data || []);
            
            let processedData = data;
            if (activeTab === 'traceability') processedData = groupHistoryItems(data, 'cylinderId');
            else if (activeTab === 'supply') processedData = groupHistoryItems(data, 'serial');
            
            setReportData(processedData);
            notifications.show({ 
                title: '조회 완료', 
                message: `총 ${data.length}건의 데이터가 조회되었습니다.`, 
                color: data.length > 0 ? 'green' : 'yellow' 
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : '데이터 조회 실패';
            notifications.show({ title: '오류', message: errorMessage, color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleFixAction = async (serial: string, action: string) => {
        if (!confirm(`${serial} 용기에 대해 [${action === 'FORCE_RETURN' ? '강제회수' : '분실처리'}] 조치를 수행하시겠습니까?`)) return;
        
        try {
            const res = await fetch('/api/system/reports/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serialNumber: serial, action })
            });
            const result = await res.json();
            if (res.ok) {
                notifications.show({ title: '처리 완료', message: '조치가 정상적으로 반영되었습니다.', color: 'green' });
                handleSearch(); // Refresh list
            } else {
                throw new Error(result.message);
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
            notifications.show({ title: '처리 실패', message: errorMessage, color: 'red' });
        }
    };

    // [Excel Export Logic]
    const handleExport = () => {
        if (reportData.length === 0) return;

        let exportData: ExcelExportData[] = [];
        let fileName = `Report_${activeTab}_${dayjs().format('YYYYMMDD')}`;

        // Helper to resolve Customer Name from ID if needed
        const getCustName = (str: string | undefined) => {
             if (!str) return '-';
             const foundById = customers.find(c => c.value === str);
             if (foundById) return foundById.label;
             const foundByName = customers.find(c => c.label === str);
             if (foundByName) return foundByName.label;
             return str;
        };

        if (activeTab === 'traceability') {
            // [RESTORED] Lifecycle / Cycle Analysis Logic
            // 1. Flatten Logs first (if grouped)
            const flatLogs = reportData.flatMap(item => [item, ...(item.children || [])]);
            
            // 2. Group by Cylinder
            const cylinders: Record<string, ReportItem[]> = {};
            flatLogs.forEach(log => {
                const cid = log.cylinderId || 'unknown';
                if (!cylinders[cid]) cylinders[cid] = [];
                cylinders[cid].push(log);
            });

            // 3. Build Cycles (Charging -> Delivery -> Collection)
            const cycles: CycleData[] = [];
            
            Object.keys(cylinders).forEach(serial => {
                const logs = cylinders[serial].sort((a, b) => {
                    const tA = a.date ? new Date(a.date).getTime() : 0;
                    const tB = b.date ? new Date(b.date).getTime() : 0;
                    return tA - tB;
                });
                
                let currentCycle: Partial<CycleData> = { serial };

                logs.forEach(log => {
                    // Update Gas Type from any log if missing
                    if (!currentCycle.gasType && (log.gasType || log.gas || (log.item && log.item.includes('가스')))) {
                         currentCycle.gasType = log.gasType || log.gas || '-';
                    }

                    // Start of Cycle (Charging or Stock or Initial State)
                    if (log.type === '충전' || log.type === '충전완료' || log.type === '입고') {
                        if (currentCycle.deliveryDate) {
                            // If we have a previous delivery, close that cycle
                            const isReturned = !!currentCycle.collectionDate;
                            currentCycle.status = isReturned ? '회수완료(종료)' : '사용중';
                            cycles.push(currentCycle as CycleData); 
                            currentCycle = { serial, gasType: log.gasType || log.gas };
                        }
                        currentCycle.chargeDate = log.date;
                    }
                    // Delivery Point
                    else if (log.type === '납품') {
                        // If we already have a delivery date, this might be a new cycle without a charge record
                         if (currentCycle.deliveryDate) {
                              const isReturned = !!currentCycle.collectionDate;
                              currentCycle.status = isReturned ? '회수완료(종료)' : '사용중';
                              cycles.push(currentCycle as CycleData);
                              currentCycle = { serial, gasType: currentCycle.gasType }; // Carry over gas type
                        }
                        currentCycle.deliveryDate = log.date;
                        currentCycle.customer = getCustName(log.customer || log.location);
                        currentCycle.worker = log.worker;
                    }
                    // Collection Point
                    else if (log.type === '회수') {
                         if (currentCycle.collectionDate) {
                              // Double collection? Close and start new?
                              currentCycle.status = '회수완료(종료)';
                              cycles.push(currentCycle as CycleData);
                              currentCycle = { serial, gasType: currentCycle.gasType };
                        }
                        currentCycle.collectionDate = log.date;
                        currentCycle.returner = getCustName(log.customer || log.location);
                    }
                });

                // Push pending last cycle
                if (currentCycle.chargeDate || currentCycle.deliveryDate || currentCycle.collectionDate) {
                    const isReturned = !!currentCycle.collectionDate;
                    const isDelivered = !!currentCycle.deliveryDate;
                    const isCharged = !!currentCycle.chargeDate;

                    let status = '미상';
                    if (isReturned) status = '회수완료(종료)';
                    else if (isDelivered) status = '사용중(납품됨)';
                    else if (isCharged) status = '충전보관';

                    currentCycle.status = status;
                    cycles.push(currentCycle as CycleData);
                }
            });

            // 4. Format for Excel [REORDERED]
            // Request: 용기번호, 납품일자, 거래처, 가스종류, 충전일자, (납품일자), 회수일자, 현재상태
            exportData = cycles.map(c => ({
                '용기번호': c.serial || '-',
                '납품일자': c.deliveryDate ? dayjs(c.deliveryDate).format('YYYY-MM-DD') : '-',
                '거래처': c.customer || '-',
                '가스종류': c.gasType || '-',
                '충전일자': c.chargeDate ? dayjs(c.chargeDate).format('YYYY-MM-DD') : '-',
                '회수일자': c.collectionDate ? dayjs(c.collectionDate).format('YYYY-MM-DD') : '-',
                '현재상태': c.status || '-',
                '작업자': c.worker || '-'
            }));
            fileName = `이력추적_생애주기분석_${dayjs().format('YYYYMMDD')}`;

        } else if (activeTab === 'supply') {
            const fallbackCustomerName = customers.find(c => c.value === customerSearch)?.label;

            exportData = reportData.map(item => ({
                '일자': dayjs(item.date).format('YYYY-MM-DD'),
                '구분': item.type || '-',
                '거래처': item.customerName || getCustName(item.customer || item.location) || fallbackCustomerName || '-',
                '품목': item.item || '-',
                '용기번호': item.serial || '-',
                // [FIX] Removed Quantity
                '작업자': item.worker || '-' // [NEW] Added Worker
            }));
             fileName = `공급대장_${dayjs().format('YYYYMMDD')}`;

        } else if (activeTab === 'long-term') {
            exportData = reportData.map(item => ({
                '거래처': item.customerName || '-',
                '용기번호': item.serialNumber || '-',
                '가스종류': item.gasType || '-',
                '최종납품일': item.deliveryDate ? dayjs(item.deliveryDate).format('YYYY-MM-DD') : '-',
                '경과일수': (item.daysHeld || 0) + '일'
            }));
            fileName = `장기미반납리포트_${dayjs().format('YYYYMMDD')}`;
        }

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        // Add Column Widths
        const wscols = [
            { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ];
        worksheet['!cols'] = wscols;
        // [FIX] Add AutoFilter
        if (exportData.length > 0) {
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
            worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    // [PDF Export Logic - Replaced with HTML2Canvas Download]
    const printRef = React.useRef<HTMLDivElement>(null);

    const handlePDFExport = async () => {
         if (!printRef.current) return;

         const element = printRef.current;
         const fileName = `Report_${activeTab}_${dayjs().format('YYYYMMDD')}.pdf`;

         try {
              const canvas = await html2canvas(element, {
                  scale: 2,
                  logging: false,
                  useCORS: true,
                  backgroundColor: '#ffffff'
              } as Parameters<typeof html2canvas>[1]);

             const imgData = canvas.toDataURL('image/png');

             // 2. Create PDF (Landscape A4)
             // A4 Landscape: 297mm x 210mm
             const pdf = new jsPDF('l', 'mm', 'a4');
             const pdfWidth = pdf.internal.pageSize.getWidth();
             const pdfHeight = pdf.internal.pageSize.getHeight();
             
             const imgWidth = pdfWidth;
             const imgHeight = (canvas.height * imgWidth) / canvas.width;
             
             let heightLeft = imgHeight;
             let position = 0;

             // 3. Add Image to PDF (Handle page breaks if long)
             pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
             heightLeft -= pdfHeight;

             while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
             }
             
             // 4. Save
             pdf.save(fileName);
             
         } catch (error) {
             console.error('PDF Generation Failed', error);
             notifications.show({
                 title: 'PDF 생성 오류',
                 message: '리포트 이미지를 캡처하는 중 문제가 발생했습니다.',
                 color: 'red'
             });
         }
    };

    // [Print Content Component - Rendered Offscreen]
    const printContent = (
        <div ref={printRef} style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '297mm', // Fixed width for A4 Landscape
            padding: '20px',
            backgroundColor: 'white',
            color: 'black',
            zIndex: -1, // Ensure it's behind everything
            pointerEvents: 'none', // Ensure user can't interact
            fontFamily: "'Malgun Gothic', 'Noto Sans KR', sans-serif"
        }}>
             
            <div className="header" style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div className="title" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {activeTab === 'long-term' && '장기 미반납 용기 리포트'}
                    {activeTab === 'traceability' && '용기 이력 추적 리포트'}
                    {activeTab === 'supply' && '공급 대장 리포트'}
                </div>
                
                {/* [FIX] Flexible Header Metadata Layout */}
                <div className="meta" style={{ 
                    fontSize: '12px', 
                    color: '#000', 
                    marginTop: '20px', 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #333',
                    paddingBottom: '5px'
                }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {activeTab === 'traceability' && reportData.length > 0 && (
                           `용기번호: ${
                               reportData[0]?.serial || 
                               reportData[0]?.cylinderId || 
                               reportData[0]?.children?.[0]?.cylinderId ||
                               'Unknown'
                           }`
                        )}
                        {/* [FIX] Supply Tab Header: Customer Name */}
                        {activeTab === 'supply' && (
                             `거래처: ${
                                 // Try first item's customer name or fallback to search state
                                 reportData[0]?.customerName || 
                                 (customers.find(c => c.value === customerSearch)?.label) || 
                                 '-'
                             }`
                        )}
                    </div>
                    <div>
                        출력일시: {dayjs().format('YYYY-MM-DD HH:mm:ss')} | 총 데이터: {reportData.length}건
                    </div>
                </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                         {activeTab === 'long-term' && <><th style={{border:'1px solid #ddd', padding:'8px'}}>거래처</th><th style={{border:'1px solid #ddd', padding:'8px'}}>용기번호</th><th style={{border:'1px solid #ddd', padding:'8px'}}>가스종류</th><th style={{border:'1px solid #ddd', padding:'8px'}}>최종납품일</th><th style={{border:'1px solid #ddd', padding:'8px'}}>경과일수</th></>}
                         {/* [FIX] Traceability: Removed Cylinder Column */}
                         {activeTab === 'traceability' && <><th style={{border:'1px solid #ddd', padding:'8px'}}>일자</th><th style={{border:'1px solid #ddd', padding:'8px'}}>구분</th><th style={{border:'1px solid #ddd', padding:'8px'}}>장소/거래처</th><th style={{border:'1px solid #ddd', padding:'8px'}}>작업자</th></>}
                         {/* [FIX] Supply: Add Worker Column */}
                         {activeTab === 'supply' && <><th style={{border:'1px solid #ddd', padding:'8px'}}>일자</th><th style={{border:'1px solid #ddd', padding:'8px'}}>구분</th><th style={{border:'1px solid #ddd', padding:'8px'}}>품목</th><th style={{border:'1px solid #ddd', padding:'8px'}}>용기번호</th><th style={{border:'1px solid #ddd', padding:'8px'}}>작업자</th></>}
                    </tr>
                </thead>
                <tbody>
                    {/* Re-use flattened logic for print if traceability */}
                    {(activeTab === 'traceability' 
                        ? reportData.flatMap((item: ReportItem) => [item, ...(item.children || [])]).sort((a: ReportItem, b: ReportItem) => {
                            const dateA = a.date ? new Date(a.date).getTime() : 0;
                            const dateB = b.date ? new Date(b.date).getTime() : 0;
                            return dateB - dateA;
                        })
                        : reportData
                    ).map((item: ReportItem, idx: number) => (
                        <tr key={idx}>
                             {activeTab === 'long-term' && (
                                <>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.customerName}</td>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.serialNumber}</td>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.gasType}</td>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{dayjs(item.deliveryDate).format('YYYY-MM-DD')}</td>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.daysHeld}</td>
                                </>
                            )}
                            {activeTab === 'traceability' && (
                                <>
                                    {/* [FIX] Date Format: Remove Time (YY-MM-DD) */}
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{dayjs(item.date).format('YY-MM-DD')}</td>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.type}</td>
                                    {/* [FIX] Removed Cylinder Column */}
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.location || item.customer}</td>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.worker || '-'}</td>
                                </>
                            )}
                            {activeTab === 'supply' && (
                                <>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{dayjs(item.date).format('YYYY-MM-DD')}</td>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.type}</td>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.item}</td>
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.serial}</td>
                                    {/* [FIX] Removed Quantity & Customer Cells / Added Worker */}
                                    <td style={{border:'1px solid #ddd', padding:'6px', textAlign:'center'}}>{item.worker || '-'}</td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    // [Sub-Components for Readable UI]
    


    // [Feature] Dedicated Mobile Customer Search Modal





    // [Refactor] Native Date Handler
    const handleDateChange = (index: 0 | 1, e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value ? new Date(e.target.value) : null;
        const newRange = [...dateRange] as [Date | null, Date | null];
        newRange[index] = val;
        setDateRange(newRange);
    };

    return (
        <>
            {/* Premium Glass Modal */}
            <Modal
                opened={opened}
                onClose={handleClose}
                fullScreen={isMobile}
                size="xl"
                title={
                    <Group gap="sm">
                        <ThemeIcon color="blue" variant="transparent" size="lg"><IconFileTypeXls /></ThemeIcon>
                        <Text fw={700} size="lg" c="white">안전 관리 리포트</Text>
                    </Group>
                }
                padding="md"
                transitionProps={{ duration: 200, transition: 'pop' }}
                zIndex={1200} // Below CentralNotification (99999)
                styles={{ 
                    content: { 
                        background: 'rgba(26, 27, 30, 0.95)', 
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(51, 154, 240, 0.3)', // Blue border hint
                        boxShadow: '0 0 40px rgba(0,0,0,0.5)',
                        borderRadius: isMobile ? '0' : '16px'
                    }, 
                    header: { backgroundColor: 'transparent', color: 'white' },
                    body: { color: 'white' },
                    close: { color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }
                }}
            >
                <Tabs 
                    value={activeTab} 
                    onChange={(v) => { setActiveTab(v); setReportData([]); }}
                    variant="pills"
                    radius="md"
                    color="blue"
                >
                    <Tabs.List grow={isMobile} mb="md">
                        <Tabs.Tab value="long-term" style={{ fontSize: '1rem', fontWeight: 600 }}>장기미반납</Tabs.Tab>
                        <Tabs.Tab value="abnormal" style={{ fontSize: '1rem', fontWeight: 600, color: '#ff6b6b' }}>이상공병(관리필요)</Tabs.Tab>
                        <Tabs.Tab value="traceability" style={{ fontSize: '1rem', fontWeight: 600 }}>이력추적</Tabs.Tab>
                        <Tabs.Tab value="supply" style={{ fontSize: '1rem', fontWeight: 600 }}>공급대장</Tabs.Tab>
                    </Tabs.List>

                    {/* Filter Section */}
                    <Box my="md">
                        {isMobile ? (
                            <Group>
                                <Button 
                                    leftSection={<IconFilter size={18}/>} 
                                    onClick={openFilterDrawer} 
                                    fullWidth 
                                    variant="gradient" 
                                    gradient={{ from: 'blue', to: 'cyan' }}
                                    size="md"
                                    radius="md"
                                >
                                    검색 옵션 열기
                                </Button>
                                {reportData.length > 0 && (
                                    <>
                                    <Button 
                                        color="green" 
                                        onClick={handleExport} 
                                        fullWidth 
                                        variant="outline" 
                                        leftSection={<IconFileTypeXls/>}
                                        style={{ borderColor: '#40C057', color: '#40C057' }}
                                    >
                                        엑셀 저장
                                    </Button>
                                    <Button 
                                        color="red" 
                                        onClick={handlePDFExport} 
                                        fullWidth 
                                        variant="outline" 
                                        leftSection={<IconFileTypePdf/>}
                                        style={{ borderColor: '#FA5252', color: '#FA5252' }}
                                    >
                                        PDF
                                    </Button>
                                    </>
                                )}
                            </Group>
                        ) : (
                            <Card withBorder p="sm" style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}>
                                <Group align="end">
                                    <DatesProvider settings={{ locale: 'ko' }}>
                                        <DateInput 
                                            label={<Text c="dimmed" size="sm">시작일</Text>}
                                            value={dateRange[0] ? new Date(dateRange[0]) : null} 
                                            onChange={(d) => setDateRange([d ? new Date(d) : null, dateRange[1]])} 
                                            placeholder="시작" 
                                            valueFormat="YYYY-MM-DD"
                                            styles={{ input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white' } }} 
                                        />
                                        <DateInput 
                                            label={<Text c="dimmed" size="sm">종료일</Text>}
                                            value={dateRange[1] ? new Date(dateRange[1]) : null} 
                                            onChange={(d) => setDateRange([dateRange[0], d ? new Date(d) : null])} 
                                            placeholder="종료" 
                                            valueFormat="YYYY-MM-DD"
                                            styles={{ input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white' } }} 
                                        />
                                    </DatesProvider>
                                    {activeTab === 'long-term' && (
                                        <NumberInput 
                                            label={<Text c="dimmed" size="sm">최소일수</Text>}
                                            value={minDays} 
                                            onChange={setMinDays} 
                                            w={100} 
                                            styles={{ input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white' } }}
                                        />
                                    )}
                                    {activeTab === 'traceability' && (
                                        <Autocomplete 
                                            label={<Text c="dimmed" size="sm">용기번호 (자동완성)</Text>}
                                            placeholder="뒷자리 검색"
                                            value={serialSearch} 
                                            onChange={setSerialSearch}
                                            data={cylinderOptions}
                                            limit={20}
                                            filter={({ options, search }) => {
                                                // [FIX] Suffix / Partial Match Logic
                                                const query = search.toLowerCase().trim();
                                                return options.filter((opt) => 
                                                    (opt as { value: string }).value.toLowerCase().includes(query)
                                                );
                                            }}
                                            styles={{ input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white' }, dropdown: { zIndex: 2000, backgroundColor: '#1A1B1E', borderColor: '#373A40' }, option: { color: 'white', hover: { backgroundColor: '#25262B' } } }}
                                            comboboxProps={{ zIndex: 2000 }}
                                            maxDropdownHeight={200}
                                        />
                                    )}
                                    {activeTab === 'supply' && (
                                        <>
                                            <Box visibleFrom="sm">
                                                <Select 
                                                    label={
                                                        <Group gap={5}>
                                                            <Text c="dimmed" size="sm">거래처 검색</Text>
                                                            <Badge 
                                                                variant="gradient" 
                                                                gradient={{ from: 'indigo', to: 'cyan' }} 
                                                                size="xs"
                                                                radius="sm"
                                                            >
                                                                AI BETA
                                                            </Badge>
                                                        </Group>
                                                    }
                                                    placeholder="상호명 또는 주소 검색..."
                                                    value={customerSearch} 
                                                    onChange={(v) => setCustomerSearch(v || '')}
                                                    searchValue={customerSearchValue}
                                                    onSearchChange={setCustomerSearchValue}
                                                    data={customers} 
                                                    searchable
                                                    clearable
                                                    nothingFoundMessage="검색 결과가 없습니다."
                                                    limit={50}
                                                    maxDropdownHeight={300}
                                                    // Rich Item Rendering
                                                    renderOption={({ option, checked }: { option: ComboboxItem; checked?: boolean }) => {
                                                        const item = customers.find(c => c.value === option.value);
                                                        return (
                                                            <Group flex="1" gap="sm" wrap="nowrap">
                                                                <ThemeIcon variant="light" color="blue" size="lg" radius="xl">
                                                                    <IconBuildingSkyscraper size={18} />
                                                                </ThemeIcon>
                                                                <Box style={{ flex: 1 }}>
                                                                    <Text size="sm" fw={700} c="white">{item?.label}</Text>
                                                                    <Text size="xs" c="dimmed" truncate>
                                                                        {item?.address || '주소 미입력'}
                                                                        {item?.manager ? ` | ${item.manager}` : ''}
                                                                    </Text>
                                                                </Box>
                                                                {checked && <IconRobot size={16} color="#339AF0" />}
                                                            </Group>
                                                        );
                                                    }}
                                                    filter={({ options, search }) => {
                                                        const query = search.toLowerCase().trim();
                                                        return options.filter((opt) => {
                                                            const item = customers.find(c => c.value === (opt as { value: string }).value);
                                                            if (!item) return false;
                                                            return (
                                                                item.label.toLowerCase().includes(query) || 
                                                                (item.address && item.address.toLowerCase().includes(query))
                                                            );
                                                        });
                                                    }}
                                                    styles={{ 
                                                        input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white' },
                                                        dropdown: { backgroundColor: '#1A1B1E', borderColor: '#373A40', zIndex: 2000 }, // Explicit CSS Z-Index
                                                        option: { color: 'white' }
                                                    }}
                                                    comboboxProps={{ zIndex: 2000 }} // Portal Z-Index
                                                    leftSection={<IconSearch size={16} />}
                                                />
                                            </Box>
                                            <Box hiddenFrom="sm">
                                                <NativeSelect 
                                                    label="거래처 검색"
                                                    data={[{ value: '', label: '거래처 선택' }, ...customers]} 
                                                    value={customerSearch || ''} 
                                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCustomerSearch(e.currentTarget.value)}
                                                    size="sm"
                                                    styles={{ input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white', fontSize: '16px' } }} /* Prevent iOS Zoom */
                                                />
                                            </Box>
                                        </>
                                    )}
                                    <Button onClick={handleSearch} loading={loading} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>조회</Button>
                                    <Button color="green" onClick={handleExport} disabled={reportData.length === 0} variant="outline" style={{ borderColor: '#40C057', color: '#40C057' }}>엑셀</Button>
                                    <Button color="red" onClick={handlePDFExport} disabled={reportData.length === 0} variant="outline" style={{ borderColor: '#FA5252', color: '#FA5252' }}>PDF</Button>
                                </Group>
                            </Card>
                        )}
                    </Box>

                    {/* Content Area */}
                    <ScrollArea h={isMobile ? 'calc(100vh - 200px)' : 600} type="auto" offsetScrollbars>
                        <ReportContent 
                            data={reportData} 
                            isMobile={isMobile || false} 
                            activeTab={activeTab || 'long-term'}
                            expandedItems={expandedItems}
                            onSerialClick={handleSerialClick} 
                            onCustomerClick={handleCustomerClick}
                            onFixAction={handleFixAction}
                            onToggleExpand={toggleExpand}
                        />
                    </ScrollArea>
                </Tabs>
            </Modal>

            {/* Premium Glass Drawer */}
            <Drawer 
                opened={filterDrawerOpen} 
                onClose={handleDrawerClose} 
                position="bottom" 
                size="85%" 
                title={<Text fw={700} size="lg" c="white">🔍 검색 옵션</Text>}
                padding="lg"
                zIndex={1300} // CRITICAL: Must be above parent Modal (1200)
                trapFocus={false} // [FIX] Disable focus trap on mobile
                lockScroll={false}
                transitionProps={{ duration: 250, timingFunction: 'ease-out', transition: 'slide-up' }}
                styles={{ 
                    content: { 
                        background: 'rgba(37, 38, 43, 0.98)', 
                        borderTopLeftRadius: '24px', 
                        borderTopRightRadius: '24px',
                        borderTop: '1px solid rgba(255,255,255,0.1)'
                    },
                    header: { backgroundColor: 'transparent', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.05)' },
                    body: { paddingBottom: 40 },
                    close: { color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }
                }}
            >
                <Stack gap="md">
                    <Box>
                        <Text fw={600} size="sm" mb={4}>📅 조회 기간</Text>
                        <Group grow>
                             {/* Native Input for Max Speed with Premium Styling */}
                            <input 
                                type="date" 
                                style={{ 
                                    padding: '12px', 
                                    borderRadius: '8px', 
                                    border: '1px solid #373A40',
                                    fontSize: '16px', // Prevent iOS zoom
                                    width: '100%',
                                    backgroundColor: '#25262B', // Darker Surface
                                    color: 'white',
                                    colorScheme: 'dark', // CSS property for dark picker
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    fontFamily: 'inherit'
                                }}
                                value={dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : ''}
                                onChange={(e) => handleDateChange(0, e)}
                                onFocus={(e) => e.target.style.borderColor = '#339AF0'} // Focus effect
                                onBlur={(e) => e.target.style.borderColor = '#373A40'}
                            />
                            <input 
                                type="date" 
                                style={{ 
                                    padding: '12px', 
                                    borderRadius: '8px', 
                                    border: '1px solid #373A40',
                                    fontSize: '16px',
                                    width: '100%',
                                    backgroundColor: '#25262B', 
                                    color: 'white',
                                    colorScheme: 'dark',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    fontFamily: 'inherit'
                                }}
                                value={dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : ''}
                                onChange={(e) => handleDateChange(1, e)}
                                onFocus={(e) => e.target.style.borderColor = '#339AF0'}
                                onBlur={(e) => e.target.style.borderColor = '#373A40'}
                            />
                        </Group>
                    </Box>

                    {activeTab === 'long-term' && (
                        <NumberInput 
                            label="⏳ 최소 미반납 일수" 
                            value={minDays} 
                            onChange={(v) => setMinDays(v)} 
                            min={0} 
                            size="md"
                            styles={{ input: { backgroundColor: '#2C2E33', borderColor: '#373A40', color: 'white' } }}
                        />
                    )}
                    {activeTab === 'traceability' && (
                        <Autocomplete 
                            label="🔋 용기 번호" 
                            placeholder="뒷자리 입력 (자동완성)" 
                            value={serialSearch} 
                            onChange={setSerialSearch} 
                            // [UX Rule] Only show options when typing
                            data={serialSearch.trim().length > 0 ? cylinderOptions : []}
                            limit={10}
                            maxDropdownHeight={200}
                            size="md"
                            styles={{ 
                                input: { backgroundColor: '#2C2E33', borderColor: '#373A40', color: 'white' },
                                dropdown: { backgroundColor: '#2C2E33', borderColor: '#373A40', color: 'white', zIndex: 2100 },
                                option: { color: 'white' }
                            }}
                            comboboxProps={{ zIndex: 2100, withinPortal: true }}
                        />
                    )}
                    {activeTab === 'supply' && (
                        <Select 
                            label={
                                <Group gap={5}>
                                    <Text c="dimmed" size="sm">거래처 검색</Text>
                                    <Badge 
                                        variant="gradient" 
                                        gradient={{ from: 'indigo', to: 'cyan' }} 
                                        size="xs"
                                        radius="sm"
                                    >
                                        AI BETA
                                    </Badge>
                                </Group>
                            }
                            placeholder="상호명 또는 주소 검색..."
                            value={customerSearch} 
                            onChange={(v) => setCustomerSearch(v || '')}
                            searchValue={customerSearchValue}
                            onSearchChange={setCustomerSearchValue}
                            data={customers} 
                            searchable
                            clearable
                            nothingFoundMessage="검색 결과가 없습니다."
                            limit={15}
                            maxDropdownHeight={200}
                            // Rich Item Rendering
                            renderOption={({ option, checked }: { option: ComboboxItem; checked?: boolean }) => {
                                // [Optimization] Use Map Lookup instead of .find()
                                const item = customerMap[option.value];
                                return (
                                    <Group flex="1" gap="sm" wrap="nowrap">
                                        <ThemeIcon variant="light" color="blue" size="lg" radius="xl">
                                            <IconBuildingSkyscraper size={18} />
                                        </ThemeIcon>
                                        <Box style={{ flex: 1 }}>
                                            <Text size="sm" fw={700} c="white">{item?.label}</Text>
                                            <Text size="xs" c="dimmed" truncate>
                                                {item?.address || '주소 미입력'}
                                                {item?.manager ? ` | ${item.manager}` : ''}
                                            </Text>
                                        </Box>
                                        {checked && <IconRobot size={16} color="#339AF0" />}
                                    </Group>
                                );
                            }}
                            filter={(input) => {
                                const query = input.search.toLowerCase();
                                return input.options.filter((opt) => {
                                    // [Optimization] Use Map Lookup
                                    const item = customerMap[(opt as ComboboxItem).value];
                                    if (!item) return false;
                                    return (
                                        item.label.toLowerCase().includes(query) || 
                                        (item.address && item.address.toLowerCase().includes(query))
                                    );
                                });
                            }}
                            styles={{ 
                                input: { backgroundColor: '#2C2E33', borderColor: '#373A40', color: 'white', fontSize: '16px' },
                                dropdown: { backgroundColor: '#2C2E33', borderColor: '#373A40', zIndex: 2100 },
                                option: { color: 'white' }
                            }}
                            comboboxProps={{ zIndex: 2100, withinPortal: true, position: 'top' }}
                            leftSection={<IconSearch size={16} />}
                        />
                    )}

                    <Button fullWidth size="lg" onClick={handleSearch} loading={loading} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} radius="md" mt="sm">
                        조회하기
                    </Button>
                    {/* Keyboard Spacer */}
                    <Box h={200} /> 
                </Stack>
            </Drawer>

            {/* Sub Modals */}
             <CylinderHistoryModal 
                opened={cylinderModalOpen} 
                onClose={closeCylinderModal} 
                cylinderId={selectedSerial} 
            />
            
            <CustomerDetailModal 
                opened={detailModalOpen} 
                onClose={closeDetailModal} 
                customer={selectedCustomer}
                onUpdate={() => {}}
                initialTab="history"
            />

            {/* Print Portal */}
            {printContent}
        </>
    );
}
