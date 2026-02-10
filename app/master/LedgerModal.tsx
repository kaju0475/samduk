'use client';

import { Modal, Button, Table, Text, Group, Box, ScrollArea, LoadingOverlay, Textarea, Stack } from '@mantine/core';
import { Fragment, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconPrinter, IconCalendar } from '@tabler/icons-react';
// import { useReactToPrint } from 'react-to-print'; // Removed
import { DateInput, DatesProvider } from '@mantine/dates';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
// import updateLocale from 'dayjs/plugin/updateLocale'; // Unused

import { Customer, GasItem, User } from '@/lib/types';

// Configure dayjs to start week on Sunday (0)
// We will use standard 'ko' but enforce firstDayOfWeek in DatesProvider


// Interface for API response
interface DeliveryRecord {
    id: string;
    customer: string; // Customer Name
    gas: string;      // Gas Name
    type: '납품' | '회수';
    date: string;     // Formatted Date string
    cylinderId: string;
    worker: string;
    customerId?: string; // Optional ID
    containerType?: string; // [Fix] Added for Rack Filtering
}

import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

interface LedgerModalProps {
  opened: boolean;
  onClose: () => void;
}

export function LedgerModal({ opened, onClose }: LedgerModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isMounted, setIsMounted] = useState(false);
  


  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const handleClose = useModalBackTrap(opened, onClose, 'ledger');
  
  // No need for useEffect hack if we define it globally above
  
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<DeliveryRecord[]>([]);
  const [gasItems, setGasItems] = useState<GasItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Daily Ledger Notes State
  const [depositNote, setDepositNote] = useState('');
  const [expenditureNote, setExpenditureNote] = useState('');

  // Fetch Daily Notes when Date Changes
  useEffect(() => {
    const fetchNotes = async () => {
        if (!selectedDate) return;
        const dateStr = dayjs(selectedDate).format('YYYY-MM-DD');
        try {
            const res = await fetch(`/api/master/ledger-notes?date=${dateStr}`);
            const json = await res.json();
            if (json.success && json.data) {
                setDepositNote(json.data.deposit || '');
                setExpenditureNote(json.data.expenditure || '');
            } else {
                setDepositNote('');
                setExpenditureNote('');
            }
        } catch (error) {
            console.error("Failed to fetch notes", error);
        }
    };
    fetchNotes();
  }, [selectedDate, opened]);

  // Save Notes (onBlur)
  const handleSaveNote = async () => {
      if (!selectedDate) return;
      const dateStr = dayjs(selectedDate).format('YYYY-MM-DD');
      
      try {
          await fetch('/api/master/ledger-notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  date: dateStr,
                  deposit: depositNote,
                  expenditure: expenditureNote
              })
          });
      } catch (error) {
          console.error("Failed to save notes", error);
      }
  };

  // Fetch Data
  useEffect(() => {
    if (opened) {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all necessary data
                const [custRes, txRes, gasRes, userRes] = await Promise.all([
                    fetch('/api/master/customers'),
                    fetch('/api/work/delivery'), 
                    fetch('/api/master/gases'),
                    fetch('/api/master/users')
                ]);

                const custData = await custRes.json();
                const txData = await txRes.json();
                const gasData = await gasRes.json();
                const userData = await userRes.json();

                if (custData.success) setCustomers(custData.data);
                if (txData.success) setTransactions(txData.data);
                if (gasData.success) setGasItems(gasData.data);
                if (userData.success) setUsers(userData.data);

            } catch (error) {
                console.error("Failed to fetch ledger data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }
  }, [opened]);

  /* REMOVED useReactToPrint */
  const handlePrint = () => {
    window.print();
  };

  // Fixed Column Definition
  const gasColumns = [
    { label: '산소', key: 'o2' },
    { label: 'CO2\n20kg', key: 'co2_20' },
    { label: 'CO2\n40kg', key: 'co2_40' },
    { label: '알곤', key: 'ar' },
    { label: '질소', key: 'n2' },
    { label: 'AC', key: 'ac' },
    { label: 'L-O2', key: 'lo2' },
    { label: 'L-N2', key: 'ln2' },
    { label: 'L-AR', key: 'lar' },
    { label: '수소', key: 'h2' },
    { label: '헬륨', key: 'he' },
    { label: '', key: 'blank1' },
    { label: '', key: 'blank2' },
    { label: '', key: 'blank3' },
    { label: '', key: 'blank4' },
  ];

  // Helper to normalize gas names for matching
  const normalizeGasName = (name: string) => name.replace(/\s+/g, '').toUpperCase();

  // Helper to match gas item to column key
  const getColumnKey = (gasName: string, capacity?: string): string | null => {
      const nName = normalizeGasName(gasName);
      const nCap = capacity ? normalizeGasName(capacity) : '';

      if (nName.includes('산소') || nName.includes('O2') || nName.includes('OXYGEN')) {
          if (nName.includes('L-') || nName.includes('액체')) return 'lo2';
          return 'o2';
      }
      if (nName.includes('CO2') || nName.includes('탄산')) {
          if (nCap.includes('20')) return 'co2_20';
          if (nCap.includes('40')) return 'co2_40';
          return 'co2_20'; // Fallback
      }
      if (nName.includes('알곤') || nName.includes('ARGON') || nName.includes('AR')) {
          if (nName.includes('L-') || nName.includes('액체')) return 'lar';
          return 'ar';
      }
      if (nName.includes('질소') || nName.includes('NITROGEN') || nName.includes('N2')) {
          if (nName.includes('L-') || nName.includes('액체')) return 'ln2';
          return 'n2';
      }
      if (nName.includes('아세틸렌') || nName.includes('ACETYLENE') || nName.includes('AC')) return 'ac';
      if (nName.includes('수소') || nName.includes('HYDROGEN') || nName.includes('H2')) return 'h2';
      if (nName.includes('헬륨') || nName.includes('HELIUM') || nName.includes('HE')) return 'he';

      return null;
  };



  // Aggregate Data based on Selected Date
  const getAggregatedRows = () => {
    if (!selectedDate) return [];

    const dateStr = dayjs(selectedDate).format('YYYY-MM-DD'); 
    
    // Filter transactions for the selected date
    const dailyTx = transactions.filter(tx => {
        return tx.date.startsWith(dateStr);
    });

    // Map structure: CustomerID -> { counts: Record<string, { del: number, col: number }>, worker: string, name: string }
    interface AggregatedData {
        counts: Record<string, { del: number; col: number }>;
        worker: string;
        name: string;
    }
    const dataMap: Record<string, AggregatedData> = {};

    dailyTx.forEach(tx => {
        // Find Customer
        const custObj = customers.find(c => c.name === tx.customer);
        const custId = tx.customerId || custObj?.id;
        const custName = tx.customer || custObj?.name;
        
        if (!custId || !custName) return;

        // [Fix] Exclude RACK housing from count (only count contents)
        if (tx.containerType === 'RACK') return;
        
        // Initialize if not exists
        if (!dataMap[custId]) dataMap[custId] = { counts: {}, worker: '', name: custName };

        // Capture Worker (First one wins, or mostly recent)
        // Resolve worker name logic
        if (!dataMap[custId].worker && tx.worker) {
            let displayWorker = tx.worker;
            if (tx.worker === 'WORKER-DEFAULT') {
                displayWorker = '관리자';
            } else {
                 const matchedUser = users.find(u => u.id === tx.worker);
                 if (matchedUser) {
                    displayWorker = matchedUser.name;
                 } else {
                    displayWorker = tx.worker.replace('WORKER-', '');
                 }
            }
            dataMap[custId].worker = displayWorker;
        }

        // Identify Gas Column Key
        const gasItem = gasItems.find(g => g.name === tx.gas);
        const gasName = gasItem ? gasItem.name : tx.gas;
        const capacity = gasItem ? gasItem.capacity : ''; 

        const key = getColumnKey(gasName, capacity);
        if (!key) return; 

        if (!dataMap[custId].counts[key]) dataMap[custId].counts[key] = { del: 0, col: 0 };

        if (tx.type === '납품') {
            dataMap[custId].counts[key].del += 1;
        } else if (tx.type === '회수') {
            dataMap[custId].counts[key].col += 1;
        }
    });

    // Convert map to rows
    const customerRows = Object.values(dataMap).map(d => ({
        name: d.name,
        data: d.counts,
        worker: d.worker
    }));

    // Pad with empty rows if needed (Optional, keeping for layout stability)
    // Pad with empty rows if needed (Optional, keeping for layout stability)
    const MIN_ROWS = 16; // Fixed 16 rows as requested
    while (customerRows.length < MIN_ROWS) {
        customerRows.push({ name: '', data: {}, worker: '' })
    }

    return customerRows;
  };

  const rows = getAggregatedRows();

  // Pagination Logic for Print
  const ROWS_PER_PAGE = 15; // Reduced to 15 to accommodate Total Row without overflow
  const pages = [];
  // Filter out screen-view padding (empty rows) to prevent 16 vs 15 mismatch creating an extra page
  const rawRows = rows.filter(r => r.name && r.name.trim() !== ''); 
  
  // Ensure we have at least one page
  if (rawRows.length === 0) {
      const emptyPage = [];
      for(let i=0; i<ROWS_PER_PAGE; i++) emptyPage.push({ name: '', data: {} as Record<string, { del: number; col: number }>, worker: '' });
      pages.push(emptyPage);
  } else {
      for (let i = 0; i < rawRows.length; i += ROWS_PER_PAGE) {
        const chunk = rawRows.slice(i, i + ROWS_PER_PAGE);
        // Pad chunk to ROWS_PER_PAGE
        while (chunk.length < ROWS_PER_PAGE) {
            chunk.push({ name: '', data: {} as Record<string, { del: number; col: number }>, worker: '' });
        }
        pages.push(chunk);
      }
  }

  // Calculate Grand Totals once
  const grandTotals: Record<string, { del: number, col: number }> = {};
  gasColumns.forEach(gas => {
      grandTotals[gas.key] = { del: 0, col: 0 };
      rows.forEach(r => {
          const d = r.data && r.data[gas.key];
          if(d?.del) grandTotals[gas.key].del += d.del;
          if(d?.col) grandTotals[gas.key].col += d.col;
      });
  });



  // Print Portal Content
  const printContent = (
    <div className="print-portal">
        <style jsx global>{`
            @media print {
                @page { size: A4 landscape; margin: 0; }
                body > * { display: none !important; }
                .print-portal { 
                    display: block !important; 
                    width: 100%; 
                    height: 100%; 
                    font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
                    background-color: white;
                }
                
                /* Reset */
                .print-portal * {
                    box-sizing: border-box;
                    color: black !important;
                }

                .print-page {
                    width: 100%;
                    min-height: 100%;
                    padding: 5mm 5mm 5mm 25mm; /* Increased Left Padding for binding */
                    page-break-after: always;
                    position: relative;
                    display: block;
                }
                .print-page:last-child {
                    page-break-after: auto;
                }

                .print-header {
                    text-align: center;
                    margin-bottom: 5px;
                    position: relative;
                    height: 40px;
                }
                .print-title {
                    font-size: 18pt;
                    font-weight: bold;
                    text-decoration: underline;
                    text-underline-offset: 5px;
                }
                .print-meta {
                    position: absolute;
                    right: 0;
                    bottom: 0;
                    font-size: 9pt;
                    text-align: right;
                }

                /* Table Styles */
                .print-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 8pt; 
                    margin-bottom: 5px; /* Reduced margin */
                }
                .print-table th, .print-table td {
                    border: 1px solid black;
                    padding: 1px 2px;
                    text-align: center;
                    height: 30px; /* Increased row height for better visibility & buffer */
                }
                .print-table th {
                    background-color: #f0f0f0 !important; 
                    font-weight: bold;
                }

                /* Diagonal Header Simulation for Print */
                .diagonal-header {
                    position: relative;
                    width: 100%;
                    height: 48px; 
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .th-item-div { text-align: right; padding-right: 2px; font-size: 8pt; }
                .th-cust-div { text-align: left; padding-left: 2px; padding-bottom: 0; font-size: 8pt; }

                /* Helper classes */
                .text-left { text-align: left !important; padding-left: 4px !important; }
                .font-bold { font-weight: bold; }
                
                /* Aggressive Page Break Avoidance for Totals */
                .no-break { page-break-inside: avoid; }
                
                .footer-signature {
                    text-align: right; 
                    margin-top: 5px; 
                    font-size: 9pt;
                }
            }
            @media screen {
                .print-portal { display: none; }
            }
        `}</style>
        
        {pages.map((pageRows, pageIndex) => (
            <div key={pageIndex} className="print-page">
                <div className="print-header">
                    <div className="print-title">매 출 대 장</div>
                    <div className="print-meta">
                        <div>날짜: {dayjs(selectedDate).format('YYYY년 MM월 DD일')}</div>
                        <div>Page {pageIndex + 1} / {pages.length}</div>
                    </div>
                </div>

                <table className="print-table">
                    <thead>
                        <tr>
                            <th rowSpan={2} style={{ width: '80px', padding: 0, height: '48px' }}>
                                  <div className="diagonal-header" style={{ height: '48px' }}>
                                      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
                                          <line x1="0" y1="0" x2="100%" y2="100%" stroke="black" strokeWidth="1" />
                                      </svg>
                                      <div className="th-item-div">품명</div>
                                      <div className="th-cust-div">거래처</div>
                                  </div>
                            </th>
                            {gasColumns.map(gas => (
                                <th key={gas.key} colSpan={2} style={{ height: '24px' }}>{gas.label.replace('\n', ' ')}</th>
                            ))}
                        </tr>
                        <tr>
                            {gasColumns.map(gas => (
                                <Fragment key={gas.key}>
                                    <th style={{ height: '24px' }}>납품</th>
                                    <th style={{ height: '24px' }}>회수</th>
                                </Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                          {pageRows.map((row, idx) => (
                              <tr key={idx}>
                                  <td className="text-left font-bold">
                                      {row.name}
                                      {row.worker && <span style={{ fontSize: '7pt', fontWeight: 'normal', marginLeft: '4px' }}>({row.worker})</span>}
                                  </td>
                                  {gasColumns.map(gas => {
                                      const cellData = row.data && row.data[gas.key]; 
                                      return (
                                          <Fragment key={gas.key}>
                                              <td>{cellData?.del > 0 ? cellData.del : ''}</td>
                                              <td>{cellData?.col > 0 ? cellData.col : ''}</td>
                                          </Fragment>
                                      );
                                  })}
                              </tr>
                          ))}
                          
                          {/* Page Subtotal Row (Appears on EVERY page) */}
                          <tr style={{ borderTop: '2px solid black' }}>
                              <td className="font-bold">계</td>
                              {gasColumns.map(gas => {
                                  // Calculate Page Subtotal
                                  let pageDel = 0;
                                  let pageCol = 0;
                                  pageRows.forEach(r => {
                                      const d = r.data && r.data[gas.key];
                                      if(d?.del) pageDel += d.del;
                                      if(d?.col) pageCol += d.col;
                                  });
                                  
                                  return (
                                      <Fragment key={gas.key}>
                                          <td className="font-bold">{pageDel > 0 ? pageDel : '-'}</td>
                                          <td className="font-bold">{pageCol > 0 ? pageCol : '-'}</td>
                                      </Fragment>
                                  );
                              })}
                          </tr>
                          
                          {/* Last Page: Grand Totals & Notes */}
                          {pageIndex === pages.length - 1 && (
                              <>
                                  {/* Grand Total Row - Only show if there are multiple pages */}
                                  {pages.length > 1 && (
                                    <tr style={{ borderTop: '2px double black', backgroundColor: '#f8f9fa' }} className="no-break">
                                        <td className="font-bold">하루 매출 계</td>
                                        {gasColumns.map(gas => {
                                            const totalDel = grandTotals[gas.key].del;
                                            const totalCol = grandTotals[gas.key].col;
                                            return (
                                                <Fragment key={gas.key}>
                                                    <td className="font-bold">{totalDel > 0 ? totalDel : '-'}</td>
                                                    <td className="font-bold">{totalCol > 0 ? totalCol : '-'}</td>
                                                </Fragment>
                                            );
                                        })}
                                    </tr>
                                  )}
                                  
                                  {/* Notes */}
                                  <tr className="no-break">
                                      <td className="font-bold">입금</td>
                                      <td colSpan={13} className="text-left" style={{ verticalAlign: 'top', height: '60px', whiteSpace: 'pre-wrap' }}>
                                          {depositNote}
                                      </td>
                                      <td colSpan={4} className="font-bold">지출</td>
                                      <td colSpan={13} className="text-left" style={{ verticalAlign: 'top', height: '60px', whiteSpace: 'pre-wrap' }}>
                                          {expenditureNote}
                                      </td>
                                  </tr>
                              </>
                          )}
                    </tbody>
                </table>
                
                <div className="footer-signature">
                    삼덕가스공업(주)
                </div>
            </div>
        ))}
    </div>
  );

  return (
    <>
    <Modal 
      opened={opened} 
      onClose={handleClose} 
      title="" 
      fullScreen
      padding={0}
      styles={{ 
        body: { padding: 0, backgroundColor: '#141517' }, // Dark bg to match report
        header: { display: 'none' },
        content: { backgroundColor: '#141517' } 
      }}
      withCloseButton={false} 
    >
      <Box h="100vh" display="flex" style={{ flexDirection: 'column' }}>
        <LoadingOverlay visible={loading} />
        
        {/* Printable Content Area */}
        <ScrollArea style={{ flex: 1, padding: 0 }}>
            <div ref={contentRef} style={{ padding: '20px', backgroundColor: '#141517', color: 'white', minHeight: '100%', boxSizing: 'border-box' }}>
                {/* Title and Controls Header */}
                <Box mb={20}>
                    {/* Mobile: Stacked, Desktop: Row */}
                    <Group justify="space-between" align="center" visibleFrom="sm">
                        <Box w={200} /> {/* Spacer for centering */}
                        <Text fw={900} style={{ fontSize: '32px', textDecoration: 'underline', textUnderlineOffset: '6px', color: 'white', letterSpacing: '2px' }}>매 출 대 장</Text>
                        <Group gap={12}>
                             <Button 
                                leftSection={<IconPrinter size={18} />} 
                                color="blue" 
                                variant="filled"
                                onClick={() => handlePrint()}
                                size="sm"
                                w={140} 
                            >
                                인쇄하기
                            </Button>
                            <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] }}>
                                <DateInput
                                    value={selectedDate}
                                    onChange={(date) => setSelectedDate(date as Date | null)}
                                    valueFormat="YYYY. MM. DD."
                                    placeholder="날짜 선택"
                                    leftSection={<IconCalendar size={18} />}
                                    locale="ko"
                                    size="sm"
                                    popoverProps={{ withinPortal: true, position: 'bottom-start' }}
                                    inputMode="none"
                                    styles={{
                                        input: {
                                            backgroundColor: '#1A1B1E', 
                                            border: '1px solid #373A40',
                                            color: 'white',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                            width: '140px'
                                        }
                                    }}
                                />
                            </DatesProvider>
                            <Button color="gray" variant="subtle" onClick={onClose} size="sm" w={36} p={0}>✕</Button>
                        </Group>
                    </Group>

                    {/* Mobile Header */}
                    <Stack align="center" gap="sm" hiddenFrom="sm">
                         <Group justify="space-between" w="100%">
                             <Text fw={900} size="xl" style={{ textDecoration: 'underline', textUnderlineOffset: '4px', color: 'white' }}>매 출 대 장</Text>
                             <Button color="gray" variant="subtle" onClick={onClose} size="sm" w={36} p={0}>✕</Button>
                         </Group>



                         <Group w="100%" justify="space-between">
                            <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] }}>
                                <DateInput
                                    value={selectedDate}
                                    onChange={(date) => setSelectedDate(date as Date | null)}
                                    valueFormat="YYYY. MM. DD."
                                    placeholder="날짜 선택"
                                    leftSection={<IconCalendar size={18} />}
                                    locale="ko"
                                    size="sm"
                                    inputMode="none"
                                    style={{ flex: 1 }}
                                    popoverProps={{ withinPortal: true, position: 'bottom-start' }}
                                    styles={{
                                        input: {
                                            backgroundColor: '#1A1B1E', 
                                            border: '1px solid #373A40',
                                            color: 'white',
                                            fontSize: '14px',
                                            textAlign: 'center',
                                            width: '100%'
                                        }
                                    }}
                                />
                            </DatesProvider>
                             <Button 
                                leftSection={<IconPrinter size={18} />} 
                                color="blue" 
                                variant="filled"
                                onClick={() => handlePrint()}
                                size="sm"
                                w={90}
                            >
                                인쇄
                            </Button>
                         </Group>
                    </Stack>
                </Box>

                {/* Table */}

                <Table 
                    withTableBorder 
                    withColumnBorders 
                    style={{ 
                        borderColor: '#373A40', 
                        minWidth: '800px', 
                        borderCollapse: 'separate',
                        borderSpacing: 0
                    }}
                >
                    <Table.Thead>
                        <Table.Tr>
                            {/* Corner Header: Fixed Top-Left */}
                            <Table.Th 
                                rowSpan={2} 
                                style={{ 
                                    width: '90px', 
                                    minWidth: '90px',
                                    height: '84px', // 54 + 30
                                    padding: 0,
                                    position: 'sticky', 
                                    left: 0,
                                    top: 0,
                                    zIndex: 30, // Highest
                                    backgroundColor: '#1A1B1E',
                                    borderBottom: '2px solid #373A40',
                                    borderRight: '1px solid #373A40',
                                    boxShadow: '1px 1px 0 0 #373A40',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {/* Diagonal Line (Background) */}
                                <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
                                    <line x1="0" y1="0" x2="100%" y2="100%" stroke="#373A40" strokeWidth="1" />
                                </svg>
                                
                                {/* Text Container */}
                                <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div style={{ textAlign: 'right', padding: '2px 4px 0 0' }}>
                                        <Text size="xs" style={{ color: '#E9ECEF', fontWeight: 700, whiteSpace: 'nowrap' }}>품 명</Text>
                                    </div>
                                    <div style={{ textAlign: 'left', padding: '0 0 2px 4px' }}>
                                        <Text size="xs" style={{ color: '#E9ECEF', fontWeight: 700, whiteSpace: 'nowrap' }}>거래처</Text>
                                    </div>
                                </div>
                            </Table.Th>
                            
                            {gasColumns.map(gas => (
                                <Table.Th key={gas.key} colSpan={2} style={{ 
                                    textAlign: 'center', 
                                    backgroundColor: '#1A1B1E', 
                                    color: '#E9ECEF', 
                                    whiteSpace: 'pre-line', 
                                    fontSize: '13px', 
                                    lineHeight: '1.25',
                                    padding: '2px 0',
                                    borderBottom: '1px solid #373A40',
                                    borderRight: '1px solid #373A40',
                                    position: 'sticky',
                                    top: 0,
                                    height: '54px',
                                    zIndex: 20,
                                    boxSizing: 'border-box'
                                }}>
                                    {gas.label}
                                </Table.Th>
                            ))}
                        </Table.Tr>
                        <Table.Tr>
                            {/* Sub-headers for each gas: Stuck below the main header */}
                            {gasColumns.map(gas => (
                                <Fragment key={gas.key}>
                                    <Table.Th style={{ 
                                        textAlign: 'center', 
                                        color: '#74C0FC', 
                                        backgroundColor: '#25262B', 
                                        fontSize: '12px', 
                                        padding: '4px', 
                                        borderBottom: '2px solid #373A40',
                                        borderRight: '1px solid #373A40',
                                        position: 'sticky',
                                        top: '54px', // Match Row 1 height
                                        height: '30px',
                                        zIndex: 20,
                                        boxSizing: 'border-box',
                                        whiteSpace: 'nowrap'
                                    }}>납품</Table.Th>
                                    <Table.Th style={{ 
                                        textAlign: 'center', 
                                        color: '#FFA8A8', 
                                        backgroundColor: '#25262B', 
                                        fontSize: '12px', 
                                        padding: '4px', 
                                        borderBottom: '2px solid #373A40',
                                        borderRight: '1px solid #373A40',
                                        position: 'sticky',
                                        top: '54px', // Match Row 1 height
                                        height: '30px',
                                        zIndex: 20,
                                        boxSizing: 'border-box',
                                        whiteSpace: 'nowrap'
                                    }}>회수</Table.Th>
                                </Fragment>
                            ))}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {rows.map((row, idx) => (
                            <Table.Tr key={idx} style={{ height: '26px' }}>
                                    <Table.Td style={{ 
                                        backgroundColor: '#2C2E33', 
                                        color: '#fff', 
                                        fontWeight: 700, 
                                        fontSize: '12px', 
                                        padding: '4px',
                                        position: 'sticky',
                                        left: 0,
                                        zIndex: 10,
                                        borderBottom: '1px solid #373A40',
                                        borderRight: '1px solid #373A40',
                                        boxShadow: '1px 0 0 0 #373A40'
                                    }}>
                                        <div style={{ whiteSpace: 'nowrap', lineHeight: '1.2' }}>{row.name}</div>
                                        {row.name && row.worker && <Text size="10px" c="dimmed" fw={400} mt={0}>{row.worker}</Text>}
                                    </Table.Td>
                                    {gasColumns.map(gas => {
                                        const cellData = row.data[gas.key];
                                        return (
                                            <Fragment key={gas.key}>
                                                <Table.Td style={{ 
                                                    textAlign: 'center', 
                                                    color: '#74C0FC', 
                                                    backgroundColor: '#25262B', 
                                                    fontWeight: 500, 
                                                    fontSize: '14px',
                                                    borderBottom: '1px solid #373A40',
                                                    borderRight: '1px solid #373A40'
                                                }}>
                                                    {cellData?.del > 0 ? cellData.del : ''}
                                                </Table.Td>
                                                <Table.Td style={{ 
                                                    textAlign: 'center', 
                                                    color: '#FFA8A8', 
                                                    backgroundColor: '#25262B', 
                                                    fontWeight: 500, 
                                                    fontSize: '14px',
                                                    borderBottom: '1px solid #373A40',
                                                    borderRight: '1px solid #373A40'
                                                }}>
                                                    {cellData?.col > 0 ? cellData.col : ''}
                                                </Table.Td>
                                            </Fragment>
                                        );
                                    })}
                            </Table.Tr>
                        ))}
                        
                        {/* Total Row (계) */}
                        <Table.Tr style={{ height: '44px', backgroundColor: '#1A1B1E', borderTop: '2px solid #339AF0' }}>
                            <Table.Td style={{ 
                                textAlign: 'center', 
                                backgroundColor: '#1A1B1E', 
                                color: '#fff', 
                                fontWeight: 900, 
                                borderColor: '#373A40', 
                                fontSize: '15px',
                                position: 'sticky',
                                left: 0,
                                zIndex: 10,
                                boxShadow: '2px 0 5px -2px rgba(0,0,0,0.5)'
                            }}>
                                계
                            </Table.Td>
                            {gasColumns.map(gas => {
                                let totalDel = 0;
                                let totalCol = 0;
                                rows.forEach(row => {
                                    const cellData = row.data[gas.key];
                                    if(cellData?.del) totalDel += cellData.del;
                                    if(cellData?.col) totalCol += cellData.col;
                                });

                                return (
                                    <Fragment key={gas.key}>
                                        <Table.Td style={{ textAlign: 'center', color: '#74C0FC', backgroundColor: '#1A1B1E', borderColor: '#373A40', fontWeight: 900, fontSize: '15px' }}>
                                            {totalDel > 0 ? totalDel : '-'}
                                        </Table.Td>
                                        <Table.Td style={{ textAlign: 'center', color: '#FFA8A8', backgroundColor: '#1A1B1E', borderColor: '#373A40', fontWeight: 900, fontSize: '15px' }}>
                                            {totalCol > 0 ? totalCol : '-'}
                                        </Table.Td>
                                    </Fragment>
                                );
                            })}
                        </Table.Tr>
                        {/* Bottom Row: Deposit & Expenditure Status integrated into Table */}
                        <Table.Tr style={{ height: '100px' }}>
                            {/* 1. Deposit Label (Matches Name Column) */}
                            <Table.Td style={{ textAlign: 'center', backgroundColor: '#1A1B1E', color: '#dimmed', fontWeight: 700, borderColor: '#373A40', fontSize: '14px', borderRight: '1px solid #373A40' }}>
                                입금 현황
                            </Table.Td>
                            
                            {/* 2. Deposit Content (Spans 13 items) */}
                            <Table.Td colSpan={13} style={{ padding: 0, backgroundColor: '#25262B', borderColor: '#373A40', verticalAlign: 'top' }}>
                                <Textarea 
                                    variant="unstyled" 
                                    style={{ height: '100%' }} 
                                    styles={{ input: { color: 'white', padding: '8px', height: '100%', minHeight: '100px' } }}
                                    value={depositNote}
                                    onChange={(e) => setDepositNote(e.currentTarget.value)}
                                    onBlur={handleSaveNote}
                                    placeholder="입금 내역 입력..."
                                />
                            </Table.Td>

                            {/* 3. Expenditure Label (Spans 4 items - Middle Alignment) */}
                            <Table.Td colSpan={4} style={{ textAlign: 'center', backgroundColor: '#1A1B1E', color: '#dimmed', fontWeight: 700, borderColor: '#373A40', fontSize: '14px', borderLeft: '1px solid #373A40', borderRight: '1px solid #373A40' }}>
                                지출 현황
                            </Table.Td>

                            {/* 4. Expenditure Content (Spans Remaining 13 items) */}
                            <Table.Td colSpan={13} style={{ padding: 0, backgroundColor: '#25262B', borderColor: '#373A40', verticalAlign: 'top' }}>
                                <Textarea 
                                     variant="unstyled" 
                                     style={{ height: '100%' }} 
                                     styles={{ input: { color: 'white', padding: '8px', height: '100%', minHeight: '100px' } }}
                                     value={expenditureNote}
                                     onChange={(e) => setExpenditureNote(e.currentTarget.value)}
                                     onBlur={handleSaveNote}
                                     placeholder="지출 내역 입력..."
                                />
                            </Table.Td>
                        </Table.Tr>
                    </Table.Tbody>
                </Table>

            </div>
        </ScrollArea>
        {/* Fixed Footer */}
        <Group justify="flex-end" p="sm" style={{ backgroundColor: '#141517' }}>
            <Text size="sm" c="dimmed" fw={500} style={{ letterSpacing: '1px' }}>삼덕가스공업(주)</Text>
        </Group>
      </Box>
    </Modal>
    {/* Portal for Print */}
    {isMounted && typeof document !== 'undefined' && createPortal(printContent, document.body)}
    </>
  );
}
