
import { useState, useEffect } from 'react';
import { Modal, Card, Text, Group, Tabs, Button, Table, Badge, Grid, Select, TextInput, NumberInput, ActionIcon, Box, Stack, useMantineTheme, NativeSelect } from '@mantine/core';
import { DateInput, DatesProvider } from '@mantine/dates';
import { IconFileTypeXls, IconSearch, IconCalendar, IconChevronRight, IconChevronDown, IconCornerDownRight } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import React from 'react';

import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';
import { CustomerDetailModal } from '@/app/master/customers/CustomerDetailModal';
import { CylinderHistoryModal } from '@/components/History/CylinderHistoryModal';
import { Customer } from '@/lib/types';
import { groupHistoryItems } from '@/lib/utils/grouping';

interface SafetyReportsModalProps {
    opened: boolean;
    onClose: () => void;
}

export function SafetyReportsModal({ opened, onClose }: SafetyReportsModalProps) {
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
    
    // [UI] Full screen on mobile
    const handleClose = useModalBackTrap(opened, onClose, 'safety-reports');
    const [activeTab, setActiveTab] = useState<string | null>('long-term');
    
    // Filters
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
        dayjs().subtract(6, 'month').toDate(), 
        dayjs().toDate()
    ]);
    const [serialSearch, setSerialSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [minDays, setMinDays] = useState<number | string>(90);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [reportData, setReportData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<{value: string, label: string}[]>([]);

    // [Interactive Modal State]
    const [cylinderModalOpen, { open: openCylinderModal, close: closeCylinderModal }] = useDisclosure(false);
    const [detailModalOpen, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
    
    const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // [Grouping State]
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string | number) => {
        const key = String(id);
        const newSet = new Set(expandedItems);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setExpandedItems(newSet);
    };

    // [Handlers]
    const handleSerialClick = (serial: string) => {
        if (!serial || serial === '-') return;
        setSelectedSerial(serial);
        openCylinderModal();
    };

    const handleCustomerClick = (customerName: string) => {
        if (!customerName || customerName === '-') return;
        
        const matched = customers.find(c => c.label === customerName);
        if (matched) {
            setSelectedCustomer({ 
                id: matched.value, 
                name: matched.label,
                type: 'BUSINESS', 
                paymentType: 'card', 
                address: '-', 
                phone: '-',
                representative: '-'
            } as Customer);
            openDetailModal();
        } else {
             notifications.show({ title: '알림', message: '거래처 정보를 찾을 수 없습니다.', color: 'gray' });
        }
    };

    // Fetch Customers
    useEffect(() => {
        if (opened) {
            fetch('/api/master/customers')
                .then(res => res.json())
                .then(data => {
                    if (data.success && Array.isArray(data.data)) {
                        setCustomers(data.data.map((c: { id: string, name: string }) => ({ value: c.id, label: c.name })));
                    } else if (Array.isArray(data)) {
                         setCustomers(data.map((c: { id: string, name: string }) => ({ value: c.id, label: c.name })));
                    } else {
                        console.error("Invalid customer data format", data);
                    }
                })
                .catch(err => console.error("Failed to fetch customers", err));
        }
    }, [opened]);

    // Search Handler
    const handleSearch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateRange[0]) params.append('startDate', dayjs(dateRange[0]).format('YYYY-MM-DD'));
            if (dateRange[1]) params.append('endDate', dayjs(dateRange[1]).format('YYYY-MM-DD'));
 
            let url = '';
            
            if (activeTab === 'long-term') {
                url = '/api/system/reports/long-term';
                if (minDays) params.append('minDays', minDays.toString());
            } else if (activeTab === 'traceability') {
                url = '/api/system/reports/traceability';
                if (!serialSearch) {
                    notifications.show({ title: '오류', message: '용기 번호를 입력해주세요.', color: 'red' });
                    setLoading(false);
                    return;
                }
                params.append('serial', serialSearch);
            } else if (activeTab === 'supply') {
                url = '/api/system/reports/supply';
                if (!customerSearch) {
                    notifications.show({ title: '오류', message: '거래처를 선택해주세요.', color: 'red' });
                    setLoading(false);
                    return;
                }
                params.append('customerId', customerSearch);
            }

            const res = await fetch(`${url}?${params.toString()}`);
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            
            // [Apply Grouping]
            let processedData = data;
            if (activeTab === 'traceability') {
                 processedData = groupHistoryItems(data, 'cylinderId');
            } else if (activeTab === 'supply') {
                 processedData = groupHistoryItems(data, 'serial');
            }
            
            setReportData(processedData);
            
            if (data.length === 0) {
                 notifications.show({ title: '알림', message: '검색된 데이터가 없습니다.', color: 'yellow' });
            } else {
                 notifications.show({ title: '성공', message: `총 ${data.length}건이 조회되었습니다.`, color: 'green' });
            }

        } catch (error) {
            console.error(error);
            notifications.show({ title: '오류', message: '데이터 조회 실패', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (reportData.length === 0) return;
        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        const fileName = `Safety_Report_${activeTab}_${dayjs().format('YYYYMMDD')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    // [Component] Mobile Report Card
    const MobileReportCard = ({ children, title, subtitle, badge }: { children: React.ReactNode, title: React.ReactNode, subtitle?: React.ReactNode, badge?: React.ReactNode }) => (
        <Card withBorder radius="md" p="sm" mb="sm" bg="dark.7">
            <Group justify="space-between" mb="xs">
                <div>
                    <Text size="sm" fw={600} c="white">{title}</Text>
                    {subtitle && <Text size="xs" c="dimmed">{subtitle}</Text>}
                </div>
                {badge}
            </Group>
            <Stack gap="xs">
                {children}
            </Stack>
        </Card>
    );

    const DataRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
        <Group justify="space-between">
            <Text size="xs" c="dimmed">{label}</Text>
            <Text size="sm" fw={500} c="white">{value}</Text>
        </Group>
    );

    return (
        <>
        <Modal 
            opened={opened} 
            onClose={handleClose} 
            title="안전 관리 리포트 (최신버전)"
            fullScreen={isMobile}
            size={isMobile ? "100%" : "80%"}
            padding={isMobile ? "md" : "lg"}
            centered
            closeOnEscape={false}
            styles={{
                title: { fontWeight: 700 },
                header: { borderBottom: '1px solid #373A40' },
                body: { padding: isMobile ? 0 : undefined }
            }}
        >
            <Box p={isMobile ? "md" : 0}>
                <Tabs value={activeTab} onChange={(val) => { setActiveTab(val); setReportData([]); setExpandedItems(new Set()); }}>
                    <Tabs.List mb="md" grow={isMobile}>
                        <Tabs.Tab value="long-term">장기 미반납</Tabs.Tab>
                        <Tabs.Tab value="traceability">이력 추적</Tabs.Tab>
                        <Tabs.Tab value="supply">공급 대장</Tabs.Tab>
                    </Tabs.List>

                    {/* Flexible Filter Section */}
                    <Card withBorder bg="gray.0" mb="lg" p="md" radius="md">
                        <Grid align="flex-end" gutter="md">
                            {/* Date Range - Full width on mobile, 5 cols on desktop */}
                            <Grid.Col span={{ base: 12, lg: 5 }}>
                                <Text size="sm" fw={500} mb={3}>조회 기간</Text>
                                <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] }}>
                                    <Group align="center" gap="xs" grow>
                                        <DateInput
                                            value={dateRange[0]}
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            onChange={(d: any) => setDateRange([d, dateRange[1]])}
                                            valueFormat="YYYY.MM.DD"
                                            placeholder="시작"
                                            leftSection={<IconCalendar size={18} />}
                                            locale="ko"
                                            size="sm"
                                            popoverProps={{ position: 'bottom', withinPortal: true }}
                                        />
                                        <Text c="dimmed" style={{ flexGrow: 0 }}>~</Text>
                                        <DateInput
                                            value={dateRange[1]}
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            onChange={(d: any) => setDateRange([dateRange[0], d])}
                                            valueFormat="YYYY.MM.DD"
                                            placeholder="종료"
                                            leftSection={<IconCalendar size={18} />}
                                            locale="ko"
                                            size="sm"
                                            popoverProps={{ position: 'bottom', withinPortal: true }}
                                        />
                                    </Group>
                                </DatesProvider>
                            </Grid.Col>

                            {/* Conditional Inputs - Responsive Spans */}
                            {activeTab === 'long-term' && (
                                <Grid.Col span={{ base: 12, sm: 6, lg: 2 }}>
                                    <NumberInput
                                        label="최소 미반납 일수"
                                        value={minDays}
                                        onChange={(val) => setMinDays(val)}
                                        min={0}
                                        size="sm"
                                    />
                                </Grid.Col>
                            )}

                            {activeTab === 'traceability' && (
                                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                                    <TextInput
                                        label="용기 번호 (Serial)"
                                        placeholder="SDG-1234"
                                        value={serialSearch}
                                        onChange={(e) => setSerialSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        size="sm"
                                    />
                                </Grid.Col>
                            )}

                            {activeTab === 'supply' && (
                                <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
                                    <Box visibleFrom="sm">
                                        <Select
                                            label="거래처 선택"
                                            placeholder="거래처 검색"
                                            data={customers}
                                            searchable
                                            value={customerSearch}
                                            onChange={(val) => setCustomerSearch(val || '')}
                                            size="sm"
                                        />
                                    </Box>
                                    <Box hiddenFrom="sm">
                                        <NativeSelect
                                            label="거래처 선택"
                                            data={[{ value: '', label: '거래처 선택' }, ...customers]} 
                                            value={customerSearch}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCustomerSearch(e.currentTarget.value)}
                                            size="sm"
                                            styles={{ input: { fontSize: '16px' } }} /* Prevent iOS Zoom */
                                        />
                                    </Box>
                                </Grid.Col>
                            )}

                            {/* Buttons - Full width on mobile, Auto on desktop */}
                            <Grid.Col span={{ base: 12, lg: "auto" }}>
                                <Group justify="flex-end" grow={isMobile}>
                                    <Button leftSection={<IconSearch size={16} />} onClick={handleSearch} loading={loading}>
                                        조회
                                    </Button>
                                    <Button 
                                        color="green" 
                                        leftSection={<IconFileTypeXls size={16} />} 
                                        onClick={handleExport}
                                        disabled={reportData.length === 0}
                                    >
                                        엑셀
                                    </Button>
                                </Group>
                            </Grid.Col>
                        </Grid>
                    </Card>

                    {/* Report Content Container */}
                    <div style={{ minHeight: '400px', maxHeight: isMobile ? 'calc(100vh - 350px)' : '60vh', overflowY: 'auto' }}>
                        
                        {/* 1. Long Term Tab */}
                        <Tabs.Panel value="long-term">
                            {/* Mobile Card View */}
                            <Stack hiddenFrom="sm">
                                {reportData.length > 0 ? reportData.map((item, idx) => (
                                    <MobileReportCard 
                                        key={idx}
                                        title={item.customerName}
                                        subtitle={item.gasType}
                                        badge={<Badge color={item.daysHeld > 180 ? 'red' : 'yellow'}>{item.daysHeld}일</Badge>}
                                    >
                                        <DataRow label="용기번호" value={item.serialNumber} />
                                        <DataRow label="최종 납품일" value={dayjs(item.deliveryDate).format('YYYY-MM-DD')} />
                                    </MobileReportCard>
                                )) : <Text c="dimmed" ta="center" py="xl">데이터가 없습니다.</Text>}
                            </Stack>

                            {/* Desktop Table View */}
                            <Box visibleFrom="sm">
                                <Table striped highlightOnHover withTableBorder>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>거래처명</Table.Th>
                                            <Table.Th>용기 번호</Table.Th>
                                            <Table.Th>가스 종류</Table.Th>
                                            <Table.Th>최종 납품일</Table.Th>
                                            <Table.Th>보유 일수</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {reportData.length > 0 ? reportData.map((item, idx) => (
                                            <Table.Tr key={idx}>
                                                <Table.Td style={{ cursor: 'pointer', color: '#228be6' }} onClick={() => handleCustomerClick(item.customerName)}>{item.customerName}</Table.Td>
                                                <Table.Td style={{ cursor: 'pointer', color: '#228be6' }} onClick={() => handleSerialClick(item.serialNumber)}>{item.serialNumber}</Table.Td>
                                                <Table.Td>{item.gasType}</Table.Td>
                                                <Table.Td>{dayjs(item.deliveryDate).format('YYYY-MM-DD')}</Table.Td>
                                                <Table.Td><Badge color={item.daysHeld > 180 ? 'red' : 'yellow'}>{item.daysHeld}일</Badge></Table.Td>
                                            </Table.Tr>
                                        )) : <Table.Tr><Table.Td colSpan={5} align="center">데이터가 없습니다.</Table.Td></Table.Tr>}
                                    </Table.Tbody>
                                </Table>
                            </Box>
                        </Tabs.Panel>

                        {/* 2. Traceability Tab */}
                        <Tabs.Panel value="traceability">
                             {/* Mobile Card View */}
                             <Stack hiddenFrom="sm">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {reportData.map((item: any, idx) => {
                                    const hasChildren = item.children && item.children.length > 0;
                                    const isExpanded = expandedItems.has(String(item.id || `trace-${idx}`));
                                    
                                    return (
                                        <MobileReportCard 
                                            key={idx}
                                            title={item.location}
                                            subtitle={dayjs(item.date).format('YYYY-MM-DD HH:mm')}
                                            badge={<Badge color={item.type === '납품' ? 'blue' : item.type === '회수' ? 'orange' : 'gray'}>{item.type}</Badge>}
                                        >
                                            <DataRow label="용기번호" value={item.cylinderId} />
                                            <DataRow label="작업자" value={item.worker} />
                                            {hasChildren && (
                                                <Button 
                                                    variant="subtle" 
                                                    size="xs" 
                                                    fullWidth 
                                                    onClick={() => toggleExpand(item.id || `trace-${idx}`)}
                                                    rightSection={isExpanded ? <IconChevronDown size={14}/> : <IconChevronRight size={14}/>}
                                                >
                                                    포함된 용기 ({item.children.length})
                                                </Button>
                                            )}
                                            {hasChildren && isExpanded && (
                                                <Box bg="dark.8" p="xs" style={{ borderRadius: 8 }}>
                                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                    {item.children.map((child: any, cIdx: number) => (
                                                        <Group key={cIdx} justify="space-between" mb={4}>
                                                            <Text size="xs" c="dimmed">{child.cylinderId}</Text>
                                                            <Text size="xs" c="dimmed">{dayjs(child.date).format('HH:mm')}</Text>
                                                        </Group>
                                                    ))}
                                                </Box>
                                            )}
                                        </MobileReportCard>
                                    );
                                })}
                            </Stack>

                            {/* Desktop Table View */}
                            <Box visibleFrom="sm">
                                <Table striped highlightOnHover withTableBorder>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>일시</Table.Th>
                                            <Table.Th>구분</Table.Th>
                                            <Table.Th>용기 번호</Table.Th>
                                            <Table.Th>장소 (거래처)</Table.Th>
                                            <Table.Th>작업자</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {reportData.map((item: any, idx) => {
                                            const keyId = item.id || `trace-${idx}`;
                                            const hasChildren = item.children && item.children.length > 0;
                                            const isExpanded = expandedItems.has(String(keyId));
                                            return (
                                                <React.Fragment key={keyId}>
                                                    <Table.Tr>
                                                        <Table.Td>
                                                            <Group gap="xs">
                                                                {hasChildren && (
                                                                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => { e.stopPropagation(); toggleExpand(keyId); }}>
                                                                        {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                                                    </ActionIcon>
                                                                )}
                                                                {!hasChildren && <Box w={22} />} 
                                                                {dayjs(item.date).format('YYYY-MM-DD HH:mm')}
                                                            </Group>
                                                        </Table.Td>
                                                        <Table.Td><Badge color={item.type === '납품' ? 'blue' : item.type === '회수' ? 'orange' : 'gray'}>{item.type}</Badge></Table.Td>
                                                        <Table.Td style={{ cursor: 'pointer', color: '#228be6' }} onClick={() => handleSerialClick(item.cylinderId)}>
                                                            {item.cylinderId}
                                                            {hasChildren && <Text span size="xs" c="dimmed" ml={5}>(포함 {item.children.length})</Text>}
                                                        </Table.Td>
                                                        <Table.Td style={{ cursor: 'pointer', color: '#228be6' }} onClick={() => handleCustomerClick(item.location)}>{item.location}</Table.Td>
                                                        <Table.Td>{item.worker}</Table.Td>
                                                    </Table.Tr>
                                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                    {hasChildren && isExpanded && item.children.map((child: any, cIdx: number) => (
                                                        <Table.Tr key={`${keyId}-child-${cIdx}`} style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
                                                            <Table.Td style={{ paddingLeft: '40px', color: '#868e96' }}><Group gap="xs"><IconCornerDownRight size={12} />{dayjs(child.date).format('HH:mm')}</Group></Table.Td>
                                                            <Table.Td><Badge size="xs" color="gray" variant="outline">포함</Badge></Table.Td>
                                                            <Table.Td 
                                                                style={{ cursor: 'pointer', color: '#228be6', fontWeight: 500 }}
                                                                onClick={() => handleSerialClick(child.cylinderId)}
                                                            >
                                                                {child.cylinderId}
                                                            </Table.Td>
                                                            <Table.Td style={{ color: '#868e96' }}>-</Table.Td>
                                                            <Table.Td style={{ color: '#868e96' }}>-</Table.Td>
                                                        </Table.Tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </Table.Tbody>
                                </Table>
                             </Box>
                        </Tabs.Panel>

                        {/* 3. Supply Tab */}
                        <Tabs.Panel value="supply">
                             {/* Mobile Card View */}
                             <Stack hiddenFrom="sm">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {reportData.map((item: any, idx) => (
                                    <MobileReportCard 
                                        key={idx}
                                        title={dayjs(item.date).format('YYYY-MM-DD')}
                                        subtitle={<Text c={item.type === '납품' ? 'blue' : 'red'} fw={500}>{item.type}</Text>}
                                        badge={<Text fw={600} c="white">{item.quantity}개</Text>}
                                    >
                                        <DataRow label="가스명" value={item.item} />
                                        <DataRow label="용기번호" value={item.serial} />
                                    </MobileReportCard>
                                ))}
                            </Stack>

                            {/* Desktop Table View */}
                            <Box visibleFrom="sm">
                                <Table striped highlightOnHover withTableBorder>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>일시</Table.Th>
                                            <Table.Th>구분 (납품/회수)</Table.Th>
                                            <Table.Th>가스명</Table.Th>
                                            <Table.Th>용기 번호</Table.Th>
                                            <Table.Th>수량</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {reportData.map((item: any, idx) => (
                                            <Table.Tr key={idx}>
                                                <Table.Td>{dayjs(item.date).format('YYYY-MM-DD')}</Table.Td>
                                                <Table.Td><Text c={item.type === '납품' ? 'blue' : 'red'} fw={500}>{item.type}</Text></Table.Td>
                                                <Table.Td>{item.item}</Table.Td>
                                                <Table.Td style={{ cursor: 'pointer', color: '#228be6' }} onClick={() => handleSerialClick(item.serial)}>{item.serial}</Table.Td>
                                                <Table.Td>{item.quantity}</Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                             </Box>
                        </Tabs.Panel>
                    </div>
                </Tabs>
            </Box>
        </Modal>

        {/* Modals */}
        <CylinderHistoryModal 
            opened={cylinderModalOpen} 
            onClose={closeCylinderModal} 
            cylinderId={selectedSerial} 
        />
        
        <CustomerDetailModal 
            opened={detailModalOpen} 
            onClose={closeDetailModal} 
            customer={selectedCustomer}
            onUpdate={() => { /* Refresh Report? Optional */ }}
            initialTab="history"
        />
        </>
    );
}
