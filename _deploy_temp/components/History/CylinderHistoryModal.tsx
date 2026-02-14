'use client';

import { Modal, Table, Badge, Text, Group, Button, Box, LoadingOverlay } from '@mantine/core';
import { createPortal } from 'react-dom';

import { DateInput, DatesProvider } from '@mantine/dates';
import 'dayjs/locale/ko'; // Import Korean Locale
import { useState, useEffect, useCallback } from 'react';
import { IconCalendar, IconRefresh, IconEdit, IconTrash, IconPrinter } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { Cylinder } from '@/lib/types'; // Import types if needed
import { resolveShortHolderName, resolveShortOwnerName } from '@/app/utils/display';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { NewRegistrationForm } from '@/components/Cylinders/NewRegistrationForm';
import { CylinderQRModal } from '@/components/Common/CylinderQRModal';
import { Card } from '@mantine/core';

interface HistoryRecord {
    id: string;
    date: string;
    type: string;
    customer: string;
    worker: string;
    memo: string;
}

interface CylinderHistoryModalProps {
    opened: boolean;
    onClose: () => void;
    cylinderId: string | null;
    isAdmin?: boolean; // [New]
}

import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

export function CylinderHistoryModal({ opened, onClose, cylinderId, isAdmin = false }: CylinderHistoryModalProps) {
    const handleClose = useModalBackTrap(opened, onClose, 'cylinder-history');
    // const handleClose = onClose;

    // [Navigation State]
    const [activeCylinderId, setActiveCylinderId] = useState<string | null>(cylinderId);

    // Sync prop to state when modal opens or prop changes
    useEffect(() => {
        if (opened) {
            setActiveCylinderId(cylinderId);
        }
    }, [opened, cylinderId]);


    // [Hydration Fix] Mounted State
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [cylinderInfo, setCylinderInfo] = useState<Cylinder | null>(null);
    const [locationName, setLocationName] = useState('');
    const isMobile = useMediaQuery('(max-width: 50em)');

    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
    const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
    const [qrModalOpen, { open: openQrModal, close: closeQrModal }] = useDisclosure(false);
    const handleEditClose = useModalBackTrap(editOpened, closeEdit, 'cylinder-edit');



    const fetchHistory = useCallback(async () => {
        if (!activeCylinderId) return;
        setLoading(true);
        try {
            let url = `/api/history/cylinder?id=${activeCylinderId}`;
            if (dateRange[0]) url += `&startDate=${dayjs(dateRange[0]).format('YYYY-MM-DD')}`;
            if (dateRange[1]) url += `&endDate=${dayjs(dateRange[1]).format('YYYY-MM-DD')}`;

            const res = await fetch(url);
            const data = await res.json();
            
            if (data.success) {
                setHistory(data.data.history);
                setCylinderInfo(data.data.cylinder);
                setLocationName(data.data.currentLocationName);
            } else {
                notifications.show({ title: '오류', message: data.message, color: 'red' });
            }
        } catch (error) {
            console.error(error);
            notifications.show({ title: '오류', message: '데이터 로드 실패', color: 'red' });
        } finally {
            setLoading(false);
        }
    }, [activeCylinderId, dateRange]);

    const handleDelete = async () => {
        if (!cylinderId) return;

        modals.openConfirmModal({
            title: '삭제 확인',
            children: (
                <Text size="sm">
                    정말 삭제하시겠습니까? 관련 이력은 유지되지만 용기 목록에서는 사라집니다.
                </Text>
            ),
            labels: { confirm: '예', cancel: '아니요' },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                setLoading(true);
                try {
                    const res = await fetch(`/api/master/cylinders?id=${cylinderId}`, { method: 'DELETE' });
                    if (res.ok) {
                        notifications.show({ title: '성공', message: '용기가 삭제되었습니다.', color: 'blue' });
                        onClose();
                    } else {
                        notifications.show({ title: '오류', message: '삭제 실패', color: 'red' });
                    }
                } catch {
                     notifications.show({ title: '오류', message: '삭제 중 오류 발생', color: 'red' });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    useEffect(() => {
        if (opened && activeCylinderId) {
            fetchHistory();
        }
    }, [opened, activeCylinderId, fetchHistory]);

    // Action Color Logic
    const getActionColor = (type: string) => {
        switch(type) {
            case '충전': return 'blue';
            case '충전시작': return 'orange';
            case '충전완료': return 'blue';
            case '납품': return 'cyan'; // Clean differentiation
            case '회수': return 'green';
            case '검사입고': return 'orange';
            case '검사출고': return 'violet';
            case '폐기': return 'red';
            case '재검사': return 'orange';
            default: return 'gray';
        }
    };

    // [New] Translation Helper for Seed Data
    const translateMemo = (memo: string) => {
        if (!memo) return '-';
        if (memo.includes('Hyper-Real Seed')) {
            if (memo.includes('NORMAL_DELIVERY')) return '초기 데이터: 일반 납품';
            if (memo.includes('URGENT_DELIVERY')) return '초기 데이터: 긴급 납품';
            if (memo.includes('COLLECTION')) return '초기 데이터: 회수';
            if (memo.includes('CHARGING')) return '초기 데이터: 충전';
            if (memo.includes('INSPECTION')) return '초기 데이터: 검사';
            return '초기 데이터 (자동 생성)';
        }
        return memo;
    };


    const handlePrint = () => {
        window.print();
    };

    const printContent = (
        <div className="print-portal">
            <style jsx global>{`
                @media print {
                    /* Hide everything in body */
                    body > * { display: none !important; }
                    
                    /* Show only our portal */
                    .print-portal { 
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
                    }
                    th { border-bottom: 2px solid black; text-align: left; padding: 5px; background: #eee !important; -webkit-print-color-adjust: exact; }
                    td { border-bottom: 1px solid #ddd; padding: 6px 4px; vertical-align: top; }
                }
                
                @media screen {
                    .print-portal { display: none; }
                }
            `}</style>
            
            <div className="print-header">
                <div className="print-title">용기 이력 추적</div>
                <div className="print-subtitle">{cylinderId}</div>
            </div>

            <div className="print-info">
                <div><strong>가스종류:</strong> {cylinderInfo?.gasType || '-'}</div>
                <div><strong>현재위치:</strong> {locationName || '-'}</div>
                <div><strong>현재상태:</strong> {cylinderInfo?.status || '-'}</div>
            </div>

            <table className="print-table">
                <thead>
                    <tr>
                        <th style={{width: '15%'}}>일시</th>
                        <th style={{width: '10%'}}>구분</th>
                        <th style={{width: '20%'}}>거래처/위치</th>
                        <th style={{width: '45%'}}>내용(메모)</th>
                        <th style={{width: '10%'}}>작업자</th>
                    </tr>
                </thead>
                <tbody>
                    {history.length === 0 ? (
                        <tr><td colSpan={5} style={{textAlign: 'center', padding: '20px'}}>이력 없음</td></tr>
                    ) : (
                        history.map(row => (
                            <tr key={row.id}>
                                <td>{row.date}</td>
                                <td>{row.type}</td>
                                <td style={{fontWeight: 'bold'}}>{row.customer}</td>
                                <td>{translateMemo(row.memo)}</td>
                                <td>{row.worker}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            
            <div style={{textAlign: 'right', marginTop: '20px', fontSize: '10px', color: '#666'}}>
                출력일시: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
            </div>
        </div>
    );

    return (
        <>
            <Modal 
                opened={opened} 
                onClose={handleClose}
                closeOnEscape={false}
                title={
                    <Group gap="lg" align="center">
                        <Text fw={700} size="lg">용기 이력 추적</Text>
                        
                        <Group gap="sm" style={{ flexWrap: 'wrap' }}>
                            {/* Serial */}
                            <Group gap={4}>
                                <Text size="xs" c="dimmed">용기번호</Text>
                                {cylinderInfo?.serialNumber ? (
                                    <Badge size="lg" variant="filled" color="dark">{cylinderInfo.serialNumber}</Badge>
                                ) : (
                                    activeCylinderId && <Badge size="lg" variant="filled" color="dark">{activeCylinderId}</Badge>
                                )}
                            </Group>

                            {cylinderInfo && (
                                <>
                                    {/* Gas Type */}
                                    <Group gap={4}>
                                        <Text size="xs" c="dimmed">가스종류</Text>
                                        <Badge variant="light" color="teal" size="lg">
                                            {cylinderInfo.gasType}{cylinderInfo.containerType === 'RACK' ? ' (렉)' : ''}
                                        </Badge>
                                    </Group>

                                    {/* Charging Expiry */}
                                    <Group gap={4}>
                                        <Text size="xs" c="dimmed">충전기한</Text>
                                        <Badge variant="light" color="orange" size="lg">
                                            {cylinderInfo.chargingExpiryDate ? dayjs(cylinderInfo.chargingExpiryDate).format('YYYY.MM') : '-'}
                                        </Badge>
                                    </Group>

                                    {/* Owner */}
                                    <Group gap={4}>
                                        <Text size="xs" c="dimmed">소유자</Text>
                                        <Badge variant="light" color="indigo" size="lg">
                                            {resolveShortOwnerName(cylinderInfo.owner) || '-'}
                                        </Badge>
                                    </Group>
                                </>
                            )}
                        </Group>
                    </Group>
                } 
                size="xl" 
                centered
                zIndex={2000} // [FIX] Ensure it appears above SafetyReports (1200)
                styles={{
                    header: { backgroundColor: '#1A1B1E', color: 'white' },
                    content: { backgroundColor: '#1A1B1E', color: 'white', border: '1px solid rgba(255,255,255,0.1)' },
                    body: { backgroundColor: '#1A1B1E' }
                }}

            >

            <Box pos="relative" mih={400}>
                <LoadingOverlay visible={loading} zIndex={100} overlayProps={{ radius: "sm", blur: 2 }} />
                
                {/* Header Info & Filter */}
                <Box mb="lg">
                    {/* [Layout Change] Info Row: Location/Status (Left) + Buttons (Right) */}
                    <Group justify="space-between" align="center">
                        {/* Left: Info */}
                        <Box style={{ flex: 1 }}>
                            {cylinderInfo && (
                                <Group gap="md" wrap={isMobile ? "wrap" : "nowrap"}>
                                    {/* Current Location */}
                                    <Box>
                                        <Text size="xs" c="dimmed" className="no-print">현재위치</Text>
                                        <Text fw={700} c="white" style={{color: 'white'}}>
                                            {resolveShortHolderName(locationName)}
                                        </Text>
                                    </Box>
                                    {/* Current Status */}
                                    <Box>
                                        <Text size="xs" c="dimmed" className="no-print">현재상태</Text>
                                        <Badge variant="dot" size="lg"
                                            color={
                                                cylinderInfo.status === '실병' ? 'green' :
                                                cylinderInfo.status === '공병' ? 'gray' :
                                                cylinderInfo.status === '충전중' ? 'orange' :
                                                cylinderInfo.status === '납품' ? 'blue' :
                                                cylinderInfo.status === '검사대상' ? 'pink' :
                                                cylinderInfo.status === '검사중' ? 'violet' : 'red'
                                            }
                                        >
                                            {cylinderInfo.status}
                                        </Badge>
                                    </Box>
                                </Group>
                            )}
                        </Box>

                        {/* Right: Action Buttons (Moved from Header) */}
                        <Group>
                            {cylinderInfo && (
                                <Group gap={5} className="no-print">
                                    <Button size="xs" variant="light" color="gray" leftSection={<IconPrinter size={14}/>} onClick={handlePrint}>출력</Button>
                                    {isAdmin && (
                                        <>
                                            <Button size="xs" variant="light" color="gray" leftSection={<IconEdit size={14}/>} onClick={openEdit}>수정</Button>
                                            <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14}/>} onClick={handleDelete}>삭제</Button>
                                        </>
                                    )}
                                </Group>
                            )}
                        </Group>
                    </Group>



                    {/* [RACK SUPPORT] Show Child Cylinders */}
                    {cylinderInfo?.containerType === 'RACK' && cylinderInfo.childSerials && (
                       <Box mb="md" p="sm" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                           <Group justify="space-between" mb="xs" onClick={() => { /* Toggle logic if needed */ }}>
                               <Text size="sm" fw={700} c="dimmed">
                                   포함된 용기 ({cylinderInfo.childSerials.length}개)
                               </Text>
                           </Group>
                           <Group gap={8}>
                               {cylinderInfo.childSerials.map((childSerial) => (
                                   <Badge 
                                       key={childSerial} 
                                       variant="outline" 
                                       color="gray" 
                                       size="md"
                                       style={{ cursor: 'pointer' }}
                                       onClick={() => {
                                            if (childSerial) {
                                                // [Navigation] Switch to Child History
                                                setActiveCylinderId(childSerial);
                                            }
                                       }}
                                   >
                                       {childSerial}
                                   </Badge>
                               ))}
                           </Group>
                       </Box>
                    )}

                    {/* [Back to Parent Navigation] */}
                    {cylinderInfo?.parentRackId && cylinderInfo.containerType !== 'RACK' && (
                        <Box mb="md" p="sm" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                             <Group justify="space-between" mb="xs">
                                <Text size="sm" fw={700} c="dimmed">
                                    상위 렉 (Parent Rack)
                                </Text>
                            </Group>
                            <Button 
                                variant="light" 
                                color="orange" 
                                size="xs"
                                onClick={() => {
                                     // Navigate to Parent Rack
                                     if (cylinderInfo.parentRackId) {
                                         setActiveCylinderId(cylinderInfo.parentRackId);
                                     }
                                }}
                            >
                                상위 렉으로 이동
                            </Button>
                        </Box>
                    )}

                    <Group align="center" mt="md" wrap="nowrap">
                         <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] }}>
                            <Group align="center" gap={5} style={{ flex: 1 }}>
                                <DateInput
                                    value={dateRange[0]}
                                    onChange={(d) => setDateRange([d as Date | null, dateRange[1]])}
                                    valueFormat="YY.MM.DD"
                                    placeholder="시작"
                                    popoverProps={{ withinPortal: true, position: 'bottom-start' }}
                                    inputMode="none"
                                    leftSection={<IconCalendar size={16} />}
                                    locale="ko"
                                    size="sm"
                                    style={{ flex: 1 }}
                                    styles={{
                                        input: {
                                            backgroundColor: '#25262B',
                                            border: '1px solid #373A40',
                                            color: 'white',
                                            fontSize: '13px',
                                            textAlign: 'center',
                                            paddingLeft: '30px',
                                            paddingRight: '5px'
                                        }
                                    }}
                                />
                                <Text c="dimmed" size="xs">~</Text>
                                <DateInput
                                    value={dateRange[1]}
                                    onChange={(d) => setDateRange([dateRange[0], d as Date | null])}
                                    valueFormat="YY.MM.DD"
                                    placeholder="종료"
                                    popoverProps={{ withinPortal: true, position: 'bottom-start' }}
                                    inputMode="none"
                                    leftSection={<IconCalendar size={16} />}
                                    locale="ko"
                                    size="sm"
                                    style={{ flex: 1 }}
                                    styles={{
                                        input: {
                                            backgroundColor: '#25262B',
                                            border: '1px solid #373A40',
                                            color: 'white',
                                            fontSize: '13px',
                                            textAlign: 'center',
                                            paddingLeft: '30px',
                                            paddingRight: '5px'
                                        }
                                    }}
                                />
                            </Group>
                        </DatesProvider>
                        <Button variant="light" color="gray" onClick={fetchHistory} className="no-print" size="sm" px="xs">
                            <IconRefresh size={16}/>
                        </Button>
                        {isAdmin && (
                            <Button variant="light" color="indigo" onClick={openQrModal} className="no-print" size="sm" px="xs">
                                <Text fw={900} size="xs">QR</Text>
                            </Button>
                        )}
                    </Group>
                </Box>

                {/* Desktop Table View */}
                <Box visibleFrom="sm" style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                    <Table verticalSpacing="sm" striped highlightOnHover>
                        <Table.Thead style={{ backgroundColor: '#25262B' }}>
                            <Table.Tr>
                                <Table.Th style={{ color: '#ced4da' }}>일시</Table.Th>
                                <Table.Th style={{ color: '#ced4da' }}>작업 구분</Table.Th>
                                <Table.Th style={{ color: '#ced4da' }}>내용 (메모)</Table.Th>
                                <Table.Th style={{ color: '#ced4da' }}>거래처 / 위치</Table.Th>
                                <Table.Th style={{ color: '#ced4da' }}>작업자</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {history.length === 0 ? (
                                <Table.Tr>
                                    <Table.Td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'gray' }}>
                                        이력 데이터가 없습니다.
                                    </Table.Td>
                                </Table.Tr>
                            ) : (
                                history.map((record) => (
                                    <Table.Tr key={record.id}>
                                        <Table.Td style={{ color: 'white' }}>{record.date}</Table.Td>
                                        <Table.Td>
                                            <Badge color={getActionColor(record.type)} variant="light" size="md">
                                                {record.type}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td style={{ color: '#e9ecef', maxWidth: '300px' }}>
                                            <Text truncate size="sm">{translateMemo(record.memo)}</Text>
                                        </Table.Td>
                                        <Table.Td style={{ color: 'white' }}>{resolveShortHolderName(record.customer)}</Table.Td>
                                        <Table.Td style={{ color: 'dimmed' }}>{record.worker}</Table.Td>
                                    </Table.Tr>
                                ))
                            )}
                        </Table.Tbody>
                    </Table>
                </Box>

                {/* Mobile Card View (and Print View) */}
                <Box hiddenFrom="sm" className="history-card-container">
                     {history.length === 0 ? (
                        <Box style={{ textAlign: 'center', padding: '40px', color: 'gray' }}>
                             이력 데이터가 없습니다.
                        </Box>
                    ) : (
                        <Box>
                            {history.map((record) => (
                                <Card key={record.id} withBorder radius="md" p="sm" mb="sm" 
                                    className="history-card"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <Group justify="space-between" mb="xs" className="history-card-date-group">
                                        <Text size="sm" c="dimmed" className="history-card-date">{record.date}</Text>
                                        <Badge color={getActionColor(record.type)} variant="light" size="sm">
                                            {record.type}
                                        </Badge>
                                    </Group>
                                    
                                    <Text fw={700} color="white" size="md" mb={4} className="history-card-customer">
                                        {resolveShortHolderName(record.customer)}
                                    </Text>
                                    
                                    <Group justify="space-between" align="flex-start" gap="xs" className="history-card-memo-group">
                                        <Text size="sm" c="gray.5" style={{ flex: 1, lineHeight: 1.4 }} className="history-card-memo">
                                            {translateMemo(record.memo)}
                                        </Text>
                                        <Text size="xs" c="dimmed" className="history-card-worker" style={{ whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                            {record.worker}
                                        </Text>
                                    </Group>
                                    

                                </Card>
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>


             <Modal opened={editOpened} onClose={handleEditClose} title="용기 정보 수정" centered size="lg" closeOnEscape={false}>
                {cylinderInfo && (
                    <NewRegistrationForm 
                        initialData={cylinderInfo}
                        onCancel={handleEditClose} 
                        onSuccess={() => {
                            handleEditClose();
                            fetchHistory(); // Refresh header info
                        }} 
                    />
                )}
            </Modal>
        </Modal>

        <CylinderQRModal 
            opened={qrModalOpen} 
            onClose={closeQrModal} 
            serial={cylinderId} 
            owner={cylinderInfo?.owner || null} 
        />

        {/* Render Print View into Body using Portal */}
        {/* Render Print View into Body using Portal - Client Only */}
        {/* Render Print View into Body using Portal - Client Only */}
        {mounted && opened && createPortal(printContent, document.body)}
        </>
    );
}
