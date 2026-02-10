import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Tabs, Stack, TextInput, Select, Button, Table, ScrollArea, Badge, Group, Text, LoadingOverlay, Box, Collapse, ActionIcon, NativeSelect } from '@mantine/core';
import { DateInput, DatesProvider } from '@mantine/dates';
import { IconBuildingWarehouse, IconInfoCircle, IconHistory, IconTrash, IconFilter, IconSearch, IconRefresh, IconPrinter, IconChevronDown, IconChevronRight, IconCornerDownRight, IconPhone, IconMap, IconCalendar } from '@tabler/icons-react';
import { groupHistoryItems } from '@/lib/utils/grouping';
import 'dayjs/locale/ko';
import { Customer } from '@/lib/types';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { CylinderHistoryModal } from '@/components/History/CylinderHistoryModal';
import { QRPrintModal } from '@/components/Common/QRPrintModal';
import dayjs from 'dayjs';
import { GasBadge } from '@/components/Common/GasBadge';
import { formatExpiryDate } from '@/app/utils/display';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

interface CustomerDetailModalProps {
    opened: boolean;
    onClose: () => void;
    customer: Customer | null;
    onUpdate: () => void; // Callback to refresh parent list
    initialTab?: string; // [New] Allow opening specific tab
    isAdmin?: boolean; // [New]
}

interface HistoryItem {
    id: number;
    date: string;
    type: string;
    cylinderId: string;
    gas: string;
    worker: string;
    memo: string;
    gasColor?: string;
    children?: HistoryItem[]; // [New] Grouped children
}

// Restored Interfaces
interface CylinderDetail {
    serialNumber: string;
    gasType: string;
    lastDeliveryDate: string;
    chargingExpiryDate: string;
}

interface InventoryRecord {
    customerId: string;
    total: number;
    details: CylinderDetail[];
}

interface User {
    id: string;
    username: string;
    name: string;
}

export function CustomerDetailModal({ opened, onClose, customer, onUpdate, initialTab = 'inventory', isAdmin = false }: CustomerDetailModalProps) {
    const isMobile = useMediaQuery('(max-width: 50em)');
    const [activeTab, setActiveTab] = useState<string | null>(initialTab); // Set default from prop
    const [loading, setLoading] = useState(false);
    const [inventoryData, setInventoryData] = useState<InventoryRecord | null>(null);

    // History Modal State
    const [historyModalOpen, { open: openHistory, close: closeHistory }] = useDisclosure(false);
    const [qrModalOpened, { open: openQrModal, close: closeQrModal }] = useDisclosure(false);
    const [selectedCylinderId, setSelectedCylinderId] = useState<string | null>(null);

    // [Hydration Fix] Mounted State
    // const [mounted, setMounted] = useState(false);
    // useEffect(() => {
    //     setMounted(true);
    // }, []);

    const handleClose = useModalBackTrap(opened, onClose, 'customer-detail');

    const handleHistoryClick = (id: string) => {
        setSelectedCylinderId(id);
        openHistory();
    };

    // Form State (initialized when customer changes)
    const [formData, setFormData] = useState<Partial<Customer>>({});

    // [New] Grouping and Expansion State
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

    const toggleExpand = (id: number) => {
        const newSet = new Set(expandedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedItems(newSet);
    };

    useEffect(() => {
        if (customer && opened) {
            setFormData({ ...customer });
            fetchInventory(customer.id);
            // [Fix] Respect initialTab when opening
            setActiveTab(initialTab);
            
            // [Safety] Ensure QR Modal is closed when Detail Modal opens
            closeQrModal();
        }
    }, [customer, opened, closeQrModal, initialTab]);

    const fetchInventory = async (customerId: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/master/inventory'); // In a real app, query by ID
            const json = await res.json();
            if (json.success) {
                const found = json.data.find((d: InventoryRecord) => d.customerId === customerId);
                setInventoryData(found || null);
            }
        } catch (error) {
            console.error(error);
            notifications.show({ title: '오류', message: '재고 정보를 불러오지 못했습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveInfo = async () => {
        if (!formData.name) return;
        setLoading(true);
        try {
            // Update Logic (Assuming POST upserts or PUT exists, utilizing existing POST for now to overwrite?)
            // The existing POST in page.tsx adds a NEW customer. We likely need a PUT endpoint or modify POST.
            // Wait, I need to check if there is an update endpoint.
            // If not, I might need to implement it.
            // Let's assume for now we only display Info or use the same POST endpoint if it handles upsert (checked: db.ts usually doesn't).
            // I will implement a PUT in the next step.
            
            // For now, simple implementation.
             const res = await fetch('/api/master/customers', {
                method: 'PUT', // I will add this method
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
              });
        
              const result = await res.json();

              if (res.ok) {
                // Check if it was a partial success (warning)
                if (result.warning) {
                     notifications.show({ title: '확인 필요', message: result.message, color: 'orange', autoClose: 6000 });
                } else {
                     notifications.show({ title: '성공', message: result.message || '정보가 수정되었습니다.', color: 'blue' });
                }
                onUpdate();
              } else {
                 notifications.show({ title: '오류', message: result.message || '수정 실패', color: 'red' });
              }

        } catch (error) {
             console.error(error);
             notifications.show({ title: '오류', message: '저장 중 오류 발생', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!customer) return;

        modals.openConfirmModal({
            title: '삭제 확인',
            children: (
                <Text size="sm">정말로 {customer.name}(을)를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.</Text>
            ),
            labels: { confirm: '예', cancel: '아니요' },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                setLoading(true);
                try {
                    const res = await fetch(`/api/master/customers?id=${customer.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        notifications.show({ title: '성공', message: '거래처가 삭제되었습니다.', color: 'blue' });
                        onUpdate();
                        onClose();
                    } else {
                        notifications.show({ title: '오류', message: '삭제 실패', color: 'red' });
                    }
                } catch (error) {
                    console.error(error);
                    notifications.show({ title: '오류', message: '삭제 중 오류 발생', color: 'red' });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const typeData = [{ value: 'BUSINESS', label: '사업자' }, { value: 'INDIVIDUAL', label: '개인' }];
    const paymentData = [
          { value: 'tax_invoice', label: '세금계산서' },
          { value: 'cash', label: '현금' }, 
          { value: 'card', label: '카드' }, 
          { value: 'transfer', label: '계좌이체' },
    ];

    // History State
    const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [userMap, setUserMap] = useState<Record<string, string>>({});
    
    // Filter State
    const [showFilter, setShowFilter] = useState(false);
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
    const [searchCylinder, setSearchCylinder] = useState('');
    const [searchGasType, setSearchGasType] = useState<string | null>(null);

    // Fetch User Map
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/master/users');
                const data = await res.json();
                if (data.success) {
                    const map: Record<string, string> = {};
                    data.data.forEach((u: User) => {
                        map[u.username] = u.name;
                        map[u.id] = u.name;
                    });
                    setUserMap(map);
                }
            } catch (e) {
                console.error('Failed to fetch users', e);
            }
        };
        fetchUsers();
    }, []);

    const fetchCustomerHistory = useCallback(async (start?: Date | null, end?: Date | null) => {
        if (!customer) return;
        setHistoryLoading(true);
        try {
            let url = `/api/work/delivery?customerId=${customer.id}`;
            if (start && end) {
                const s = dayjs(start).format('YYYY-MM-DD');
                const e = dayjs(end).format('YYYY-MM-DD');
                url += `&startDate=${s}&endDate=${e}`;
            }

            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rawItems = data.data.map((item: any) => ({
                    id: item.id,
                    date: item.timestamp,
                    type: item.type,
                    cylinderId: item.cylinderId,
                    gas: item.gas?.name || item.gasType || '미확인',
                    worker: item.worker || item.workerId,
                    memo: item.memo,
                    gasColor: '#228be6'
                    // Note: We don't map children here; the grouper handles it.
                }));

                // Apply Shared Grouping Logic
                const grouped = groupHistoryItems<HistoryItem>(rawItems, 'cylinderId');
                setHistoryData(grouped);
            }
        } catch (error) {
            console.error(error);
            notifications.show({ title: '오류', message: '거래 이력을 불러오지 못했습니다.', color: 'red' });
        } finally {
            setHistoryLoading(false);
        }
    }, [customer]);

    // Handle Search/Filter
    const handleSearch = () => {
        fetchCustomerHistory(dateRange[0], dateRange[1]);
    };

    const handleResetFilter = () => {
        setDateRange([null, null]);
        setSearchCylinder('');
        setSearchGasType(null);
        fetchCustomerHistory();
    };

    // Filtered Data (Client-side for Cylinder ID & Gas Type)
    const filteredHistory = historyData.filter(item => {
        // Function to check match
        const isMatch = (t: HistoryItem) => {
             if (searchGasType && searchGasType !== '전체' && t.gas !== searchGasType) return false;
             if (searchCylinder && !t.cylinderId.toLowerCase().includes(searchCylinder.toLowerCase())) return false;
             return true;
        };

        // Check Parent
        if (isMatch(item)) return true;

        // Check Children (if any match, show parent)
        if (item.children && item.children.some(c => isMatch(c))) return true;

        return false;
    });

    // Auto-expand if child matched and search is active
    useEffect(() => {
        if (searchCylinder || searchGasType) {
             const newSet = new Set<number>();
             filteredHistory.forEach(item => {
                 if (item.children && item.children.some(c => (searchCylinder && c.cylinderId.toLowerCase().includes(searchCylinder.toLowerCase())) || (searchGasType && searchGasType !== '전체' && c.gas === searchGasType))) {
                      newSet.add(item.id);
                 }
             });
             // Append to existing? or Reset?
             // Resetting might be annoying if user manually expanded others.
             // But usually fine for search results.
             if (newSet.size > 0) setExpandedItems(prev => {
                 const combined = new Set(prev);
                 newSet.forEach(id => combined.add(id));
                 return combined;
             });
        }
    }, [searchCylinder, searchGasType, filteredHistory]); // Dependency on filtered result


    // Fetch History when tab changes to 'history'
    useEffect(() => {
        if (activeTab === 'history' && customer) {
            // Initial fetch without filters
            fetchCustomerHistory();
        }
    }, [activeTab, customer, fetchCustomerHistory]);

    const getActionColor = (type: string) => {
        switch(type) {
            case '납품': return 'cyan';
            case '회수': return 'green';
            default: return 'gray';
        }
    };

    // Print
    const handlePrint = () => {
        window.print();
    };

    const printContent = (
        <div className="customer-print-portal">
            <style jsx global>{`
                @media print {
                    /* Hide everything in body */
                    body > * { display: none !important; }
                    
                    /* Show only our portal */
                    .customer-print-portal { 
                        display: block !important; 
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        background: white;
                        color: black;
                        z-index: 999999;
                        padding: 20px;
                    }
                    
                    /* Ensure other portals are hidden if they leak */
                    .print-portal { display: none !important; }

                    /* Reset Body for Print */
                    body, html { 
                        background-color: white !important; 
                        height: auto; 
                        overflow: visible;
                        font-family: 'Malgun Gothic', sans-serif;
                    }

                    /* Print Content Styling */
                    .print-header { text-align: center; border-bottom: 2px solid black; margin-bottom: 20px; padding-bottom: 10px; }
                    .print-title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
                    .print-subtitle { font-size: 16px; }
                    
                    .print-info { 
                        display: flex; 
                        justify-content: space-between; 
                        border: 1px solid black; 
                        padding: 10px; 
                        margin-bottom: 20px;
                        font-size: 12px;
                    }
                    
                    table.print-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        font-size: 11px; 
                        table-layout: fixed; /* Allow better width control */
                    }
                    th { border-bottom: 2px solid black; text-align: center; padding: 5px; background: #eee !important; -webkit-print-color-adjust: exact; }
                    td { border-bottom: 1px solid #ddd; padding: 6px 4px; vertical-align: middle; word-wrap: break-word; }
                }
                
                @media screen {
                    .customer-print-portal { display: none; }
                }
            `}</style>
            
            <div className="print-header">
                <div className="print-title">{customer?.name} 거래 이력</div>
            </div>

            <div className="print-info">
                <div><strong>조회 기간:</strong> {dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : '전체'} ~ {dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : '전체'}</div>
                <div><strong>가스 종류:</strong> {searchGasType || '전체'}</div>
                <div><strong>용기 번호:</strong> {searchCylinder || '전체'}</div>
            </div>

            <table className="print-table">
                <thead>
                    <tr>
                        <th style={{width: '15%'}}>일시</th>
                        <th style={{width: '8%'}}>구분</th>
                        <th style={{width: '20%'}}>용기번호</th>
                        <th style={{width: '8%'}}>가스</th>
                        <th style={{width: '14%'}}>작업자</th>
                        <th style={{width: '35%'}}>메모</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredHistory.length === 0 ? (
                        <tr><td colSpan={6} style={{textAlign: 'center', padding: '20px'}}>이력 없음</td></tr>
                    ) : (
                        filteredHistory.map(item => (
                            <tr key={item.id}>
                                <td style={{textAlign:'center'}}>{dayjs(item.date).format('YYYY-MM-DD HH:mm')}</td>
                                <td style={{textAlign:'center'}}>{item.type}</td>
                                <td style={{textAlign:'center'}}>{item.cylinderId}</td>
                                <td style={{textAlign:'center'}}>{item.gas}</td>
                                <td style={{textAlign:'center'}}>{userMap[item.worker] || item.worker}</td>
                                <td style={{textAlign:'center'}}>{item.memo}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            
            <div style={{textAlign: 'left', marginTop: '20px', fontSize: '10px', color: '#666'}}>
                출력일시: {dayjs().format('YYYY-MM-DD HH:mm:ss')} | 삼덕용기 관리시스템
            </div>
        </div>
    );

    return (
        <Modal 
            data-testid="customer-detail-modal"
            opened={opened}
            onClose={handleClose}
            closeOnEscape={false}
            fullScreen={isMobile}
            title={
                <Group justify="space-between" w="100%">
                    <Group>
                        <Text fw={700} size="lg">{customer?.name}</Text>
                        <Badge variant="dot" color={customer?.type === 'BUSINESS' ? 'blue' : 'green'}>
                            {customer?.type === 'BUSINESS' ? '사업자' : '개인'}
                        </Badge>
                        {isAdmin && (
                            <>
                                <Button 
                                    variant="outline" 
                                    color="yellow" 
                                    size="compact-xs" 
                                    onClick={openQrModal}
                                >
                                    QR 출력
                                </Button>
                                <ActionIcon variant="light" color="red" onClick={handleDelete} title="삭제">
                                    <IconTrash size={18} />
                                </ActionIcon>
                            </>
                        )}
                    </Group>
                    {/* [FIX] Filter Button moved to Panel (Left Aligned) */}
                </Group>
             }
            centered 
            zIndex={1500} // [FIX] Stacking: Report(1200) < Customer(1500) < History(2000)
            size="xl"
            styles={{ 
                title: { flex: 1 },
                content: { backgroundColor: '#1A1B1E', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }, 
                header: { backgroundColor: '#1A1B1E', color: 'white' },
                body: { backgroundColor: '#1A1B1E', color: 'white' }
            }}

        >
            <LoadingOverlay visible={loading} />
            
            <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md" color="blue">
                <Tabs.List mb="md" grow>
                    <Tabs.Tab value="inventory" leftSection={<IconBuildingWarehouse size={16} />}>
                        재고 현황
                    </Tabs.Tab>
                    <Tabs.Tab value="info" leftSection={<IconInfoCircle size={16} />}>
                        기본 정보
                    </Tabs.Tab>
                    <Tabs.Tab 
                        value="history" 
                        leftSection={
                            activeTab === 'history' ? (
                                <Button 
                                    component="span" 
                                    size="compact-xs" 
                                    variant="filled" 
                                    color="dark" 
                                    radius="sm"
                                    leftSection={<IconFilter size={12} />}
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setShowFilter(!showFilter);
                                    }}
                                    style={{ border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
                                >
                                    필터
                                </Button>
                            ) : (
                                <IconHistory size={16} />
                            )
                        }
                    >
                        거래 이력
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="inventory">
                     {inventoryData ? (
                        <Stack gap="md">
                            <Group justify="space-between" align="center" style={{ backgroundColor: '#25262B', padding: '10px', borderRadius: '8px' }}>
                                <Group gap="xs">
                                    <Text size="sm" c="dimmed">현재 총 보유</Text>
                                    <Badge size="xl" variant="filled" color="blue">
                                        총 {inventoryData.total}개
                                    </Badge>
                                </Group>
                                <Button 
                                    variant="subtle" 
                                    size="xs" 
                                    color="gray" 
                                    leftSection={<IconRefresh size={14} />} 
                                    onClick={() => fetchInventory(customer!.id)}
                                    loading={loading}
                                >
                                    새로고침
                                </Button>
                             </Group>
    
                             <ScrollArea h={450}>
                             <Table stickyHeader withTableBorder withColumnBorders style={{ 
                                    borderRadius: '8px', 
                                    overflow: 'hidden', 
                                    border: '1px solid rgba(255,255,255,0.1)' 
                                }}>
                                    <Table.Thead bg="#2C2E33">
                                        <Table.Tr>
                                            <Table.Th w={100} c="dimmed" style={{ fontSize: '1rem', textAlign: 'center' }}>구분</Table.Th>
                                            <Table.Th c="dimmed" style={{ fontSize: '1rem' }}>일련번호</Table.Th>
                                            <Table.Th w={120} c="dimmed" style={{ fontSize: '1rem' }}>납품일자</Table.Th>
                                            <Table.Th w={100} c="dimmed" style={{ fontSize: '1rem' }}>충전기한</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                    {Object.entries(
                                        (inventoryData.details || []).reduce((acc, curr) => {
                                            const gas = curr.gasType || '기타';
                                            if (!acc[gas]) acc[gas] = [];
                                            acc[gas].push(curr);
                                            return acc;
                                        }, {} as Record<string, CylinderDetail[]>)
                                    ).map(([gasType, items]) => {
                                        // Determine Color
                                        let color = 'gray';
                                        if (gasType.includes('산소') || gasType === 'O2') color = 'green';
                                        else if (gasType.includes('질소') || gasType === 'N2') color = 'blue';
                                        else if (gasType.includes('아르곤') || gasType === 'Ar') color = 'violet';
                                        else if (gasType.includes('탄산') || gasType === 'CO2') color = 'orange';

                                        return items.map((detail, idx) => {
                                            const isLastItem = idx === items.length - 1;
                                            // [UI Request] Clear divider between gas types (Adjusted to 3px)
                                            const borderStyle = isLastItem 
                                                ? '3px solid rgba(255, 255, 255, 0.4)'  // Thicker separator for group end
                                                : '1px solid rgba(255, 255, 255, 0.05)'; // Subtle separator for items within group

                                            return (
                                                <Table.Tr key={`${gasType}-${idx}`} style={{ borderBottom: borderStyle }}>
                                                    {/* Gas Badge Column with RowSpan (Only for first item) */}
                                                    {idx === 0 && (
                                                        <Table.Td 
                                                            rowSpan={items.length} 
                                                            style={{ verticalAlign: 'middle', textAlign: 'center', backgroundColor: '#25262B' }}
                                                        >
                                                            <Badge 
                                                                size="xl" 
                                                                color={color} 
                                                                variant="filled" 
                                                                fullWidth
                                                                h="auto"
                                                                py="sm"
                                                                styles={{ root: { textTransform: 'none', whiteSpace: 'normal', lineHeight: 1.3, height: 'auto' } }}
                                                            >
                                                                <Stack gap={0} align="center">
                                                                     <Text size="xs" fw={700} style={{ opacity: 0.9 }}>{gasType}</Text>
                                                                     <Text size="md" fw={900}>{items.length}개</Text>
                                                                </Stack>
                                                            </Badge>
                                                        </Table.Td>
                                                    )}
                                                    
                                                    <Table.Td fw={500} style={{ fontSize: '1.1rem' }}>
                                                        <Text 
                                                            span 
                                                            c={isAdmin ? "blue" : "dimmed"}
                                                            onClick={isAdmin ? () => handleHistoryClick(detail.serialNumber) : undefined}
                                                            style={{ 
                                                                cursor: isAdmin ? 'pointer' : 'not-allowed',
                                                                textDecoration: isAdmin ? 'underline' : 'none',
                                                                opacity: isAdmin ? 1 : 0.6
                                                            }}
                                                        >
                                                            {detail.serialNumber}
                                                        </Text>
                                                    </Table.Td>
                                                    <Table.Td style={{ fontSize: '1rem', color: '#adb5bd' }}>
                                                        {(detail.lastDeliveryDate && detail.lastDeliveryDate !== '-') ? detail.lastDeliveryDate.split('T')[0] : '-'}
                                                    </Table.Td>
                                                    <Table.Td style={{ fontSize: '1rem' }}>
                                                        <Stack gap={0}>
                                                            <Text 
                                                                span 
                                                                c={(() => {
                                                                    if (!detail.chargingExpiryDate || detail.chargingExpiryDate === '-') return 'dimmed';
                                                                    const diff = dayjs(detail.chargingExpiryDate).diff(dayjs(), 'day');
                                                                    if (diff < 15) return 'red';
                                                                    if (diff <= 30) return 'yellow';
                                                                    return 'white';
                                                                })()}
                                                                fw={(() => {
                                                                    if (!detail.chargingExpiryDate || detail.chargingExpiryDate === '-') return 400;
                                                                    const diff = dayjs(detail.chargingExpiryDate).diff(dayjs(), 'day');
                                                                    if (diff <= 30) return 700;
                                                                    return 400;
                                                                })()}
                                                            >
                                                                {formatExpiryDate(detail.chargingExpiryDate)}
                                                            </Text>
                                                            {(() => {
                                                                 if (!detail.chargingExpiryDate || detail.chargingExpiryDate === '-') return null;
                                                                 const diff = dayjs(detail.chargingExpiryDate).diff(dayjs(), 'day');
                                                                 if (diff < 15) return <Text c="red" size="xs" fw={700}>검사대상</Text>;
                                                                 return null;
                                                                 
                                                            })()}
                                                        </Stack>
                                                    </Table.Td>
                                                </Table.Tr>
                                            );
                                        });
                                    })}

                                    {(!inventoryData.details || inventoryData.details.length === 0) && (
                                        <Table.Tr>
                                            <Table.Td colSpan={4} ta="center" py={50} c="dimmed">보유 재고가 없습니다.</Table.Td>
                                        </Table.Tr>
                                    )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </Stack>
                     ) : (
                         <Text c="dimmed" ta="center" py="xl">재고 정보를 불러오는 중...</Text>
                     )}
                </Tabs.Panel>

                <Tabs.Panel value="info">
                     <Stack gap="sm">
                        <Group grow>
                            <TextInput label="거래처명" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} readOnly={!isAdmin} styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }} />
                            <Box visibleFrom="sm">
                                <Select label="유형" data={typeData} value={formData.type} onChange={(v) => isAdmin && setFormData({...formData, type: v as 'BUSINESS' | 'INDIVIDUAL'})} readOnly={!isAdmin} styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }} comboboxProps={{ zIndex: 2005 }} />
                            </Box>
                            <Box hiddenFrom="sm">
                                <NativeSelect 
                                    label="유형" 
                                    data={[{ value: '', label: '선택' }, ...typeData]}
                                    value={formData.type || ''} 
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => isAdmin && setFormData({...formData, type: e.currentTarget.value as 'BUSINESS' | 'INDIVIDUAL'})} 
                                    disabled={!isAdmin} /* NativeSelect uses disabled for readOnly */
                                    styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40', fontSize: '16px' } }} 
                                />
                            </Box>
                        </Group>
                        <TextInput label="사업자 번호" value={formData.businessNumber || ''} onChange={(e) => setFormData({...formData, businessNumber: e.target.value})} readOnly={!isAdmin} styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }} />
                        <Group grow>
                            <TextInput 
                                label="전화번호" 
                                value={formData.phone || ''} 
                                onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                                readOnly={!isAdmin} 
                                styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }} 
                                rightSection={
                                    formData.phone && (
                                        <ActionIcon 
                                            component="a" 
                                            href={`tel:${formData.phone}`} 
                                            variant="filled" 
                                            color="green" 
                                            size="sm"
                                            title="전화 걸기"
                                        >
                                            <IconPhone size={14} />
                                        </ActionIcon>
                                    )
                                }
                            />
                            <TextInput label="대표자" value={formData.representative || ''} onChange={(e) => setFormData({...formData, representative: e.target.value})} readOnly={!isAdmin} styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }} />
                        </Group>
                        <TextInput 
                            label="주소" 
                            value={formData.address || ''} 
                            onChange={(e) => setFormData({...formData, address: e.target.value})} 
                            readOnly={!isAdmin} 
                            styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }}
                            rightSection={
                                formData.address && (
                                    <ActionIcon 
                                        component="a" 
                                        href={`https://map.naver.com/v5/search/${encodeURIComponent(formData.address)}`} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        variant="filled" 
                                        color="blue" 
                                        size="sm"
                                        title="지도 보기"
                                    >
                                        <IconMap size={14} />
                                    </ActionIcon>
                                )
                            }
                        />
                         <Box visibleFrom="sm">
                            <Select label="결제 유형" data={paymentData} value={formData.paymentType} onChange={(v) => isAdmin && setFormData({...formData, paymentType: v as 'card' | 'cash' | 'transfer' | 'tax_invoice' })} readOnly={!isAdmin} styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }} comboboxProps={{ zIndex: 2005 }} />
                         </Box>
                         <Box hiddenFrom="sm">
                            <NativeSelect 
                                label="결제 유형" 
                                data={[{ value: '', label: '선택' }, ...paymentData]}
                                value={formData.paymentType || ''} 
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => isAdmin && setFormData({...formData, paymentType: e.currentTarget.value as 'card' | 'cash' | 'transfer' | 'tax_invoice' })} 
                                disabled={!isAdmin} 
                                styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40', fontSize: '16px' } }} 
                            />
                         </Box>
                        
                        {isAdmin && (
                            <Button color="blue" onClick={handleSaveInfo} mt="md">정보 수정 저장</Button>
                        )}
                     </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="history">
                    <Box pos="relative" mih={300}>
                         <Collapse in={showFilter}>
                            <Box bg="#25262B" p="sm" mb="md" style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <Stack gap="sm">
                                    <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] }}>
                                        <Group align="center" gap="xs" grow>
                                            <DateInput
                                                value={dateRange[0]}
                                                onChange={(d) => setDateRange([d, dateRange[1]] as [Date | null, Date | null])}
                                                valueFormat="YYYY.MM.DD"
                                                placeholder="시작"
                                                leftSection={<IconCalendar size={18} />}
                                                locale="ko"
                                                size="sm"
                                                popoverProps={{ position: 'bottom', withinPortal: true }}
                                                styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }}
                                            />
                                            <Text c="dimmed" style={{ flexGrow: 0 }}>~</Text>
                                            <DateInput
                                                value={dateRange[1]}
                                                onChange={(d) => setDateRange([dateRange[0], d] as [Date | null, Date | null])}
                                                valueFormat="YYYY.MM.DD"
                                                placeholder="종료"
                                                leftSection={<IconCalendar size={18} />}
                                                locale="ko"
                                                size="sm"
                                                popoverProps={{ position: 'bottom', withinPortal: true }}
                                                styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }}
                                            />
                                        </Group>
                                    </DatesProvider>
                                    <Group grow>
                                        <Select
                                            label="가스 종류"
                                            placeholder="전체"
                                            data={['전체', '산소', '질소', '아르곤', '탄산', '누설체크액', '혼합가스', 'LPG', '기타']}
                                            value={searchGasType}
                                            onChange={setSearchGasType}
                                            searchable
                                            clearable
                                            styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' }, dropdown: { backgroundColor: '#25262B', borderColor: '#373A40' }, option: { color: 'white' } }}
                                        />
                                        <TextInput 
                                            label="용기번호 검색" 
                                            placeholder="일련번호 입력" 
                                            value={searchCylinder}
                                            onChange={(e) => setSearchCylinder(e.currentTarget.value)}
                                            rightSection={<IconSearch size={16} />}
                                            styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }}
                                        />
                                    </Group>
                                    <Group grow mt="xs">
                                        <Button variant="default" onClick={handleResetFilter} leftSection={<IconRefresh size={14}/>}>초기화</Button>
                                        <Button variant="default" onClick={handlePrint} leftSection={<IconPrinter size={14}/>}>출력</Button>
                                        <Button variant="filled" color="blue" onClick={handleSearch} leftSection={<IconSearch size={14}/>}>조회</Button>
                                    </Group>
                                </Stack>
                            </Box>
                         </Collapse>

                        <LoadingOverlay visible={historyLoading} zIndex={10} overlayProps={{ radius: "sm", blur: 2 }} />
                         <ScrollArea h={450}>
                             <Table stickyHeader withTableBorder withColumnBorders style={{ 
                                    borderRadius: '8px', 
                                    overflow: 'hidden', 
                                    border: '1px solid rgba(255,255,255,0.1)' 
                                }}>
                                <Table.Thead bg="#2C2E33">
                                    <Table.Tr>
                                        <Table.Th c="dimmed">일시</Table.Th>
                                        <Table.Th c="dimmed">구분</Table.Th>
                                        <Table.Th c="dimmed">용기번호</Table.Th>
                                        <Table.Th c="dimmed" visibleFrom="sm">가스</Table.Th>
                                        <Table.Th c="dimmed" visibleFrom="sm">작업자</Table.Th>
                                        <Table.Th c="dimmed" visibleFrom="sm">메모</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredHistory.length === 0 ? (
                                        <Table.Tr>
                                            <Table.Td colSpan={6} ta="center" py={40} c="dimmed">
                                                {historyLoading ? '로딩 중...' : '검색 결과가 없습니다.'}
                                            </Table.Td>
                                        </Table.Tr>
                                    ) : (
                                        filteredHistory.map((item) => {
                                            const hasChildren = item.children && item.children.length > 0;
                                            const isExpanded = expandedItems.has(item.id);

                                            return (
                                                <React.Fragment key={item.id}>
                                                    <Table.Tr>
                                                        <Table.Td style={{ color: 'white', fontSize: '0.9rem' }}>
                                                             <Group gap="xs">
                                                                {hasChildren && (
                                                                    <ActionIcon 
                                                                        variant="subtle" 
                                                                        color="gray" 
                                                                        size="sm"
                                                                        onClick={() => toggleExpand(item.id)}
                                                                    >
                                                                         {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                                                    </ActionIcon>
                                                                )}
                                                                {!hasChildren && <Box w={22} />} {/* Spacer alignment */}
                                                                {dayjs(item.date).format('YY.MM.DD HH:mm')}
                                                             </Group>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Badge color={getActionColor(item.type)} variant="light">{item.type}</Badge>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Text 
                                                                size="sm" 
                                                                c={isAdmin ? "blue" : "dimmed"}
                                                                onClick={isAdmin ? () => handleHistoryClick(item.cylinderId) : undefined}
                                                                style={{ 
                                                                    cursor: isAdmin ? 'pointer' : 'not-allowed',
                                                                    textDecoration: isAdmin ? 'underline' : 'none',
                                                                    opacity: isAdmin ? 1 : 0.6
                                                                }}
                                                            >
                                                                {item.cylinderId}
                                                            </Text>
                                                            {hasChildren && (
                                                                <Text size="xs" c="dimmed">
                                                                    (용기 {item.children?.length}본 포함)
                                                                </Text>
                                                            )}
                                                        </Table.Td>
                                                        <Table.Td visibleFrom="sm" style={{ color: '#adb5bd' }}>
                                                            <GasBadge gasType={item.gas} color={item.gasColor} variant="filled" />
                                                        </Table.Td>
                                                        <Table.Td visibleFrom="sm" style={{ color: '#adb5bd' }}>
                                                            {userMap[item.worker] || (item.worker === 'admin' ? '관리자' : item.worker)}
                                                        </Table.Td>
                                                        <Table.Td visibleFrom="sm" style={{ color: '#adb5bd', fontSize: '0.85rem' }}>
                                                            <Text truncate w={150}>{item.memo}</Text>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                    
                                                    {/* Child Rows */}
                                                    {hasChildren && isExpanded && item.children!.map(child => (
                                                        <Table.Tr key={child.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
                                                            <Table.Td style={{ paddingLeft: '40px', color: '#adb5bd', fontSize: '0.85rem' }}>
                                                                <Group gap="xs">
                                                                     <IconCornerDownRight size={12} />
                                                                     {dayjs(child.date).format('HH:mm')}
                                                                </Group>
                                                            </Table.Td>
                                                            <Table.Td colSpan={5} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                                                {child.type} | {child.gas} | {child.memo || '-'}
                                                            </Table.Td>
                                                        </Table.Tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </Table.Tbody>
                            </Table>
                         </ScrollArea>
                    </Box>
                </Tabs.Panel>
            </Tabs>
             
            {printContent}

            {/* Cylinder History Modal Layer */}
             <CylinderHistoryModal 
                opened={historyModalOpen} 
                onClose={closeHistory} 
                cylinderId={selectedCylinderId} 
                isAdmin={isAdmin}
             />
             <QRPrintModal
                opened={qrModalOpened}
                onClose={closeQrModal}
                title="거래처 QR 출력"
                data={customer ? [{
                     id: `CUST-${customer.ledgerNumber || customer.id}`,
                     label: customer.name,
                     subLabel: customer.representative,
                     desc: customer.address
                }] : []}
             />
        </Modal>
    );
}
